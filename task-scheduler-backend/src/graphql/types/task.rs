use async_graphql::*;
use chrono::{DateTime, Utc};
use sqlx::Type;
use uuid::Uuid;
use std::str::FromStr;
use std::fmt;
use serde::{Serialize, Deserialize};
use serde_json::Value as JsonValue;
use log::debug;

#[derive(SimpleObject, Debug, Clone, Serialize, Deserialize)]
#[graphql(rename_fields = "camelCase")]
pub struct Assignee {
    pub user_id: Uuid,
    pub username: String,
    pub avatar_url: Option<String>,
    pub role: Option<String>
}

#[derive(SimpleObject, Debug, Clone, Serialize, Deserialize)]
#[graphql(rename_fields = "camelCase")]
pub struct Task {
    pub task_id: Uuid,
    pub project_id: Uuid,
    pub parent_task_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub assignee: Option<Assignee>,
    pub priority_order: i32,
    pub start_date: Option<DateTime<Utc>>,
    pub due_date: Option<DateTime<Utc>>,
    pub actual_start_date: Option<DateTime<Utc>>,
    pub actual_end_date: Option<DateTime<Utc>>,
    pub effort: Option<f64>,
    pub progress: Option<f64>,
    pub created_by: Uuid,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub is_deleted: Option<bool>,
    pub status: TaskStatus,
    pub priority: TaskPriority,
    pub type_: Option<String>,
    pub category: Option<String>,
    pub progress_type: Option<TaskProgressType>,
    pub tags: Option<JsonValue>,
    pub child_tasks: Option<Vec<Task>>
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize, Type)]
#[sqlx(type_name = "task_status", rename_all = "lowercase")]
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

impl fmt::Display for TaskStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // Convert enum variant to lowercase string
        let s = match self {
            TaskStatus::Todo => "todo",
            TaskStatus::Doing => "doing",
            TaskStatus::Done => "done",
            TaskStatus::Close => "close",
            TaskStatus::Pending => "pending",
            TaskStatus::Review => "review",
            TaskStatus::Blocked => "blocked",
            TaskStatus::Rejected => "rejected",
            TaskStatus::Archived => "archived",
        };
        write!(f, "{}", s)
    }
}

impl FromStr for TaskStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        debug!("Parsing task status from string: {}", s);
        match s.to_lowercase().as_str() {
            "todo" => Ok(TaskStatus::Todo),
            "doing" => Ok(TaskStatus::Doing),
            "done" => Ok(TaskStatus::Done), 
            "close" => Ok(TaskStatus::Close),
            "pending" => Ok(TaskStatus::Pending),
            "review" => Ok(TaskStatus::Review),
            "blocked" => Ok(TaskStatus::Blocked),
            "rejected" => Ok(TaskStatus::Rejected),
            "archived" => Ok(TaskStatus::Archived),
            _ => {
                debug!("Invalid task status value: {}", s);
                Err(format!("Invalid task status: {}", s))
            }
        }
    }
}

impl From<String> for TaskStatus {
    fn from(s: String) -> Self {
        debug!("Converting string to TaskStatus: {}", s);
        TaskStatus::from_str(&s).unwrap_or(TaskStatus::Todo)
    }
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize, Type)]
#[sqlx(type_name = "task_priority", rename_all = "lowercase")]
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

impl FromStr for TaskPriority {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        debug!("Parsing task priority from string: {}", s);
        match s.to_lowercase().as_str() {
            "low" => Ok(TaskPriority::Low),
            "medium" => Ok(TaskPriority::Medium),
            "high" => Ok(TaskPriority::High),
            "urgent" => Ok(TaskPriority::Urgent),
            "critical" => Ok(TaskPriority::Critical),
            _ => {
                debug!("Invalid task priority value: {}", s);
                Err(format!("Invalid task priority: {}", s))
            }
        }
    }
}

impl From<String> for TaskPriority {
    fn from(s: String) -> Self {
        debug!("Converting string to TaskPriority: {}", s);
        TaskPriority::from_str(&s).unwrap_or(TaskPriority::Low)
    }
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize, Type)]
#[sqlx(type_name = "task_progress_type", rename_all = "snake_case")]
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

impl FromStr for TaskProgressType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        debug!("Parsing task progress type from string: {}", s);
        match s.to_lowercase().as_str() {
            "study" => Ok(TaskProgressType::Study),
            "investigate" => Ok(TaskProgressType::Investigate),
            "code" => Ok(TaskProgressType::Code),
            "test" => Ok(TaskProgressType::Test),
            "review_code" => Ok(TaskProgressType::ReviewCode),
            "review_test_report" => Ok(TaskProgressType::ReviewTestReport),
            "release" => Ok(TaskProgressType::Release),
            _ => {
                debug!("Invalid task progress type value: {}", s);
                Err(format!("Invalid progress type: {}", s))
            }
        }
    }
}

impl From<String> for TaskProgressType {
    fn from(s: String) -> Self {
        debug!("Converting string to TaskProgressType: {}", s);
        TaskProgressType::from_str(&s).unwrap_or(TaskProgressType::Study)
    }
}

#[derive(InputObject)]
#[graphql(rename_fields = "camelCase")]
pub struct CreateTaskInput {
    pub project_id: ID,
    pub parent_task_id: Option<ID>,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub priority: TaskPriority,
    pub priority_order: i32,
    pub start_date: Option<DateTime<Utc>>,
    pub due_date: Option<DateTime<Utc>>,
    pub effort: Option<f64>,
    pub progress: Option<f64>,
    pub assignee_id: Option<ID>,
    pub type_: Option<String>,
    pub category: Option<String>,
    pub tags: Option<Vec<String>>,
    pub progress_type: Option<TaskProgressType>,
}

#[derive(InputObject)]
#[graphql(rename_fields = "camelCase")]
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
    pub progress: Option<f64>,
    pub assignee_id: Option<ID>,
    pub type_: Option<String>,
    pub category: Option<String>,
    pub tags: Option<Vec<String>>,
    pub progress_type: Option<TaskProgressType>,
    pub is_deleted: Option<bool>,
}

#[derive(InputObject)]
#[graphql(rename_fields = "camelCase")]
pub struct UpdateTaskStatusInput {
    pub task_id: ID,
    pub status: TaskStatus,
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
