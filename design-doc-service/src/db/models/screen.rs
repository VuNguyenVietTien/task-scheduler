use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Screen {
    pub id: Uuid,
    pub document_id: Uuid,
    pub name: String,
    pub svg_content: Option<String>,
    pub svg_layers: Option<serde_json::Value>,
    pub frame_width: Option<i32>,
    pub frame_height: Option<i32>,
    pub content_type: String,
    pub breakpoint: String,
    pub sort_order: i32,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
