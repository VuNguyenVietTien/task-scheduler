use async_graphql::*;
use chrono::{DateTime, FixedOffset};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::db::enums::{ProjectStatus, ProjectPriority, ProjectVisibility};

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize)]
#[graphql(rename_items = "camelCase")]
#[serde(rename_all = "camelCase")]
pub enum ProjectStatusEnum {
    NotStarted,
    InProgress,
    OnHold,
    Completed,
    Cancelled,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize)]
#[graphql(rename_items = "camelCase")]
#[serde(rename_all = "camelCase")]
pub enum ProjectPriorityEnum {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize)]
#[graphql(rename_items = "camelCase")]
#[serde(rename_all = "camelCase")]
pub enum ProjectVisibilityEnum {
    Private,
    Team,
    Public,
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
    pub status: ProjectStatusEnum,
    pub priority: ProjectPriorityEnum,
    pub category: Option<String>,
    pub metadata: Option<Json<JsonValue>>,
    pub visibility: ProjectVisibilityEnum,
    pub tags: Option<Json<JsonValue>>,
    pub progress: f32,
}

#[derive(InputObject)]
pub struct CreateProjectInput {
    pub name: String,
    pub description: String,
    pub status: Option<ProjectStatusEnum>,
    pub priority: Option<ProjectPriorityEnum>,
    pub category: Option<String>,
    pub visibility: Option<ProjectVisibilityEnum>,
}

#[derive(InputObject)]
pub struct UpdateProjectInput {
    pub name: String,
    pub description: String,
    pub status: Option<ProjectStatusEnum>,
    pub priority: Option<ProjectPriorityEnum>,
    pub category: Option<String>,
    pub visibility: Option<ProjectVisibilityEnum>,
    pub progress: Option<f32>,
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
    pub content: Json<JsonValue>,
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

// Extensions
impl From<ProjectStatus> for ProjectStatusEnum {
    fn from(status: ProjectStatus) -> Self {
        match status {
            ProjectStatus::NotStarted => Self::NotStarted,
            ProjectStatus::InProgress => Self::InProgress,
            ProjectStatus::OnHold => Self::OnHold,
            ProjectStatus::Completed => Self::Completed,
            ProjectStatus::Cancelled => Self::Cancelled,
        }
    }
}

impl From<ProjectPriority> for ProjectPriorityEnum {
    fn from(priority: ProjectPriority) -> Self {
        match priority {
            ProjectPriority::Low => Self::Low,
            ProjectPriority::Medium => Self::Medium,
            ProjectPriority::High => Self::High,
            ProjectPriority::Critical => Self::Critical,
        }
    }
}

impl From<ProjectVisibility> for ProjectVisibilityEnum {
    fn from(visibility: ProjectVisibility) -> Self {
        match visibility {
            ProjectVisibility::Private => Self::Private,
            ProjectVisibility::Team => Self::Team,
            ProjectVisibility::Public => Self::Public,
        }
    }
}

impl From<ProjectStatusEnum> for ProjectStatus {
    fn from(status: ProjectStatusEnum) -> Self {
        match status {
            ProjectStatusEnum::NotStarted => Self::NotStarted,
            ProjectStatusEnum::InProgress => Self::InProgress,
            ProjectStatusEnum::OnHold => Self::OnHold,
            ProjectStatusEnum::Completed => Self::Completed,
            ProjectStatusEnum::Cancelled => Self::Cancelled,
        }
    }
}

impl From<ProjectPriorityEnum> for ProjectPriority {
    fn from(priority: ProjectPriorityEnum) -> Self {
        match priority {
            ProjectPriorityEnum::Low => Self::Low,
            ProjectPriorityEnum::Medium => Self::Medium,
            ProjectPriorityEnum::High => Self::High,
            ProjectPriorityEnum::Critical => Self::Critical,
        }
    }
}

impl From<ProjectVisibilityEnum> for ProjectVisibility {
    fn from(visibility: ProjectVisibilityEnum) -> Self {
        match visibility {
            ProjectVisibilityEnum::Private => Self::Private,
            ProjectVisibilityEnum::Team => Self::Team,
            ProjectVisibilityEnum::Public => Self::Public,
        }
    }
}
