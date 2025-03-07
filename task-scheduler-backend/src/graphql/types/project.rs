use async_graphql::*;
use chrono::{DateTime, NaiveDate, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Type;
use std::str::FromStr;
use uuid::Uuid;

#[derive(SimpleObject, Clone, Debug, Serialize, Deserialize)]
pub struct User {
    pub user_id: Uuid,
    pub email: String,
    pub username: Option<String>,
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
    pub bio: Option<String>,
    pub role: UserRole,
    pub provider: AuthProvider,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_login_at: Option<DateTime<Utc>>,
    pub work_capacity: Option<i32>,
    pub is_active: bool,
    pub is_verified: bool,
    pub password_hash: Option<String>,
    pub google_id: Option<String>,
    pub verification_token: Option<String>,
    pub verification_token_expires: Option<DateTime<Utc>>,
    pub reset_token: Option<String>,
    pub reset_token_expires: Option<DateTime<Utc>>,
    pub firebase_uid: Option<String>,
    pub metadata: Option<serde_json::Value>
}

#[derive(SimpleObject, Debug, Serialize, Deserialize)]
pub struct Project {
    pub project_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: Uuid,
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
    pub status: ProjectStatus
}

#[derive(SimpleObject, Debug, Serialize, Deserialize)] 
pub struct ProjectMember {
    pub member_id: Uuid,
    pub project_id: Uuid,
    pub user_id: Uuid,
    pub role: MemberRole,
    pub joined_at: DateTime<Utc>,
    pub invited_by: Option<Uuid>,
    pub email: String,
    pub full_name: Option<String>,
    pub username: Option<String>,
    pub avatar_url: Option<String>
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
    Viewer
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
pub struct CreateProjectInput {
    pub name: String,
    pub description: Option<String>,
    pub priority: ProjectPriority,
    pub visibility: ProjectVisibility,
    pub category: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub icon_url: Option<String>,
    pub is_public: bool,
    pub status: ProjectStatus,
    pub tags: Option<Vec<String>>,
    pub metadata: Option<serde_json::Value>
}

#[derive(InputObject)]
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