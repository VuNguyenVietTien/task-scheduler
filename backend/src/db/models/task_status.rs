use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskStatus {
    pub status_id: Uuid,
    pub project_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub color: String,
    pub display_order: i32,
    pub is_default: bool,
    pub is_done: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl TaskStatus {
    pub fn new(
        project_id: Uuid,
        name: String,
        color: String,
        display_order: i32,
    ) -> Self {
        let now = Utc::now();
        Self {
            status_id: Uuid::new_v4(),
            project_id,
            name,
            description: None,
            color,
            display_order,
            is_default: false,
            is_done: false,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn set_description(&mut self, description: Option<String>) -> &mut Self {
        self.description = description;
        self.updated_at = Utc::now();
        self
    }

    pub fn mark_as_default(&mut self) -> &mut Self {
        self.is_default = true;
        self.updated_at = Utc::now();
        self
    }

    pub fn mark_as_done_state(&mut self) -> &mut Self {
        self.is_done = true;
        self.updated_at = Utc::now();
        self
    }
}