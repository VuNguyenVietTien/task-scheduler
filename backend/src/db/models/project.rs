use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use sqlx::types::JsonValue;
use crate::db::types::{ProjectStatus, ProjectPriority, ProjectVisibility};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub project_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub status: ProjectStatus,
    pub priority: ProjectPriority,
    pub visibility: ProjectVisibility,
    pub tags: Option<JsonValue>,
    pub progress: f64,
    pub category: Option<String>,
    pub metadata: Option<JsonValue>,
}

impl Project {
    pub fn new(name: String, owner_id: Uuid) -> Self {
        let now = Utc::now();
        Self {
            project_id: Uuid::new_v4(),
            name,
            description: None,
            owner_id,
            created_at: now,
            updated_at: now,
            status: ProjectStatus::default(),
            priority: ProjectPriority::default(),
            visibility: ProjectVisibility::default(),
            tags: None,
            progress: 0.0,
            category: None,
            metadata: None,
        }
    }
}