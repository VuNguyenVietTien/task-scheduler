use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct DocumentAudit {
    pub id: i64,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub action: String,
    pub old_data: Option<serde_json::Value>,
    pub new_data: Option<serde_json::Value>,
    pub changed_by: i64,
    pub changed_at: DateTime<Utc>,
}
