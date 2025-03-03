use async_graphql::*;
use chrono::{DateTime, FixedOffset};
use serde::{Deserialize, Serialize};

// Task Types
#[derive(SimpleObject)]
pub struct Task {
    pub id: ID,
    pub project_id: ID,
    pub parent_task_id: Option<ID>,
    pub title: String,
    pub description: String,
    pub status: String,
    pub priority: i32,
    pub effort_hours: Option<f64>,
    pub start_date: Option<DateTime<FixedOffset>>,
    pub deadline: Option<DateTime<FixedOffset>>,
    pub created_by: ID,
    pub created_at: DateTime<FixedOffset>,
    pub updated_at: DateTime<FixedOffset>,
}

#[derive(InputObject)]
pub struct CreateTaskInput {
    pub project_id: ID,
    pub parent_task_id: Option<ID>,
    pub title: String,
    pub description: String,
    pub status: String,
    pub priority: i32,
    pub effort_hours: Option<f64>,
    pub start_date: Option<DateTime<FixedOffset>>,
    pub deadline: Option<DateTime<FixedOffset>>,
}

#[derive(InputObject)]
pub struct TaskOrderInput {
    pub task_id: ID,
    pub position: i32,
}

#[derive(InputObject)]
pub struct ReorderTasksInput {
    pub task_orders: Vec<TaskOrderInput>,
}

// Project Types
#[derive(SimpleObject)]
pub struct Project {
    pub id: ID,
    pub name: String,
    pub description: String,
    pub created_by: ID,
    pub created_at: DateTime<FixedOffset>,
    pub updated_at: DateTime<FixedOffset>,
}

#[derive(InputObject)]
pub struct CreateProjectInput {
    pub name: String,
    pub description: String,
}

#[derive(InputObject)]
pub struct UpdateProjectInput {
    pub name: String,
    pub description: String,
}

#[derive(SimpleObject)]
pub struct ProjectMember {
    pub project_id: ID,
    pub user_id: ID,
    pub role: String,
    pub joined_at: DateTime<FixedOffset>,
}

#[derive(InputObject)]
pub struct AddProjectMemberInput {
    pub project_id: ID,
    pub user_id: ID,
    pub role: String,
}

// Comment Types
#[derive(SimpleObject)]
pub struct Comment {
    pub id: ID,
    pub task_id: ID,
    pub user_id: ID,
    pub parent_comment_id: Option<ID>,
    pub content: String,
    pub created_at: DateTime<FixedOffset>,
    pub updated_at: DateTime<FixedOffset>,
}

#[derive(InputObject)]
pub struct CreateCommentInput {
    pub task_id: ID,
    pub parent_comment_id: Option<ID>,
    pub content: String,
}

// Attachment Types
#[derive(SimpleObject)]
pub struct Attachment {
    pub id: ID,
    pub task_id: ID,
    pub user_id: ID,
    pub file_name: String,
    pub file_size: i64,
    pub mime_type: String,
    pub storage_path: String,
    pub created_at: DateTime<FixedOffset>,
}

// Notification Types
#[derive(SimpleObject)]
pub struct Notification {
    pub id: ID,
    pub user_id: ID,
    pub type_: String,
    pub content: serde_json::Value,
    pub created_at: DateTime<FixedOffset>,
    pub read_at: Option<DateTime<FixedOffset>>,
}

// User Types
#[derive(SimpleObject, Serialize, Deserialize)]
pub struct User {
    pub id: ID,
    pub email: String,
    pub name: String,
    pub role: String,
    pub created_at: DateTime<FixedOffset>,
    pub updated_at: DateTime<FixedOffset>,
}
