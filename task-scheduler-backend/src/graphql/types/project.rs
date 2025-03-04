use async_graphql::{InputObject, SimpleObject, ID, Enum};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;

#[derive(Enum, Copy, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub enum ProjectPriority {
    Low,
    Medium,
    High,
    Urgent
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub enum ProjectStatus {
    Active,
    OnHold,
    Completed,
    Cancelled
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub enum ProjectVisibility {
    Public,
    Private,
    Restricted
}

#[derive(SimpleObject)]
pub struct ProjectResponse {
    pub id: ID,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: ID,
    pub priority: ProjectPriority,
    pub visibility: ProjectVisibility,
    pub status: ProjectStatus,
    pub progress: i32,
    pub tags: Vec<String>,
    pub category: Option<String>,
    pub metadata: Option<JsonValue>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(InputObject)]
pub struct CreateProjectInput {
    pub name: String,
    pub description: Option<String>,
    pub priority: ProjectPriority,
    pub visibility: ProjectVisibility,
    pub category: Option<String>,
    pub tags: Vec<String>,
    pub metadata: Option<JsonValue>,
}

#[derive(InputObject)]
pub struct UpdateProjectInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub priority: Option<ProjectPriority>,
    pub visibility: Option<ProjectVisibility>,
    pub status: Option<ProjectStatus>,
    #[graphql(validator(minimum = 0, maximum = 100))]
    pub progress: Option<i32>,
    pub category: Option<String>,
    pub tags: Option<Vec<String>>,
    pub metadata: Option<JsonValue>,
}

impl From<crate::db::models::Project> for ProjectResponse {
    fn from(project: crate::db::models::Project) -> Self {
        Self {
            id: project.project_id.to_string().into(),
            name: project.name,
            description: project.description,
            owner_id: project.owner_id.to_string().into(),
            priority: match project.priority {
                crate::db::types::ProjectPriority::Low => ProjectPriority::Low,
                crate::db::types::ProjectPriority::Medium => ProjectPriority::Medium,
                crate::db::types::ProjectPriority::High => ProjectPriority::High,
                crate::db::types::ProjectPriority::Urgent => ProjectPriority::Urgent,
            },
            visibility: match project.visibility {
                crate::db::types::ProjectVisibility::Private => ProjectVisibility::Private,
                crate::db::types::ProjectVisibility::Restricted => ProjectVisibility::Restricted,
                crate::db::types::ProjectVisibility::Public => ProjectVisibility::Public,
            },
            status: match project.status {
                crate::db::types::ProjectStatus::OnHold => ProjectStatus::OnHold,
                crate::db::types::ProjectStatus::Completed => ProjectStatus::Completed,
                crate::db::types::ProjectStatus::Cancelled => ProjectStatus::Cancelled,
                crate::db::types::ProjectStatus::Active => ProjectStatus::Active,
            },
            progress: project.progress,
            tags: project.tags,
            category: project.category,
            metadata: project.metadata.map(|j| j.0),
            created_at: project.created_at,
            updated_at: project.updated_at,
        }
    }
}

impl From<CreateProjectInput> for crate::db::models::Project {
    fn from(input: CreateProjectInput) -> Self {
        use crate::db::types::{ProjectPriority, ProjectStatus, ProjectVisibility};
        
        Self {
            project_id: Uuid::new_v4(),
            name: input.name,
            description: input.description,
            owner_id: Uuid::new_v4(), // Will be set in resolver
            priority: match input.priority {
                ProjectPriority::Low => ProjectPriority::Low,
                ProjectPriority::Medium => ProjectPriority::Medium,
                ProjectPriority::High => ProjectPriority::High,
                ProjectPriority::Urgent => ProjectPriority::Urgent,
            },
            visibility: match input.visibility {
                ProjectVisibility::Private => ProjectVisibility::Private,
                ProjectVisibility::Restricted => ProjectVisibility::Restricted,
                ProjectVisibility::Public => ProjectVisibility::Public,
            },
            status: ProjectStatus::Active,
            progress: 0,
            tags: input.tags,
            category: input.category,
            metadata: input.metadata.map(sqlx::types::Json),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }
}
