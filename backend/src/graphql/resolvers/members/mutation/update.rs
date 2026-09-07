use async_graphql::{Context, Result, ID};
use sqlx::Row;
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::resolvers::project_authz;
use crate::graphql::types::{MemberRole, ProjectMember, User};

pub async fn update_member(
    ctx: &Context<'_>,
    project_id: ID,
    user_id: ID,
    role: MemberRole,
) -> Result<ProjectMember> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;
    let (project_id, user_id) = (Uuid::parse_str(&project_id)?, Uuid::parse_str(&user_id)?);
    let caller = project_authz::require_user(context)?;
    let mut tx = pool.begin().await.map_err(AuthError::Database)?;
    project_authz::require_project_write_tx(&mut tx, caller, project_id).await?;
    project_authz::require_access_target_tx(&mut tx, caller, project_id, user_id).await?;

    // Get user info
    let user_info = sqlx::query(
        r#"
        SELECT user_id, email, username, full_name, avatar_url 
        FROM users 
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AuthError::Database(e))?;

    let user_row = match user_info {
        Some(row) => row,
        None => return Err("User not found".into()),
    };

    let member = sqlx::query(
        r#"
        UPDATE project_members 
        SET role = $3
        WHERE project_id = $1 AND user_id = $2
        RETURNING 
            member_id, project_id, user_id, role, joined_at
        "#,
    )
    .bind(project_id)
    .bind(user_id)
    .bind(role)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AuthError::Database(e))?;

    tx.commit().await.map_err(AuthError::Database)?;
    match member {
        Some(row) => Ok(ProjectMember {
            role: row.get("role"),
            joined_at: row.get("joined_at"),
            user: User {
                user_id: user_row.get("user_id"),
                email: user_row.get("email"),
                username: user_row.get("username"),
                full_name: user_row.get("full_name"),
                avatar_url: user_row.get("avatar_url"),
            },
        }),
        None => Err("Project member not found".into()),
    }
}
