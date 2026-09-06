use async_graphql::{Context, Result};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::db::queries::notification::get_unread_notifications_count;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::NotificationCount;

pub async fn notification_count(ctx: &Context<'_>) -> Result<NotificationCount> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;
    let user_id = context
        .auth
        .as_ref()
        .ok_or_else(|| AuthError::Unauthorized("Not authenticated".to_string()))?
        .user_id()?;

    let unread_count = get_unread_notifications_count(pool, user_id)
        .await
        .map_err(|e| AuthError::Database(e))?;

    Ok(NotificationCount {
        total: unread_count,
        unread: unread_count,
    })
}
