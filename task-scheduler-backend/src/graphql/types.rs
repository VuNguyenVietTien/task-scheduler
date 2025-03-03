use async_graphql::*;
use chrono::{DateTime, FixedOffset};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::db::enums::{
    ProjectStatus, ProjectPriority, ProjectVisibility,
    TaskStatus, TaskPriority, MemberRole
};

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

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize)]
#[graphql(rename_items = "camelCase")] 
#[serde(rename_all = "camelCase")]
pub enum TaskStatusEnum {
    Backlog,
    Planned,
    InProgress,
    InReview,
    Done,
    Cancelled,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize)]
#[graphql(rename_items = "camelCase")]
#[serde(rename_all = "camelCase")]
pub enum TaskPriorityEnum {
    Low,
    Medium,
    High,
    Urgent,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize)]
#[graphql(rename_items = "camelCase")]
#[serde(rename_all = "camelCase")]
pub enum MemberRoleEnum {
    Owner,
    Manager,
    Editor,
    Viewer,
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

// Task Types
#[derive(SimpleObject)]
pub struct Task {
    pub id: ID,
    pub project_id: ID,
    pub title: String,
    pub description: String,
    pub status: TaskStatusEnum,
    pub priority: TaskPriorityEnum,
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
    pub title: String,
    pub description: String,
    pub status: Option<TaskStatusEnum>,
    pub priority: Option<TaskPriorityEnum>,
    pub effort_hours: Option<f64>,
    pub start_date: Option<DateTime<FixedOffset>>,
    pub deadline: Option<DateTime<FixedOffset>>,
}

#[derive(InputObject)]
pub struct UpdateTaskInput {
    pub title: String,
    pub description: String,
    pub status: Option<TaskStatusEnum>,
    pub priority: Option<TaskPriorityEnum>,
    pub effort_hours: Option<f64>,
    pub start_date: Option<DateTime<FixedOffset>>,
    pub deadline: Option<DateTime<FixedOffset>>,
}

// Member Types
#[derive(SimpleObject)]
pub struct ProjectMember {
    pub project_id: ID,
    pub user_id: ID,
    pub role: MemberRoleEnum,
    pub joined_at: DateTime<FixedOffset>,
}

#[derive(InputObject)]
pub struct AddProjectMemberInput {
    pub project_id: ID,
    pub user_id: ID,
    pub role: MemberRoleEnum,
}

#[derive(InputObject)]
pub struct UpdateMemberRoleInput {
    pub project_id: ID,
    pub user_id: ID,
    pub role: MemberRoleEnum,
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

impl From<TaskStatus> for TaskStatusEnum {
    fn from(status: TaskStatus) -> Self {
        match status {
            TaskStatus::Backlog => Self::Backlog,
            TaskStatus::Planned => Self::Planned,
            TaskStatus::InProgress => Self::InProgress,
            TaskStatus::InReview => Self::InReview,
            TaskStatus::Done => Self::Done,
            TaskStatus::Cancelled => Self::Cancelled,
        }
    }
}

impl From<TaskPriority> for TaskPriorityEnum {
    fn from(priority: TaskPriority) -> Self {
        match priority {
            TaskPriority::Low => Self::Low,
            TaskPriority::Medium => Self::Medium,
            TaskPriority::High => Self::High,
            TaskPriority::Urgent => Self::Urgent,
        }
    }
}

impl From<MemberRole> for MemberRoleEnum {
    fn from(role: MemberRole) -> Self {
        match role {
            MemberRole::Owner => Self::Owner,
            MemberRole::Manager => Self::Manager,
            MemberRole::Editor => Self::Editor,
            MemberRole::Viewer => Self::Viewer,
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

impl From<TaskStatusEnum> for TaskStatus {
    fn from(status: TaskStatusEnum) -> Self {
        match status {
            TaskStatusEnum::Backlog => Self::Backlog,
            TaskStatusEnum::Planned => Self::Planned,
            TaskStatusEnum::InProgress => Self::InProgress,
            TaskStatusEnum::InReview => Self::InReview,
            TaskStatusEnum::Done => Self::Done,
            TaskStatusEnum::Cancelled => Self::Cancelled,
        }
    }
}

impl From<TaskPriorityEnum> for TaskPriority {
    fn from(priority: TaskPriorityEnum) -> Self {
        match priority {
            TaskPriorityEnum::Low => Self::Low,
            TaskPriorityEnum::Medium => Self::Medium,
            TaskPriorityEnum::High => Self::High,
            TaskPriorityEnum::Urgent => Self::Urgent,
        }
    }
}

impl From<MemberRoleEnum> for MemberRole {
    fn from(role: MemberRoleEnum) -> Self {
        match role {
            MemberRoleEnum::Owner => Self::Owner,
            MemberRoleEnum::Manager => Self::Manager,
            MemberRoleEnum::Editor => Self::Editor,
            MemberRoleEnum::Viewer => Self::Viewer,
        }
    }
}
