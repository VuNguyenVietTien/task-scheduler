use async_graphql::*;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize}; 
use sqlx::Type;
use uuid::Uuid;
use rust_decimal::Decimal;

#[derive(SimpleObject, Clone, Debug, Serialize, Deserialize)]
pub struct Task {
    pub task_id: Uuid,
    pub project_id: Uuid,
    pub parent_task_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub priority: TaskPriority,
    pub priority_order: i32,
    pub assignee_id: Option<Uuid>,
    pub created_by: Uuid,
    pub start_date: Option<DateTime<Utc>>,
    pub due_date: Option<DateTime<Utc>>,
    pub actual_start_date: Option<DateTime<Utc>>,
    pub actual_end_date: Option<DateTime<Utc>>,
    pub effort: Option<i32>,
    pub progress: f64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_deleted: bool,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize, Type)]
#[sqlx(rename_all = "lowercase", type_name = "task_status")]
pub enum TaskStatus {
    Todo,
    Doing,
    Done,
    Close,
    Pending,
    Review,
    Blocked,
    Rejected,
    Archived,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize, Type)]
#[sqlx(rename_all = "lowercase", type_name = "task_priority")]
pub enum TaskPriority {
    Low,
    Medium,
    High,
    Urgent,
    Critical,
}

#[derive(InputObject)]
pub struct CreateTaskInput {
    pub project_id: ID,
    pub parent_task_id: Option<ID>,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub priority: TaskPriority,
    pub priority_order: Option<i32>,
    pub start_date: Option<DateTime<Utc>>,
    pub due_date: Option<DateTime<Utc>>,
    pub effort: Option<f64>,
    pub assignee_id: Option<ID>,
}

#[derive(InputObject)]
pub struct UpdateTaskInput {
    pub task_id: ID,
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<TaskStatus>,
    pub priority: Option<TaskPriority>,
    pub priority_order: Option<i32>,
    pub start_date: Option<DateTime<Utc>>,
    pub due_date: Option<DateTime<Utc>>,
    pub actual_start_date: Option<DateTime<Utc>>,
    pub actual_end_date: Option<DateTime<Utc>>,
    pub effort: Option<f64>,
    pub progress: Option<i32>,
    pub assignee_id: Option<ID>,
}

#[derive(InputObject)]
pub struct ReorderTasksInput {
    pub task_orders: Vec<TaskOrderInput>,
}

#[derive(InputObject)]
pub struct TaskOrderInput {
    pub task_id: ID,
    pub priority_order: i32,
}