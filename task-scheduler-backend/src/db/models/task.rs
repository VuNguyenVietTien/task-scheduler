use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use crate::db::enums::{TaskStatus, TaskPriority, TaskProgressType};

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Task {
    pub task_id: Uuid,
    pub project_id: Uuid,
    pub parent_task_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub assignee_id: Option<Uuid>,
    pub priority: TaskPriority,
    pub priority_order: i32,
    pub effort: Option<f64>,
    pub start_date: Option<DateTime<Utc>>,
    pub due_date: Option<DateTime<Utc>>,
    pub actual_start_date: Option<DateTime<Utc>>,
    pub actual_end_date: Option<DateTime<Utc>>,
    pub progress: Option<i32>,
    pub created_by: Uuid,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub is_deleted: Option<bool>,
    pub type_: Option<String>,
    pub category: Option<String>,
    pub progress_type: Option<TaskProgressType>,
    pub tags: Option<serde_json::Value>,
}

impl Task {
    pub fn is_completed(&self) -> bool {
        matches!(self.status, TaskStatus::Done | TaskStatus::Close)
    }

    pub fn get_tags(&self) -> Vec<String> {
        self.tags
            .as_ref()
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default()
    }
}