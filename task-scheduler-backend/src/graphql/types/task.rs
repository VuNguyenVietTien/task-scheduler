use async_graphql::*;
use chrono::{DateTime, Utc};
use serde_json::Value as JsonValue;
use uuid::Uuid;

#[derive(Enum, Copy, Clone, Eq, PartialEq)]
pub enum TaskStatus {
    Todo,
    InProgress,
    InReview,
    Done,
    Blocked,
    Cancelled
}

#[derive(Enum, Copy, Clone, Eq, PartialEq)]
pub enum TaskPriority {
    Low,
    Medium,
    High,
    Urgent
}

#[derive(SimpleObject)]
pub struct Task {
    pub id: ID,
    pub project_id: ID,
    pub parent_task_id: Option<ID>,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub priority: TaskPriority,
    pub assignee_id: Option<ID>,
    pub priority_order: i32,
    #[graphql(validator(minimum = 0.0))]
    pub effort: Option<f64>,
    #[graphql(validator(minimum = 0, maximum = 100))]
    pub progress: i32,
    pub start_date: Option<DateTime<Utc>>,
    pub due_date: Option<DateTime<Utc>>,
    pub actual_start_date: Option<DateTime<Utc>>,
    pub actual_end_date: Option<DateTime<Utc>>,
    pub metadata: Option<JsonValue>,
    pub created_by: ID,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_deleted: bool,
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
    #[graphql(validator(minimum = 0.0))]
    pub effort: Option<f64>,
    pub start_date: Option<DateTime<Utc>>,
    pub due_date: Option<DateTime<Utc>>,
    pub assignee_ids: Option<Vec<ID>>,
    pub metadata: Option<JsonValue>
}

#[derive(InputObject)]
pub struct UpdateTaskInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<TaskStatus>,
    pub priority: Option<TaskPriority>,
    pub priority_order: Option<i32>,
    #[graphql(validator(minimum = 0.0))]
    pub effort: Option<f64>,
    #[graphql(validator(minimum = 0, maximum = 100))]
    pub progress: Option<i32>,
    pub start_date: Option<DateTime<Utc>>,
    pub due_date: Option<DateTime<Utc>>,
    pub actual_start_date: Option<DateTime<Utc>>,
    pub actual_end_date: Option<DateTime<Utc>>,
    pub assignee_ids: Option<Vec<ID>>,
    pub metadata: Option<JsonValue>
}

#[derive(InputObject)]
pub struct TaskOrder {
    pub task_id: ID,
    pub priority_order: i32
}

#[derive(InputObject)]
pub struct ReorderTasksInput {
    pub task_orders: Vec<TaskOrder>
}

impl From<crate::db::models::Task> for Task {
    fn from(task: crate::db::models::Task) -> Self {
        Self {
            id: task.task_id.to_string().into(),
            project_id: task.project_id.to_string().into(),
            parent_task_id: task.parent_task_id.map(|id| id.to_string().into()),
            title: task.title,
            description: task.description,
            status: match task.status_id.to_uppercase().as_str() {
                "IN_PROGRESS" => TaskStatus::InProgress,
                "IN_REVIEW" => TaskStatus::InReview,
                "DONE" => TaskStatus::Done,
                "BLOCKED" => TaskStatus::Blocked,
                "CANCELLED" => TaskStatus::Cancelled,
                "TODO" => TaskStatus::Todo,
                _ => panic!("Invalid task status: {}", task.status_id),
            },
            priority: match task.priority.to_uppercase().as_str() {
                "LOW" => TaskPriority::Low,
                "MEDIUM" => TaskPriority::Medium,
                "HIGH" => TaskPriority::High,
                "URGENT" => TaskPriority::Urgent,
                _ => panic!("Invalid task priority: {}", task.priority),
            },
            assignee_id: task.assignee_id.map(|id| id.to_string().into()),
            priority_order: task.priority_order,
            effort: task.effort,
            progress: task.progress,
            start_date: task.start_date,
            due_date: task.due_date,
            actual_start_date: task.actual_start_date,
            actual_end_date: task.actual_end_date,
            metadata: task.metadata.map(|j| j.0),
            created_by: task.created_by.to_string().into(),
            created_at: task.created_at,
            updated_at: task.updated_at,
            is_deleted: task.is_deleted,
        }
    }
}
