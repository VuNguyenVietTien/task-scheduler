use async_graphql::*;
use chrono::{DateTime, NaiveDate, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Type;
use std::str::FromStr;
use uuid::Uuid;
use serde_json::Value;

#[derive(SimpleObject, Clone, Debug, Serialize, Deserialize)]
#[graphql(rename_fields = "camelCase")]
pub struct User {
    pub user_id: Uuid,
    pub email: String,
    pub username: Option<String>,
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(SimpleObject, Debug, Serialize, Deserialize)]
#[graphql(rename_fields = "camelCase")]
pub struct Project {
    pub project_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub priority: ProjectPriority,
    pub visibility: ProjectVisibility,
    pub tags: Option<Vec<String>>,
    pub progress: f64,
    pub category: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub icon_url: Option<String>,
    pub is_public: bool,
    pub status: ProjectStatus,
    pub member_count: i64,
    pub owner: User,
    pub members: Vec<ProjectMember>,
}

#[derive(SimpleObject)]
#[graphql(rename_fields = "camelCase")]
pub struct Projects {
    pub project_id: Uuid,
    pub name: String,
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
    pub status: ProjectStatus,
    pub member_count: i64,
    pub progress: f64, // Changed from i32 to f64
    pub category: String,
    pub priority: ProjectPriority,
    pub visibility: ProjectVisibility,
    pub icon_url: Option<String>,
    pub owner: User,
}

#[derive(SimpleObject, Debug)]
#[graphql(rename_fields = "camelCase")]
pub struct ProjectResponse {
    pub projectId: Uuid,                     // NO NULL
    pub name: String,                         // NO NULL
    pub description: Option<String>,          // YES NULL
    pub startDate: Option<NaiveDate>,        // YES NULL
    pub endDate: Option<NaiveDate>,          // YES NULL
    pub status: ProjectStatus,                // NO NULL
    pub owner: User,                          // owner_id NO NULL
    pub progress: f64,                        // NO NULL
    pub category: Option<String>,             // YES NULL
    pub priority: ProjectPriority,            // NO NULL
    pub visibility: ProjectVisibility,        // NO NULL
    pub iconUrl: Option<String>,              // YES NULL
    pub createdAt: DateTime<Utc>,            // NO NULL
    pub metadata: Option<Value>,              // YES NULL
    pub isPublic: bool,                       // NO NULL
    pub tags: Option<Vec<String>>,           // YES NULL
    pub members: Vec<ProjectMember>,          // Related table
}

#[derive(SimpleObject, Debug, Clone, Serialize, Deserialize)]
#[graphql(rename_fields = "camelCase")]
pub struct ProjectMember {
    pub user_id: Uuid,
    pub role: MemberRole,
    pub username: String,
    pub avatar_url: String,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize, Type)]
#[sqlx(rename_all = "lowercase", type_name = "project_priority")]
pub enum ProjectPriority {
    Low,
    Medium, 
    High,
    Urgent
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize, Type)]
#[sqlx(rename_all = "lowercase", type_name = "project_visibility")]
pub enum ProjectVisibility {
    Public,
    Private,
    Team
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize, Type)]
#[sqlx(rename_all = "lowercase", type_name = "project_status")]
pub enum ProjectStatus {
    Active,
    Completed,
    OnHold,
    Cancelled
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize, Type)]
#[sqlx(rename_all = "lowercase", type_name = "member_role")]
pub enum MemberRole {
    Admin,
    Member,
    Viewer,
    Guest,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize, Type)]
#[sqlx(rename_all = "lowercase", type_name = "user_role")]
pub enum UserRole {
    Admin,
    User
}

impl FromStr for UserRole {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "admin" => Ok(UserRole::Admin),
            "user" => Ok(UserRole::User),
            _ => Err("Invalid user role".into())
        }
    }
}

impl From<String> for UserRole {
    fn from(s: String) -> Self {
        UserRole::from_str(&s).unwrap_or(UserRole::User)
    }
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize, Type)]
#[sqlx(rename_all = "lowercase", type_name = "auth_provider")]
pub enum AuthProvider {
    Email,
    Google,
    Github
}

impl FromStr for AuthProvider {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "email" => Ok(AuthProvider::Email),
            "google" => Ok(AuthProvider::Google),
            "github" => Ok(AuthProvider::Github),
            _ => Err("Invalid auth provider".into())
        }
    }
}

impl From<String> for AuthProvider {
    fn from(s: String) -> Self {
        AuthProvider::from_str(&s).unwrap_or(AuthProvider::Email)
    }
}

// Input types
#[derive(InputObject)]
#[graphql(rename_fields = "camelCase")]
pub struct CreateProjectInput {
    pub name: String,
    pub description: Option<String>,
    pub priority: Option<ProjectPriority>,
    pub visibility: Option<ProjectVisibility>,
    pub tags: Option<Vec<String>>,
    pub status: Option<ProjectStatus>,
    pub category: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub icon_url: Option<String>,
    pub metadata: Option<serde_json::Value>
}

#[derive(InputObject)]
#[graphql(rename_fields = "camelCase")]
pub struct UpdateProjectInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub priority: Option<ProjectPriority>,
    pub visibility: Option<ProjectVisibility>,
    pub category: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub icon_url: Option<String>,
    pub is_public: Option<bool>,
    pub status: Option<ProjectStatus>,
    pub tags: Option<Vec<String>>,
    pub metadata: Option<serde_json::Value>
}

#[derive(InputObject)]
pub struct AddProjectMemberInput {
    pub project_id: String,
    pub user_id: String,
    pub role: MemberRole
}

#[derive(InputObject)]
pub struct UpdateProjectMemberInput {
    pub project_id: String,
    pub user_id: String,
    pub role: MemberRole
}
