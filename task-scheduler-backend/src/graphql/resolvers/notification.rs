use async_graphql::*;
use crate::db::Pool;

#[derive(Default)]
pub struct NotificationQuery;

#[Object]
impl NotificationQuery {
    async fn notifications(&self, ctx: &Context<'_>) -> Result<Vec<String>> {
        // TODO: Implement actual notification fetching
        Ok(vec![])
    }
}

#[derive(Default)]
pub struct NotificationMutation;

#[Object]
impl NotificationMutation {
    async fn mark_as_read(&self, ctx: &Context<'_>, id: String) -> Result<bool> {
        // TODO: Implement actual mark as read logic
        Ok(true)
    }
}
