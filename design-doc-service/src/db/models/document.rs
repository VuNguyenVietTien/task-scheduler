use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct DesignDocument {
    pub id: Uuid,
    pub module_id: Uuid,
    pub name: String,
    pub status: String,
    pub description: Option<String>,
    pub source_tool: Option<String>,
    pub last_imported_at: Option<DateTime<Utc>>,
    pub metadata: serde_json::Value,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
