use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct ExternalLink {
    pub id: Uuid,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub provider: String,
    pub external_id: String,
    pub external_url: Option<String>,
    pub sync_status: String,
    pub last_synced_at: Option<DateTime<Utc>>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
