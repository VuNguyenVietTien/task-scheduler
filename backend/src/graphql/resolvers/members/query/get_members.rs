use async_graphql::{Context, Result, ID};
use sqlx::{Row, postgres::PgRow};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::{ProjectMember, User};

pub async fn project_members(ctx: &Context<'_>, project_id: ID) -> Result<Vec<ProjectMember>> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;
    let project_id = Uuid::parse_str(&project_id)?;

    let members = sqlx::query(
        r#"
        SELECT
            pm.role,
            pm.joined_at,
            u.user_id,
            u.username,
            u.email,
            u.full_name,
            u.avatar_url
        FROM project_members pm
        INNER JOIN users u ON pm.user_id = u.user_id
        WHERE project_id = $1
        "#
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AuthError::Database(e))?;

    Ok(members.into_iter().map(|row: PgRow| ProjectMember {
        role: row.get("role"),
        joined_at: row.get("joined_at"),
        user: User {
            user_id: row.get("user_id"),
            email: row.get("email"),
            username: row.get("username"),
            full_name: row.get("full_name"),
            avatar_url: row.get::<Option<String>, _>("avatar_url"),
        }
    }).collect())
} 