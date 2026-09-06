use async_graphql::{Context, Result};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::db::queries::notification::create_notification as db_create_notification;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::{CreateNotificationInput, Notification};

pub async fn create_notification(
    ctx: &Context<'_>,
    input: CreateNotificationInput,
) -> Result<Notification> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;
    let user_id = context
        .auth
        .as_ref()
        .ok_or_else(|| AuthError::Unauthorized("Not authenticated".to_string()))?
        .user_id();

    // Convert GraphQL input to database input
    let db_input = crate::db::models::CreateNotificationInput {
        user_id: Uuid::parse_str(&input.user_id)?,
        project_id: input.project_id.map(|id| Uuid::parse_str(&id).unwrap()),
        sender_id: input.sender_id.map(|id| Uuid::parse_str(&id).unwrap()),
        type_: input.type_,
        reference_type: input.reference_type,
        reference_id: Uuid::parse_str(&input.reference_id)?,
        message: input.message,
        action: input.action,
        metadata: input.metadata,
    };

    let notification = db_create_notification(pool, db_input)
        .await
        .map_err(|e| AuthError::Database(e))?;

    Ok(notification.into())
}
