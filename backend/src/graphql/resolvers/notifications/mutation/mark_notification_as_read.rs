use async_graphql::{Context, Result, ID};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::db::queries::notification::mark_notification_as_read as db_mark_notification_as_read;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::Notification;

pub async fn mark_notification_as_read(
    ctx: &Context<'_>,
    notification_id: ID,
) -> Result<Notification> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;
    let user_id = context
        .auth
        .as_ref()
        .ok_or_else(|| AuthError::Unauthorized("Not authenticated".to_string()))?
        .user_id()?;

    let notification_id = Uuid::parse_str(&notification_id)?;

    let notification = db_mark_notification_as_read(pool, notification_id, user_id)
        .await
        .map_err(|e| AuthError::Database(e))?;

    Ok(notification.into())
}
