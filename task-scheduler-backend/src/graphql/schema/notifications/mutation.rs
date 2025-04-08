use async_graphql::*;
use crate::graphql::Context;
use super::types::{Notification, CreateNotificationInput};

#[derive(Default)]
pub struct NotificationMutation;

#[Object]
impl NotificationMutation {
    async fn create_notification(
        &self, 
        ctx: &Context<'_>, 
        input: CreateNotificationInput
    ) -> Result<Notification> {
        // This will be implemented in the resolver
        Err(Error::new("Not implemented"))
    }

    async fn mark_notification_as_read(
        &self, 
        ctx: &Context<'_>, 
        id: ID
    ) -> Result<Notification> {
        // This will be implemented in the resolver
        Err(Error::new("Not implemented"))
    }

    async fn mark_all_notifications_as_read(
        &self, 
        ctx: &Context<'_>
    ) -> Result<bool> {
        // This will be implemented in the resolver
        Ok(false)
    }
} 