use async_graphql::*;
use chrono::{DateTime, Utc};
use serde_json::Value as JsonValue;

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
    pub created_at: DateTime<Utc>
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