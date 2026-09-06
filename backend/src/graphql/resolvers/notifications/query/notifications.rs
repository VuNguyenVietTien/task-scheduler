use async_graphql::{Context, Result, ID};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::db::queries::notification::get_user_notifications;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::Notification;

pub async fn notifications(
    ctx: &Context<'_>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<Notification>> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;
    let user_id = context
        .auth
        .as_ref()
        .ok_or_else(|| AuthError::Unauthorized("Not authenticated".to_string()))?
        .user_id()?;

    let limit = limit.unwrap_or(20);
    let offset = offset.unwrap_or(0);

    let notifications = get_user_notifications(pool, user_id, limit, offset)
        .await
        .map_err(|e| AuthError::Database(e))?;

    Ok(notifications.into_iter().map(|n| n.into()).collect())
}
