pub mod query;
pub mod mutation;

use async_graphql::*;
use crate::graphql::types::{
    Notification,
    NotificationCount,
    CreateNotificationInput,
};

#[derive(Default)]
pub struct NotificationQuery;

#[Object]
impl NotificationQuery {
    async fn notifications(
        &self, 
        ctx: &Context<'_>, 
        limit: Option<i64>, 
        offset: Option<i64>
    ) -> Result<Vec<Notification>> {
        query::notifications(ctx, limit, offset).await
    }

    async fn notification(
        &self, 
        ctx: &Context<'_>, 
        id: ID
    ) -> Result<Option<Notification>> {
        query::notification(ctx, id).await
    }

    async fn notification_count(
        &self, 
        ctx: &Context<'_>
    ) -> Result<NotificationCount> {
        query::notification_count(ctx).await
    }
}

#[derive(Default)]
pub struct NotificationMutation;

#[Object]
impl NotificationMutation {
    async fn create_notification(
        &self, 
        ctx: &Context<'_>, 
        input: CreateNotificationInput
    ) -> Result<Notification> {
        mutation::create_notification(ctx, input).await
    }

    async fn mark_notification_as_read(
        &self, 
        ctx: &Context<'_>, 
        notification_id: ID
    ) -> Result<Notification> {
        mutation::mark_notification_as_read(ctx, notification_id).await
    }

    async fn mark_all_notifications_as_read(
        &self, 
        ctx: &Context<'_>
    ) -> Result<bool> {
        mutation::mark_all_notifications_as_read(ctx).await
    }
} 