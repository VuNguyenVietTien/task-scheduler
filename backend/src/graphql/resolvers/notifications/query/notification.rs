use async_graphql::{Context, Result, ID};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::db::queries::notification::get_notification_by_id;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::Notification;

pub async fn notification(
    ctx: &Context<'_>,
    notification_id: ID,
) -> Result<Option<Notification>> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;
    let user_id = context.auth.as_ref()
        .ok_or_else(|| AuthError::Unauthorized("Not authenticated".to_string()))?
        .user_id()?;
    
    let notification_id = Uuid::parse_str(&notification_id)?;
    
    let notification = get_notification_by_id(pool, notification_id)
        .await
        .map_err(|e| AuthError::Database(e))?;
    
    // Only return the notification if it belongs to the current user
    match notification {
        Some(n) if n.user_id == user_id => Ok(Some(n.into())),
        _ => Ok(None),
    }
} 