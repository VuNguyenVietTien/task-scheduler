use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Flow {
    pub id: Uuid,
    pub document_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub mermaid_definition: Option<String>,
    pub flow_type: String,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct FlowStep {
    pub id: Uuid,
    pub flow_id: Uuid,
    pub screen_id: Option<Uuid>,
    pub component_id: Option<Uuid>,
    pub step_order: i32,
    pub label: Option<String>,
    pub description: Option<String>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}
