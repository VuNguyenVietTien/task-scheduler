use async_graphql::*;
use chrono::{DateTime, Utc};
use log::debug;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::Type;
use std::fmt;
use std::str::FromStr;
use uuid::Uuid;

#[derive(SimpleObject, Debug, Clone, Serialize, Deserialize)]
#[graphql(rename_fields = "snake_case")]
pub struct Assignee {
    pub user_id: Uuid,
    pub full_name: Option<String>,
    pub username: String,
    pub avatar_url: Option<String>,
    pub role: Option<String>,
}

#[derive(SimpleObject, Debug, Clone, Serialize, Deserialize)]
#[graphql(rename_fields = "snake_case", complex)]
pub struct Task {
    pub task_id: Uuid,
    pub project_id: Uuid,
    pub parent_task_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub assignee: Option<Assignee>,
    /// Direct assignment to a resource member (may be an UNLINKED
    /// placeholder). Stable across user linking; scheduling key prefers it.
    pub assignee_resource_member_id: Option<Uuid>,
    pub priority_order: i32,
    pub start_date: Option<DateTime<Utc>>,
    pub due_date: Option<DateTime<Utc>>,
    pub actual_start_date: Option<DateTime<Utc>>,
    pub actual_end_date: Option<DateTime<Utc>>,
    pub effort: Option<f64>,
    pub progress: Option<f64>,
    pub created_by: Uuid,
    pub creator: Option<Assignee>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub is_deleted: Option<bool>,
    pub status: TaskStatus,
    pub priority: TaskPriority,
    #[graphql(name = "type_")]
    pub type_: Option<String>,
    pub category: Option<String>,
    /// Project-scoped taxonomy links (Task 1.3 contract): NULL = Unphased /
    /// uncategorised. Same-project validity enforced by set_task_taxonomy.
    pub phase_id: Option<Uuid>,
    pub category_id: Option<Uuid>,
    pub progress_catalog_item_id: Option<Uuid>,
    pub category_catalog_item_id: Option<Uuid>,
    pub task_type_catalog_item_id: Option<Uuid>,
    pub progress_type: Option<TaskProgressType>,
    pub tags: Option<JsonValue>,
    pub child_tasks: Option<Vec<Task>>,
}

/// D4 decision: expose BOTH `type_` (frontend/web-SDL) and `type` (plain alias).
#[ComplexObject]
impl Task {
    #[graphql(name = "type")]
    async fn type_alias(&self) -> Option<String> {
        self.type_.clone()
    }
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize, Type)]
#[sqlx(type_name = "task_status", rename_all = "UPPERCASE")]
pub enum TaskStatus {
    #[graphql(name = "TODO")]
    Todo,
    #[graphql(name = "DOING")]
    Doing,
    #[graphql(name = "DONE")]
    Done,
    #[graphql(name = "CLOSE")]
    Close,
    #[graphql(name = "PENDING")]
    Pending,
    #[graphql(name = "REVIEW")]
    Review,
    #[graphql(name = "BLOCKED")]
    Blocked,
    #[graphql(name = "REJECTED")]
    Rejected,
    #[graphql(name = "ARCHIVED")]
    Archived,
}

impl fmt::Display for TaskStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // Convert enum variant to lowercase string
        let s = match self {
            TaskStatus::Todo => "TODO",
            TaskStatus::Doing => "DOING",
            TaskStatus::Done => "DONE",
            TaskStatus::Close => "CLOSE",
            TaskStatus::Pending => "PENDING",
            TaskStatus::Review => "REVIEW",
            TaskStatus::Blocked => "BLOCKED",
            TaskStatus::Rejected => "REJECTED",
            TaskStatus::Archived => "ARCHIVED",
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
#[sqlx(type_name = "task_priority", rename_all = "UPPERCASE")]
pub enum TaskPriority {
    #[graphql(name = "LOW")]
    Low,
    #[graphql(name = "MEDIUM")]
    Medium,
    #[graphql(name = "HIGH")]
    High,
    #[graphql(name = "URGENT")]
    Urgent,
    #[graphql(name = "CRITICAL")]
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
    Release,
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
#[graphql(rename_fields = "snake_case")]
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
    /// Resource-member assignment; placeholder allowed before user link.
    pub assignee_resource_member_id: Option<ID>,
    #[graphql(name = "type_")]
    pub type_: Option<String>,
    pub category: Option<String>,
    pub tags: Option<Vec<String>>,
    pub progress_type: Option<TaskProgressType>,
    pub progress_catalog_item_id: Option<ID>,
    pub category_catalog_item_id: Option<ID>,
    pub task_type_catalog_item_id: Option<ID>,
}

#[derive(InputObject)]
#[graphql(rename_fields = "snake_case")]
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
    pub assignee_id: MaybeUndefined<ID>,
    pub assignee_resource_member_id: MaybeUndefined<ID>,
    pub parent_task_id: MaybeUndefined<ID>,
    #[graphql(name = "type_")]
    pub type_: Option<String>,
    pub category: Option<String>,
    pub tags: Option<Vec<String>>,
    pub progress_type: Option<TaskProgressType>,
    pub progress_catalog_item_id: MaybeUndefined<ID>,
    pub category_catalog_item_id: MaybeUndefined<ID>,
    pub task_type_catalog_item_id: MaybeUndefined<ID>,
    pub is_deleted: Option<bool>,
}

#[derive(InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct CloneTaskSubtreeInput {
    pub source_task_id: ID,
    pub selected_descendant_ids: Vec<ID>,
    pub quantity: i32,
    pub destination_parent_task_id: Option<ID>,
    pub clone_without_parent: Option<bool>,
}

#[derive(SimpleObject)]
#[graphql(rename_fields = "snake_case")]
pub struct CloneTaskSubtreePayload {
    pub root_task_ids: Vec<ID>,
    pub created_task_ids: Vec<ID>,
}

#[derive(InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct UpdateTaskStatusInput {
    pub task_id: ID,
    #[graphql(validator(custom = "validate_task_status"))]
    pub status: String,
}

fn validate_task_status(status: &String) -> Result<(), String> {
    match status.to_lowercase().as_str() {
        "todo" | "doing" | "done" | "close" | "pending" | "review" | "blocked" | "rejected"
        | "archived" => Ok(()),
        _ => Err(format!("Invalid task status: {}", status)),
    }
}

#[derive(InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct ReorderTasksInput {
    pub project_id: ID,
    pub tasks: Vec<TaskOrderInput>,
    /// Full current order; omitted by legacy clients for serialized last-writer behavior.
    pub expected_order: Option<Vec<ID>>,
}

#[derive(InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct TaskOrderInput {
    pub task_id: ID,
    pub priority_order: i32,
}
