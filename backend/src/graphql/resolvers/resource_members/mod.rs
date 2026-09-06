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

use async_graphql::{Context, ID, Object, Result};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::domain::resource_identity::{
    self, ResourceIdentityError, ResourceMemberKind,
};
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::resolvers::project_authz;

fn parse_id(id: &ID, field: &str) -> Result<Uuid> {
    Uuid::parse_str(&id.to_string())
        .map_err(|e| async_graphql::Error::new(format!("invalid {field}: {e}")))
}

fn map_err(e: ResourceIdentityError) -> async_graphql::Error {
    async_graphql::Error::new(e.to_string())
}

/* --------------------------------- types --------------------------------- */

#[derive(async_graphql::SimpleObject)]
#[graphql(rename_fields = "snake_case")]
pub struct ResourceMemberType {
    pub resource_member_id: ID,
    pub project_id: ID,
    pub display_name: String,
    pub email: Option<String>,
    /// NULL while the member is a placeholder.
    pub user_id: Option<ID>,
    /// MEMBER | COMPANY | GROUP. Only MEMBER is assignable.
    pub member_kind: String,
    pub linked_at: Option<DateTime<Utc>>,
}

/// Row shape shared by reads/writes (canonical DB model).
use crate::db::models::ResourceMember as ResourceMemberRow;

impl From<ResourceMemberRow> for ResourceMemberType {
    fn from(row: ResourceMemberRow) -> Self {
        Self {
            resource_member_id: row.resource_member_id.into(),
            project_id: row.project_id.into(),
            display_name: row.display_name,
            email: row.email,
            user_id: row.user_id.map(ID::from),
            member_kind: row.member_kind,
            linked_at: row.linked_at,
        }
    }
}

fn kind_from_str(raw: &str) -> Result<ResourceMemberKind> {
    match raw {
        "MEMBER" => Ok(ResourceMemberKind::Member),
        "COMPANY" => Ok(ResourceMemberKind::Company),
        "GROUP" => Ok(ResourceMemberKind::Group),
        other => Err(async_graphql::Error::new(format!("invalid member_kind: {other}"))),
    }
}

async fn fetch_member(pool: &sqlx::PgPool, member_id: Uuid) -> Result<ResourceMemberRow> {
    sqlx::query_as::<_, ResourceMemberRow>(
            "SELECT resource_member_id, project_id, display_name, email, user_id, member_kind, \
             linked_at, created_at, updated_at FROM resource_members WHERE resource_member_id = $1",
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
        project_authz::require_project_read(&context.db, user_id, project_id).await?;
        let rows = sqlx::query_as::<_, ResourceMemberRow>(
            "SELECT resource_member_id, project_id, display_name, email, user_id, member_kind, \
             linked_at, created_at, updated_at FROM resource_members WHERE project_id = $1",
        )
        .bind(project_id)
        .fetch_all(&context.db)
        .await
        .map_err(AuthError::Database)?;
        // Deterministic order without an order column: kind, then name.
        let mut rows = rows;
        rows.sort_by(|a, b| (&a.member_kind, &a.display_name).cmp(&(&b.member_kind, &b.display_name)));
        Ok(rows
            .into_iter()
            .filter(|r| {
                !only_assignable.unwrap_or(false) || resource_identity::is_assignable(kind_from_str(&r.member_kind).expect("DB CHECK enforces kind"))
            })
            .map(ResourceMemberType::from)
            .collect())
    }

    /// One resource member by stable ID.
    async fn resource_member(&self, ctx: &Context<'_>, resource_member_id: ID) -> Result<ResourceMemberType> {
        let context = ctx.data::<GraphQLContext>()?;
        let user_id = project_authz::require_user(context)?;
        let member = fetch_member(
            &context.db,
            parse_id(&resource_member_id, "resource_member_id")?,
        )
        .await?;
        // Same-project relation guard: the caller must belong to the
        // member's project before any project-scoped data is returned.
        project_authz::require_project_read(&context.db, user_id, member.project_id).await?;
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
        project_authz::require_project_write(&context.db, user_id, project_id).await?;
        let kind = match input.member_kind.as_deref() {
            None => ResourceMemberKind::Member,
            Some(raw) => kind_from_str(raw)?,
        };
        // Pure rule validation before any write.
        resource_identity::new_placeholder_member(project_id, &input.display_name, input.email.as_deref())
            .map_err(map_err)?;
        let row = sqlx::query_as::<_, ResourceMemberRow>(
            "INSERT INTO resource_members (project_id, display_name, email, member_kind) \
             VALUES ($1, $2, $3, $4) \
             RETURNING resource_member_id, project_id, display_name, email, user_id, member_kind, \
             linked_at, created_at, updated_at",
        )
        .bind(project_id)
        .bind(input.display_name.trim())
        .bind(input.email.as_deref().map(str::trim))
        .bind(kind.as_str())
        .fetch_one(&context.db)
        .await
        .map_err(AuthError::Database)?;
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
        let mut tx = context
            .db
            .begin()
            .await
            .map_err(AuthError::Database)?;
        // Serialize per-project link decisions.
        let project_id: Uuid = sqlx::query_scalar(
            "SELECT project_id FROM resource_members WHERE resource_member_id = $1 FOR UPDATE",
        )
        .bind(member_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AuthError::Database)?
        .ok_or_else(|| async_graphql::Error::new("unknown resource member"))?;
        // Caller must be able to write this member's project (same gate as
        // every other project-scoped mutation) before any link decision.
        project_authz::require_project_write(&context.db, caller_id, project_id).await?;
        let conflicting: Option<Uuid> = sqlx::query_scalar(
            "SELECT resource_member_id FROM resource_members \
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
            "UPDATE resource_members SET user_id = $2, linked_at = now(), updated_at = now() \
             WHERE resource_member_id = $1",
        )
        .bind(member_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
        tx.commit().await.map_err(AuthError::Database)?;
        Ok(fetch_member(&context.db, member_id).await?.into())
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
        let classifier_id =
            parse_id(&classified_by_resource_member_id, "classified_by_resource_member_id")?;
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
