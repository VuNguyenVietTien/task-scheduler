use async_graphql::{Context, Result};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::db::queries::notification::mark_all_notifications_as_read as db_mark_all_notifications_as_read;
use crate::graphql::context::Context as GraphQLContext;

pub async fn mark_all_notifications_as_read(
    ctx: &Context<'_>,
) -> Result<bool> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;
    let user_id = context.auth.as_ref()
        .ok_or_else(|| AuthError::Unauthorized("Not authenticated".to_string()))?
        .user_id()?;
    
    db_mark_all_notifications_as_read(pool, user_id)
        .await
        .map_err(|e| AuthError::Database(e))?;
    
    Ok(true)
} 