use crate::db::types::{ProjectPriority, ProjectStatus, ProjectVisibility};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub status: ProjectStatus,
    pub priority: ProjectPriority,
    pub visibility: ProjectVisibility,
    pub tags: Option<serde_json::Value>,
    pub progress: f64,
    pub category: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

pub mod projects {
    pub use super::Project as Entity;
    use super::*;
}
