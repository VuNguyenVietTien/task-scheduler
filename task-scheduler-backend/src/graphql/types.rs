use async_graphql::*;
use chrono::{DateTime, NaiveDate, Utc};
use serde_json::Value;
use uuid::Uuid;

use crate::graphql::types::project::{ProjectMember, ProjectPriority, ProjectStatus, ProjectVisibility, MemberRole, User};

#[derive(SimpleObject)]
pub struct Project {
    pub project_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub owner: User,
    pub created_by: User,
    pub priority: ProjectPriority,
    pub visibility: ProjectVisibility,
    pub tags: Option<Vec<String>>,
    pub progress: f64,
    pub category: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub icon_url: Option<String>,
    pub is_public: bool,
    pub status: ProjectStatus,
    pub member_count: i32,
    pub metadata: Option<Value>,
    pub user_role: Option<MemberRole>,
    pub members: Vec<ProjectMember>,
} 