use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::types::JsonValue;
use sqlx::types::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Notification {
    pub notification_id: Uuid,
    pub user_id: Uuid,
    pub project_id: Option<Uuid>,
    pub sender_id: Option<Uuid>,
    pub type_: String,
    pub reference_type: String,
    pub reference_id: Uuid,
    pub message: String,
    pub action: String,
    pub metadata: JsonValue,
    pub is_read: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateNotificationInput {
    pub user_id: Uuid,
    pub project_id: Option<Uuid>,
    pub sender_id: Option<Uuid>,
    pub type_: String,
    pub reference_type: String,
    pub reference_id: Uuid,
    pub message: String,
    pub action: String,
    pub metadata: Option<JsonValue>,
}
