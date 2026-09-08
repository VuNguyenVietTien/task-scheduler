//! Resource-member GraphQL resolvers — project scheduling & WBS increment 1,
//! task 1.2 foundation.
//!
//! STATUS: authored but NOT yet mounted (same convention as the task-1.1
//! taxonomy module). `backend/src/graphql/resolvers/mod.rs` and
//! `backend/src/graphql/schema.rs` are owned by task 1.3 (GraphQL
//! composition); until then this module is compiled only through the
//! `#[cfg(test)] #[path]` gate in `src/lib.rs`. Task 1.3 mounts it by adding
//! `pub mod resource_members;` + re-exports and folding
//! `ResourceMemberQuery` / `ResourceMemberMutation` into the schema roots.
//!
//! Behavior contracts (design doc §6.3) implemented through
//! `crate::domain::resource_identity`:
//! - placeholders: stable ID, required display name, optional email, no
//!   fabricated user;
//! - linking preserves the member ID and rejects duplicate linked users
//!   unless resolved explicitly;
//! - companies/groups classify concrete members only and are never
//!   assignable (`is_assignable` is exposed for assignment surfaces).

use async_graphql::{Context, ErrorExtensions, MaybeUndefined, Object, Result, ID};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::domain::resource_identity::{self, ResourceIdentityError, ResourceMemberKind};
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::resolvers::{coded_error, project_authz};

fn parse_id(id: &ID, field: &str) -> Result<Uuid> {
    Uuid::parse_str(&id.to_string())
        .map_err(|e| async_graphql::Error::new(format!("invalid {field}: {e}")))
}

fn map_err(e: ResourceIdentityError) -> async_graphql::Error {
    let code = if matches!(e, ResourceIdentityError::DuplicateLinkedUser { .. }) {
        "CONFLICT"
    } else {
        "BAD_USER_INPUT"
    };
    async_graphql::Error::new(e.to_string())
        .extend_with(|_, extensions| extensions.set("code", code))
}

/* --------------------------------- types --------------------------------- */

#[derive(async_graphql::SimpleObject)]
#[graphql(rename_fields = "snake_case")]
pub struct ResourceMemberType {
    pub member_id: ID,
    pub resource_member_id: ID,
    pub project_id: ID,
    pub display_name: String,
    pub email: Option<String>,
    /// NULL while the member is a placeholder.
    pub user_id: Option<ID>,
    /// MEMBER | COMPANY | GROUP. Only MEMBER is assignable.
    pub member_kind: String,
    pub linked_at: Option<DateTime<Utc>>,
    pub access_role: Option<String>,
    pub joined_at: Option<DateTime<Utc>>,
    pub invited_by: Option<ID>,
}

/// Row shape shared by reads/writes (canonical DB model).
use crate::db::models::ResourceMember as ResourceMemberRow;

impl From<ResourceMemberRow> for ResourceMemberType {
    fn from(row: ResourceMemberRow) -> Self {
        Self {
            member_id: row.member_id.into(),
            resource_member_id: row.resource_member_id.into(),
            project_id: row.project_id.into(),
            display_name: row.display_name,
            email: row.email,
            user_id: row.user_id.map(ID::from),
            member_kind: row.member_kind,
            linked_at: row.linked_at,
            access_role: row.access_role,
            joined_at: row.joined_at,
            invited_by: row.invited_by.map(ID::from),
        }
    }
}

fn kind_from_str(raw: &str) -> Result<ResourceMemberKind> {
    match raw {
        "MEMBER" => Ok(ResourceMemberKind::Member),
        "COMPANY" => Ok(ResourceMemberKind::Company),
        "GROUP" => Ok(ResourceMemberKind::Group),
        other => Err(async_graphql::Error::new(format!(
            "invalid member_kind: {other}"
        ))),
    }
}

async fn fetch_member(pool: &sqlx::PgPool, member_id: Uuid) -> Result<ResourceMemberRow> {
    sqlx::query_as::<_, ResourceMemberRow>(
            "SELECT member_id, resource_member_id, project_id, display_name, email, user_id, member_kind, \
             linked_at, role::text AS access_role, joined_at, invited_by, created_at, updated_at \
             FROM project_members WHERE resource_member_id = $1",
        )
    .bind(member_id)
    .fetch_optional(pool)
    .await
    .map_err(AuthError::Database)?
    .ok_or_else(|| async_graphql::Error::new("unknown resource member"))
}

/* --------------------------------- queries --------------------------------- */

#[derive(Default)]
pub struct ResourceMemberQuery;

#[Object(rename_fields = "snake_case", rename_args = "snake_case")]
impl ResourceMemberQuery {
    /// A project's resource identities (optionally only concrete members).
    async fn resource_members(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
        only_assignable: Option<bool>,
    ) -> Result<Vec<ResourceMemberType>> {
        let context = ctx.data::<GraphQLContext>()?;
        let project_id = parse_id(&project_id, "project_id")?;
        let user_id = project_authz::require_user(context)?;
        project_authz::require_member_list(&context.db, user_id, project_id).await?;
        let rows = sqlx::query_as::<_, ResourceMemberRow>(
            "SELECT member_id, resource_member_id, project_id, display_name, email, user_id, member_kind, \
             linked_at, role::text AS access_role, joined_at, invited_by, created_at, updated_at \
             FROM project_members WHERE project_id = $1",
        )
        .bind(project_id)
        .fetch_all(&context.db)
        .await
        .map_err(AuthError::Database)?;
        // Deterministic order without an order column: kind, then name.
        let mut rows = rows;
        rows.sort_by(|a, b| {
            (&a.member_kind, &a.display_name).cmp(&(&b.member_kind, &b.display_name))
        });
        Ok(rows
            .into_iter()
            .filter(|r| {
                !only_assignable.unwrap_or(false)
                    || resource_identity::is_assignable(
                        kind_from_str(&r.member_kind).expect("DB CHECK enforces kind"),
                    )
            })
            .map(ResourceMemberType::from)
            .collect())
    }

    /// One resource member by stable ID.
    async fn resource_member(
        &self,
        ctx: &Context<'_>,
        resource_member_id: ID,
    ) -> Result<ResourceMemberType> {
        let context = ctx.data::<GraphQLContext>()?;
        let user_id = project_authz::require_user(context)?;
        let member = fetch_member(
            &context.db,
            parse_id(&resource_member_id, "resource_member_id")?,
        )
        .await?;
        // Same-project relation guard: the caller must belong to the
        // member's project before any project-scoped data is returned.
        project_authz::require_member_list(&context.db, user_id, member.project_id).await?;
        Ok(member.into())
    }
}

/* -------------------------------- mutations -------------------------------- */

#[derive(Default)]
pub struct ResourceMemberMutation;

#[derive(async_graphql::InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct CreateResourceMemberInput {
    pub project_id: ID,
    pub display_name: String,
    pub email: Option<String>,
    /// MEMBER (default) | COMPANY | GROUP. Companies/groups classify only.
    pub member_kind: Option<String>,
}

#[Object(rename_fields = "snake_case", rename_args = "snake_case")]
impl ResourceMemberMutation {
    /// Create a resource identity. With no user_id this is a PLACEHOLDER:
    /// stable ID, required display name, optional email, no fabricated user.
    async fn create_resource_member(
        &self,
        ctx: &Context<'_>,
        input: CreateResourceMemberInput,
    ) -> Result<ResourceMemberType> {
        let context = ctx.data::<GraphQLContext>()?;
        let project_id = parse_id(&input.project_id, "project_id")?;
        let user_id = project_authz::require_user(context)?;
        let mut tx = context.db.begin().await.map_err(AuthError::Database)?;
        project_authz::require_project_write_tx(&mut tx, user_id, project_id).await?;
        let kind = match input.member_kind.as_deref() {
            None => ResourceMemberKind::Member,
            Some(raw) => kind_from_str(raw)?,
        };
        // Pure rule validation before any write.
        resource_identity::new_placeholder_member(
            project_id,
            &input.display_name,
            input.email.as_deref(),
        )
        .map_err(map_err)?;
        let row = sqlx::query_as::<_, ResourceMemberRow>(
            "INSERT INTO project_members \
             (member_id, resource_member_id, project_id, display_name, email, member_kind) \
             VALUES (uuid_generate_v4(), uuid_generate_v4(), $1, $2, NULLIF($3, ''), $4) \
             RETURNING member_id, resource_member_id, project_id, display_name, email, user_id, member_kind, \
             linked_at, role::text AS access_role, joined_at, invited_by, created_at, updated_at",
        )
        .bind(project_id)
        .bind(input.display_name.trim())
        .bind(input.email.as_deref().map(str::trim))
        .bind(kind.as_str())
        .fetch_one(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
        tx.commit().await.map_err(AuthError::Database)?;
        Ok(row.into())
    }

    /// Link a user to an existing resource member. The member ID never
    /// changes; a duplicate linked user (same project) is an explicit error.
    async fn link_resource_member_user(
        &self,
        ctx: &Context<'_>,
        resource_member_id: ID,
        user_id: ID,
    ) -> Result<ResourceMemberType> {
        let context = ctx.data::<GraphQLContext>()?;
        let caller_id = project_authz::require_user(context)?;
        let member_id = parse_id(&resource_member_id, "resource_member_id")?;
        let user_id = parse_id(&user_id, "user_id")?;
        let mut tx = context.db.begin().await.map_err(AuthError::Database)?;
        let scope = fetch_member(&context.db, member_id).await?.project_id;
        project_authz::require_project_write_tx(&mut tx, caller_id, scope).await?;
        // Project first, then member, then assigned task mirrors.
        let (project_id, linked_user_id, member_kind): (Uuid, Option<Uuid>, String) =
            sqlx::query_as(
                "SELECT project_id, user_id, member_kind FROM project_members \
             WHERE resource_member_id = $1 FOR UPDATE",
            )
            .bind(member_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(AuthError::Database)?
            .ok_or_else(|| async_graphql::Error::new("unknown resource member"))?;
        if project_id != scope {
            return Err(async_graphql::Error::new("member project changed"));
        }
        if member_kind != "MEMBER" {
            return Err(async_graphql::Error::new("only MEMBER rows can be linked"));
        }
        if let Some(existing) = linked_user_id {
            if existing == user_id {
                tx.commit().await.map_err(AuthError::Database)?;
                return Ok(fetch_member(&context.db, member_id).await?.into());
            }
            return Err(async_graphql::Error::new(
                "resource member is already linked to another user",
            ));
        }
        let user_exists: bool =
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE user_id = $1)")
                .bind(user_id)
                .fetch_one(&mut *tx)
                .await
                .map_err(AuthError::Database)?;
        if !user_exists {
            return Err(async_graphql::Error::new("unknown user"));
        }
        let conflicting: Option<Uuid> = sqlx::query_scalar(
            "SELECT resource_member_id FROM project_members \
             WHERE project_id = $1 AND user_id = $2 AND resource_member_id <> $3",
        )
        .bind(project_id)
        .bind(user_id)
        .bind(member_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
        if let Some(existing) = conflicting {
            return Err(map_err(ResourceIdentityError::DuplicateLinkedUser {
                user_id,
                existing_member_id: existing,
            }));
        }
        sqlx::query(
            "UPDATE project_members SET user_id = $2, linked_at = COALESCE(linked_at, now()), updated_at = now() \
             WHERE resource_member_id = $1 AND user_id IS NULL AND member_kind = 'MEMBER'"
        )
        .bind(member_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
        // Keep the task account mirror synchronized in this transaction while
        // retaining the stable resource-member assignment identity.
        sqlx::query(
            "UPDATE tasks SET assignee_id = $2 WHERE project_id = $3 AND assignee_resource_member_id = $1",
        )
        .bind(member_id)
        .bind(user_id)
        .bind(project_id)
        .execute(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
        tx.commit().await.map_err(AuthError::Database)?;
        Ok(fetch_member(&context.db, member_id).await?.into())
    }

    /// Link by an existing account email. This intentionally does not grant
    /// access: `role` stays NULL until the explicit access mutation is used.
    async fn link_resource_member_by_email(
        &self,
        ctx: &Context<'_>,
        resource_member_id: ID,
        email: String,
    ) -> Result<ResourceMemberType> {
        let context = ctx.data::<GraphQLContext>()?;
        let caller_id = project_authz::require_user(context)?;
        let member_id = parse_id(&resource_member_id, "resource_member_id")?;
        resource_identity::new_placeholder_member(Uuid::nil(), "email validation", Some(&email))
            .map_err(map_err)?;
        let mut tx = context.db.begin().await.map_err(AuthError::Database)?;
        let scope = fetch_member(&context.db, member_id).await?.project_id;
        project_authz::require_project_write_tx(&mut tx, caller_id, scope).await?;
        let (project_id, linked_user_id, kind): (Uuid, Option<Uuid>, String) = sqlx::query_as(
            "SELECT project_id, user_id, member_kind FROM project_members \
             WHERE resource_member_id = $1 FOR UPDATE",
        )
        .bind(member_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AuthError::Database)?
        .ok_or_else(|| async_graphql::Error::new("unknown resource member"))?;
        if project_id != scope {
            return Err(async_graphql::Error::new("member project changed"));
        }
        if kind != "MEMBER" {
            return Err(async_graphql::Error::new("only MEMBER rows can be linked"));
        }
        let users: Vec<Uuid> = sqlx::query_scalar(
            "SELECT user_id FROM users WHERE lower(btrim(email)) = lower(btrim($1)) LIMIT 2",
        )
        .bind(email.trim())
        .fetch_all(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
        let [user_id] = users.as_slice() else {
            return Err(if users.is_empty() {
                coded_error("no account has this email", "NOT_FOUND")
            } else {
                coded_error("email matches multiple accounts", "CONFLICT")
            });
        };
        if let Some(existing) = linked_user_id {
            if existing == *user_id {
                tx.commit().await.map_err(AuthError::Database)?;
                return Ok(fetch_member(&context.db, member_id).await?.into());
            }
            return Err(async_graphql::Error::new(
                "resource member is already linked to another user",
            ));
        }
        let conflict: Option<Uuid> = sqlx::query_scalar(
            "SELECT resource_member_id FROM project_members \
             WHERE project_id = $1 AND user_id = $2 AND resource_member_id <> $3",
        )
        .bind(project_id)
        .bind(*user_id)
        .bind(member_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
        if conflict.is_some() {
            return Err(
                async_graphql::Error::new("account is already linked in this project")
                    .extend_with(|_, extensions| extensions.set("code", "CONFLICT")),
            );
        }
        sqlx::query(
            "UPDATE project_members SET user_id = $2, email = (SELECT email FROM users WHERE user_id = $2), \
             linked_at = COALESCE(linked_at, now()), updated_at = now() \
             WHERE resource_member_id = $1",
        )
        .bind(member_id)
        .bind(*user_id)
        .execute(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
        // Linking by email is the same canonical transition as linking by ID:
        // task user mirrors must move atomically with the member link.
        sqlx::query(
            "UPDATE tasks SET assignee_id = $2 WHERE project_id = $3 AND assignee_resource_member_id = $1",
        )
        .bind(member_id)
        .bind(*user_id)
        .bind(project_id)
        .execute(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
        tx.commit().await.map_err(AuthError::Database)?;
        Ok(fetch_member(&context.db, member_id).await?.into())
    }

    /// Explicitly set/revoke project access without deleting the scheduling
    /// identity. A NULL role revokes access only.
    async fn set_project_member_access(
        &self,
        ctx: &Context<'_>,
        resource_member_id: ID,
        role: MaybeUndefined<String>,
    ) -> Result<ResourceMemberType> {
        let context = ctx.data::<GraphQLContext>()?;
        let caller_id = project_authz::require_user(context)?;
        let member_id = parse_id(&resource_member_id, "resource_member_id")?;
        let mut tx = context.db.begin().await.map_err(AuthError::Database)?;
        let scope = fetch_member(&context.db, member_id).await?.project_id;
        project_authz::require_project_write_tx(&mut tx, caller_id, scope).await?;
        let (project_id, user_id, kind): (Uuid, Option<Uuid>, String) = sqlx::query_as(
            "SELECT project_id, user_id, member_kind FROM project_members \
             WHERE resource_member_id = $1 FOR UPDATE",
        )
        .bind(member_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AuthError::Database)?
        .ok_or_else(|| async_graphql::Error::new("unknown resource member"))?;
        if project_id != scope {
            return Err(async_graphql::Error::new("member project changed"));
        }
        if let Some(target) = user_id {
            project_authz::require_access_target_tx(&mut tx, caller_id, project_id, target).await?;
        }
        let role = match role {
            MaybeUndefined::Undefined => {
                return Err(coded_error(
                    "role must be explicitly set or null",
                    "BAD_USER_INPUT",
                ));
            }
            MaybeUndefined::Null => None,
            MaybeUndefined::Value(value) => Some(value.to_ascii_lowercase()),
        };
        if let Some(ref value) = role {
            if user_id.is_none()
                || kind != "MEMBER"
                || !matches!(value.as_str(), "manager" | "leader" | "member" | "guest")
            {
                return Err(coded_error(
                    "invalid access role for this member",
                    "BAD_USER_INPUT",
                ));
            }
            project_authz::require_role_assignment_tx(&mut tx, caller_id, project_id, value)
                .await?;
        }
        sqlx::query(
            "UPDATE project_members SET role = $2::member_role, updated_at = now() \
             WHERE resource_member_id = $1",
        )
        .bind(member_id)
        .bind(role)
        .execute(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
        tx.commit().await.map_err(AuthError::Database)?;
        Ok(fetch_member(&context.db, member_id).await?.into())
    }

    /// Remove one canonical project member. Cascading scheduling configuration
    /// follows DB constraints; assigned members are rejected by the task FK.
    async fn remove_resource_member(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
        member_id: ID,
    ) -> Result<bool> {
        let context = ctx.data::<GraphQLContext>()?;
        let caller_id = project_authz::require_user(context)?;
        let project_id = parse_id(&project_id, "project_id")?;
        let member_id = parse_id(&member_id, "member_id")?;
        let mut tx = context.db.begin().await.map_err(AuthError::Database)?;
        project_authz::require_project_write_tx(&mut tx, caller_id, project_id).await?;
        let user_id: Option<Option<Uuid>> = sqlx::query_scalar(
            "SELECT user_id FROM project_members WHERE project_id = $1 AND member_id = $2 FOR UPDATE",
        )
        .bind(project_id)
        .bind(member_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
        let Some(user_id) = user_id else {
            return Err(coded_error("project member not found", "NOT_FOUND"));
        };
        project_authz::require_member_removal_tx(&mut tx, caller_id, project_id, user_id).await?;
        let removed =
            sqlx::query("DELETE FROM project_members WHERE project_id = $1 AND member_id = $2")
                .bind(project_id)
                .bind(member_id)
                .execute(&mut *tx)
                .await
                .map_err(AuthError::Database)?
                .rows_affected()
                > 0;
        tx.commit().await.map_err(AuthError::Database)?;
        Ok(removed)
    }

    /// Transfer project ownership to a linked member. The former owner keeps
    /// manager access and may remove themselves after the transfer.
    async fn transfer_project_ownership(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
        new_owner_user_id: ID,
    ) -> Result<bool> {
        let context = ctx.data::<GraphQLContext>()?;
        let caller = project_authz::require_user(context)?;
        let project_id = parse_id(&project_id, "project_id")?;
        let new_owner = parse_id(&new_owner_user_id, "new_owner_user_id")?;
        if caller == new_owner {
            return Err(coded_error(
                "new owner must be another project member",
                "BAD_USER_INPUT",
            ));
        }
        let mut tx = context.db.begin().await.map_err(AuthError::Database)?;
        let current_owner: Uuid =
            sqlx::query_scalar("SELECT owner_id FROM projects WHERE project_id = $1 FOR UPDATE")
                .bind(project_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(AuthError::Database)?
                .ok_or_else(|| coded_error("project not found", "NOT_FOUND"))?;
        if current_owner != caller {
            return Err(coded_error(
                "Only the project owner may transfer ownership",
                "FORBIDDEN",
            ));
        }
        let eligible: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM project_members WHERE project_id = $1 \
             AND user_id = $2 AND member_kind = 'MEMBER' AND role IS NOT NULL)",
        )
        .bind(project_id)
        .bind(new_owner)
        .fetch_one(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
        if !eligible {
            return Err(coded_error(
                "new owner must be a linked project member",
                "BAD_USER_INPUT",
            ));
        }
        sqlx::query("UPDATE projects SET owner_id = $2, updated_at = now() WHERE project_id = $1")
            .bind(project_id)
            .bind(new_owner)
            .execute(&mut *tx)
            .await
            .map_err(AuthError::Database)?;
        sqlx::query(
            "UPDATE project_members SET role = 'manager', updated_at = now() \
                     WHERE project_id = $1 AND user_id IN ($2, $3)",
        )
        .bind(project_id)
        .bind(current_owner)
        .bind(new_owner)
        .execute(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
        tx.commit().await.map_err(AuthError::Database)?;
        Ok(true)
    }

    /// Classify a concrete MEMBER by a COMPANY/GROUP of the same project.
    /// Classification only: no assignment/capacity semantics.
    async fn classify_resource_member(
        &self,
        ctx: &Context<'_>,
        resource_member_id: ID,
        classified_by_resource_member_id: ID,
    ) -> Result<bool> {
        let context = ctx.data::<GraphQLContext>()?;
        let caller_id = project_authz::require_user(context)?;
        let member_id = parse_id(&resource_member_id, "resource_member_id")?;
        let classifier_id = parse_id(
            &classified_by_resource_member_id,
            "classified_by_resource_member_id",
        )?;
        let (member, classifier) = {
            let member = fetch_member(&context.db, member_id).await?;
            let classifier = fetch_member(&context.db, classifier_id).await?;
            (member, classifier)
        };
        // Caller must be able to write the member's project before any
        // classification write; same-project is enforced by domain rules.
        project_authz::require_project_write(&context.db, caller_id, member.project_id).await?;
        // Pure domain rules: MEMBER target, COMPANY/GROUP classifier, same
        // project, no self-classification.
        resource_identity::validate_classification(
            &resource_identity::ResourceMemberIdentity {
                resource_member_id: member.resource_member_id,
                project_id: member.project_id,
                display_name: member.display_name.clone(),
                email: member.email.clone(),
                user_id: member.user_id,
                kind: kind_from_str(&member.member_kind)?,
                linked_at: member.linked_at,
            },
            &resource_identity::ResourceMemberIdentity {
                resource_member_id: classifier.resource_member_id,
                project_id: classifier.project_id,
                display_name: classifier.display_name.clone(),
                email: classifier.email.clone(),
                user_id: classifier.user_id,
                kind: kind_from_str(&classifier.member_kind)?,
                linked_at: classifier.linked_at,
            },
        )
        .map_err(map_err)?;
        sqlx::query(
            "INSERT INTO resource_member_classifications \
             (resource_member_id, classified_by_resource_member_id) VALUES ($1, $2) \
             ON CONFLICT DO NOTHING",
        )
        .bind(member_id)
        .bind(classifier_id)
        .execute(&context.db)
        .await
        .map_err(AuthError::Database)?;
        Ok(true)
    }
}
