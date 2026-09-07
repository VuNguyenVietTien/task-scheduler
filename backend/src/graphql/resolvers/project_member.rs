use async_graphql::{Context, Object, Result, ID};
use chrono::Utc;
use sqlx::Row;
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::resolvers::{members, project_authz};
use crate::graphql::types::{MemberRole, ProjectMember, User};

#[derive(Default)]
pub struct ProjectMemberQuery;

#[Object(rename_fields = "snake_case", rename_args = "snake_case")]
impl ProjectMemberQuery {
    async fn project_members(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
    ) -> Result<Vec<ProjectMember>> {
        members::query::project_members(ctx, project_id).await
    }

    async fn project_member(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
        user_id: ID,
    ) -> Result<Option<ProjectMember>> {
        members::query::project_member(ctx, project_id, user_id).await
    }
}

#[derive(Default)]
pub struct ProjectMemberMutation;

#[Object(rename_fields = "snake_case", rename_args = "snake_case")]
impl ProjectMemberMutation {
    async fn add_project_member(
        &self,
        ctx: &Context<'_>,
        input: AddProjectMemberInput,
    ) -> Result<ProjectMember> {
        let context = ctx.data::<GraphQLContext>()?;
        let project_id = Uuid::parse_str(&input.project_id)?;
        let user_id = Uuid::parse_str(&input.user_id)?;
        let caller = project_authz::require_user(context)?;
        let mut tx = context.db.begin().await.map_err(AuthError::Database)?;
        project_authz::require_project_write_tx(&mut tx, caller, project_id).await?;
        project_authz::require_access_target_tx(&mut tx, caller, project_id, user_id).await?;
        let user = sqlx::query(
            "SELECT user_id, email, username, full_name, avatar_url FROM users WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AuthError::Database)?
        .ok_or_else(|| async_graphql::Error::new("User not found"))?;
        let display_name = [
            user.get::<Option<String>, _>("full_name"),
            user.get::<Option<String>, _>("username"),
        ]
        .into_iter()
        .flatten()
        .find(|name| !name.trim().is_empty())
        .unwrap_or_else(|| user.get("email"));
        let member = sqlx::query(
            "INSERT INTO project_members (member_id, resource_member_id, project_id, display_name, user_id, role, joined_at) \
             VALUES ($1,$2,$3,$4,$5,$6,$7) \
             ON CONFLICT (project_id, user_id) DO UPDATE \
             SET role = EXCLUDED.role, joined_at = COALESCE(project_members.joined_at, EXCLUDED.joined_at), updated_at = now() \
             WHERE project_members.role IS NULL RETURNING role, joined_at",
        )
        .bind(Uuid::new_v4()).bind(Uuid::new_v4()).bind(project_id).bind(display_name)
        .bind(user_id).bind(input.role).bind(Utc::now())
        .fetch_optional(&mut *tx).await.map_err(AuthError::Database)?
        .ok_or_else(|| async_graphql::Error::new("User is already a member of this project"))?;
        let result = ProjectMember {
            role: member.get("role"),
            joined_at: member.get("joined_at"),
            user: User {
                user_id: user.get("user_id"),
                email: user.get("email"),
                username: user.get("username"),
                full_name: user.get("full_name"),
                avatar_url: user.get("avatar_url"),
            },
        };
        tx.commit().await.map_err(AuthError::Database)?;
        Ok(result)
    }

    async fn update_project_member(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
        user_id: ID,
        role: MemberRole,
    ) -> Result<ProjectMember> {
        members::mutation::update_member(ctx, project_id, user_id, role).await
    }

    async fn remove_project_member(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
        user_id: ID,
    ) -> Result<bool> {
        members::mutation::remove_member(ctx, project_id, user_id).await
    }
}

#[derive(async_graphql::InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct AddProjectMemberInput {
    pub project_id: ID,
    pub user_id: ID,
    pub role: MemberRole,
}
