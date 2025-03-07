use async_graphql::*;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize}; 
use sqlx::Type;
use uuid::Uuid;

#[derive(SimpleObject, Clone, Debug, Serialize, Deserialize)]
pub struct Task {
    pub task_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub priority: TaskPriority,
    pub assignee_id: Option<Uuid>,
    pub project_id: Uuid,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub due_date: Option<DateTime<Utc>>,
    pub order: i32,
    pub tags: Option<Vec<String>>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize, Type)]
#[sqlx(rename_all = "lowercase", type_name = "task_status")]
pub enum TaskStatus {
    Todo,
    InProgress,
    Done,
    Cancelled
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize, Type)]
#[sqlx(rename_all = "lowercase", type_name = "task_priority")]
pub enum TaskPriority {
    Low,
    Medium,
    High,
    Urgent
}

#[derive(InputObject)]
pub struct CreateTaskInput {
    pub title: String,
    pub description: Option<String>,
    pub priority: TaskPriority,
    pub assignee_id: Option<String>,
    pub project_id: String,
    pub due_date: Option<DateTime<Utc>>,
    pub tags: Option<Vec<String>>,
    pub metadata: Option<serde_json::Value>
}

#[derive(InputObject)]
pub struct UpdateTaskInput {
    pub task_id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<TaskStatus>,
    pub priority: Option<TaskPriority>, 
    pub assignee_id: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
    pub tags: Option<Vec<String>>,
    pub metadata: Option<serde_json::Value>
}

#[derive(InputObject)]
pub struct ReorderTasksInput {
    pub project_id: String,
    pub task_id: String,
    pub new_order: i32
}