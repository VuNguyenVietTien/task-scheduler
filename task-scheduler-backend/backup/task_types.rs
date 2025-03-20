use async_graphql::*;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize}; 
use sqlx::Type;
use uuid::Uuid;

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
    pub effort: Option<f64>,
    pub progress: f64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_deleted: bool,
    pub type_: Option<String>,
    pub category: Option<String>,
    pub progress_type: TaskProgressType,
    pub tags: Option<Vec<String>>,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize, Type)]
#[sqlx(rename_all = "lowercase", type_name = "task_status")]
pub enum TaskStatus {
    #[graphql(name = "todo")]
    Todo,
    #[graphql(name = "doing")]
    Doing,
    #[graphql(name = "done")]
    Done,
    #[graphql(name = "close")]
    Close,
    #[graphql(name = "pending")]
    Pending,
    #[graphql(name = "review")]
    Review,
    #[graphql(name = "blocked")]
    Blocked,
    #[graphql(name = "rejected")]
    Rejected,
    #[graphql(name = "archived")]
    Archived,
}

impl TaskStatus {
    pub fn to_lowercase_str(&self) -> &'static str {
        match self {
            TaskStatus::Todo => "todo",
            TaskStatus::Doing => "doing",
            TaskStatus::Done => "done",
            TaskStatus::Close => "close",
            TaskStatus::Pending => "pending",
            TaskStatus::Review => "review",
            TaskStatus::Blocked => "blocked",
            TaskStatus::Rejected => "rejected",
            TaskStatus::Archived => "archived",
        }
    }

    pub fn from_lowercase_str(s: &str) -> Option<Self> {
        match s {
            "todo" => Some(TaskStatus::Todo),
            "doing" => Some(TaskStatus::Doing),
            "done" => Some(TaskStatus::Done),
            "close" => Some(TaskStatus::Close),
            "pending" => Some(TaskStatus::Pending),
            "review" => Some(TaskStatus::Review),
            "blocked" => Some(TaskStatus::Blocked),
            "rejected" => Some(TaskStatus::Rejected),
            "archived" => Some(TaskStatus::Archived),
            _ => None,
        }
    }
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize, Type)]
#[sqlx(rename_all = "lowercase", type_name = "task_priority")]
pub enum TaskPriority {
    #[graphql(name = "low")]
    Low,
    #[graphql(name = "medium")]
    Medium,
    #[graphql(name = "high")]
    High,
    #[graphql(name = "urgent")]
    Urgent,
    #[graphql(name = "critical")]
    Critical,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize, Type)]
#[sqlx(rename_all = "lowercase", type_name = "task_progress_type")]
pub enum TaskProgressType {
    #[graphql(name = "study")]
    Study,
    #[graphql(name = "investigate")]
    Investigate,
    #[graphql(name = "code")]
    Code,
    #[graphql(name = "test")]
    Test,
    #[graphql(name = "review_code")]
    ReviewCode,
    #[graphql(name = "review_test_report")]
    ReviewTestReport,
    #[graphql(name = "release")]
    Release
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
    pub category: Option<String>,
    pub type_: Option<String>,
    pub tags: Option<Vec<String>>,
    pub progress_type: Option<TaskProgressType>,
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
    pub category: Option<String>,
    pub type_: Option<String>,
    pub tags: Option<Vec<String>>,
    pub progress_type: Option<TaskProgressType>,
    pub is_deleted: Option<bool>,
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
