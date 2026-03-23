use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Component {
    pub id: Uuid,
    pub screen_id: Uuid,
    pub custom_id: String,
    pub name: String,
    pub component_type: Option<String>,
    pub data_type: Option<String>,
    pub display_logic: Option<String>,
    pub position: serde_json::Value,
    pub svg_element_id: Option<String>,
    pub descriptions: serde_json::Value,
    pub metadata: serde_json::Value,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
