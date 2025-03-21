use async_graphql::{Context, Result, ID};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;

pub async fn remove_member(
    ctx: &Context<'_>,
    project_id: ID,
    user_id: ID
) -> Result<bool> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;
    let (project_id, user_id) = (Uuid::parse_str(&project_id)?, Uuid::parse_str(&user_id)?);

    // Check if the user is trying to remove an admin
    let is_admin = sqlx::query(
        r#"
        SELECT 1 FROM project_members 
        WHERE project_id = $1 AND user_id = $2 AND role = 'admin'
        "#
    )
    .bind(project_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AuthError::Database(e))?;

    if is_admin.is_some() {
        return Err("Cannot remove a project admin".into());
    }

    let result = sqlx::query(
        r#"
        DELETE FROM project_members 
        WHERE project_id = $1 AND user_id = $2
        "#
    )
    .bind(project_id)
    .bind(user_id)
    .execute(pool)
    .await
    .map_err(|e| AuthError::Database(e))?;

    Ok(result.rows_affected() > 0)
} 