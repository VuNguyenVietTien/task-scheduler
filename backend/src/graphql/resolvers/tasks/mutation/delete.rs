use async_graphql::{Context, ID};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;

pub async fn delete_task(ctx: &Context<'_>, task_id: ID) -> Result<bool, async_graphql::Error> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;
    let task_id = Uuid::parse_str(&task_id.to_string())?;

    sqlx::query(
        r#"
        UPDATE tasks 
        SET is_deleted = true 
        WHERE task_id = $1
        "#,
    )
    .bind(task_id)
    .execute(pool)
    .await
    .map_err(|e| AuthError::Database(e))?;

    Ok(true)
}
