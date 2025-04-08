use async_graphql::*;
use crate::graphql::Context;
use super::types::{Notification, NotificationCount};

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
        // This will be implemented in the resolver
        Ok(vec![])
    }

    async fn notification(
        &self, 
        ctx: &Context<'_>, 
        id: ID
    ) -> Result<Option<Notification>> {
        // This will be implemented in the resolver
        Ok(None)
    }

    async fn notification_count(
        &self, 
        ctx: &Context<'_>
    ) -> Result<NotificationCount> {
        // This will be implemented in the resolver
        Ok(NotificationCount {
            total: 0,
            unread: 0,
        })
    }
} 