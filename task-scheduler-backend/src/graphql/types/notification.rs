use async_graphql::{SimpleObject, ID};
use chrono::{DateTime, Utc};
use serde_json::Value as JsonValue;

#[derive(SimpleObject)]
pub struct NotificationResponse {
    pub id: ID,
    pub user_id: ID,
    pub type_: String,
    pub content: JsonValue,
    pub created_at: DateTime<Utc>,
    pub read_at: Option<DateTime<Utc>>,
}

impl From<crate::db::models::Notification> for NotificationResponse {
    fn from(notif: crate::db::models::Notification) -> Self {
        Self {
            id: notif.notification_id.to_string().into(),
            user_id: notif.user_id.to_string().into(),
            type_: notif.type_,
            content: notif.content.0,
            created_at: notif.created_at,
            read_at: notif.read_at,
        }
    }
}
