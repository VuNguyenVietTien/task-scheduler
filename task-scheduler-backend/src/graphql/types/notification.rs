use async_graphql::*;
use chrono::{DateTime, Utc};
use serde_json::Value as JsonValue;
use uuid::Uuid;

#[derive(SimpleObject)]
pub struct Notification {
    pub id: ID,
    pub user_id: ID,
    pub project_id: Option<ID>,
    pub sender_id: Option<ID>,
    pub type_: String,
    pub reference_type: String,
    pub reference_id: ID,
    pub message: String,
    pub action: String,
    pub metadata: JsonValue,
    pub is_read: bool,
    pub created_at: DateTime<Utc>,
    pub read_at: Option<DateTime<Utc>>,
}

#[derive(InputObject)]
pub struct CreateNotificationInput {
    pub user_id: ID,
    pub project_id: Option<ID>,
    pub sender_id: Option<ID>,
    pub type_: String,
    pub reference_type: String,
    pub reference_id: ID,
    pub message: String,
    pub action: String,
    pub metadata: Option<JsonValue>,
}

#[derive(SimpleObject)]
pub struct NotificationCount {
    pub total: i64,
    pub unread: i64,
}

impl From<crate::db::models::Notification> for Notification {
    fn from(notif: crate::db::models::Notification) -> Self {
        Self {
            id: notif.notification_id.to_string().into(),
            user_id: notif.user_id.to_string().into(),
            project_id: notif.project_id.map(|id| id.to_string().into()),
            sender_id: notif.sender_id.map(|id| id.to_string().into()),
            type_: notif.type_,
            reference_type: notif.reference_type,
            reference_id: notif.reference_id.to_string().into(),
            message: notif.message,
            action: notif.action,
            metadata: notif.metadata,
            is_read: notif.is_read,
            created_at: notif.created_at,
            read_at: notif.read_at,
        }
    }
} 