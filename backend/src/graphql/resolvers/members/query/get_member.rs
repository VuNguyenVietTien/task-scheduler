use async_graphql::{Context, Result, ID};
use sqlx::Row;
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::{MemberRole, ProjectMember, User};

pub async fn project_member(
    ctx: &Context<'_>,
    project_id: ID,
    user_id: ID,
) -> Result<Option<ProjectMember>> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;
    let project_id = Uuid::parse_str(&project_id)?;
    let user_id = Uuid::parse_str(&user_id)?;
    let caller = crate::graphql::resolvers::project_authz::require_user(context)?;
    crate::graphql::resolvers::project_authz::require_member_list(pool, caller, project_id)
        .await?;

    let member = sqlx::query(
        r#"
        SELECT
            pm.role::text AS role,
            pm.joined_at,
            u.user_id,
            u.username,
            u.email,
            u.full_name,
            u.avatar_url
        FROM project_members pm
        INNER JOIN users u ON pm.user_id = u.user_id
        WHERE pm.project_id = $1 AND pm.user_id = $2 AND pm.role IS NOT NULL
        "#,
    )
    .bind(project_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AuthError::Database(e))?;

    match member {
        Some(row) => Ok(Some(ProjectMember {
            role: MemberRole::from_database_row(&row)?,
            joined_at: row.get("joined_at"),
            user: User {
                user_id: row.get("user_id"),
                email: row.get("email"),
                username: row.get("username"),
                full_name: row.get("full_name"),
                avatar_url: row.get("avatar_url"),
            },
        })),
        None => Ok(None),
    }
}
