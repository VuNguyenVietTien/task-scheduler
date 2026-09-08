use async_graphql::*;
use chrono::{DateTime, NaiveDate, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::Type;
use std::str::FromStr;
use uuid::Uuid;

#[derive(SimpleObject, Clone, Debug, Serialize, Deserialize)]
#[graphql(rename_fields = "snake_case")]
pub struct User {
    pub user_id: Uuid,
    pub email: String,
    pub username: Option<String>,
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(SimpleObject, Debug, Serialize, Deserialize)]
#[graphql(rename_fields = "snake_case")]
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
    pub created_by: Option<User>,
    pub user_role: Option<MemberRole>,
    pub members: Vec<ProjectMember>,
}

#[derive(SimpleObject)]
#[graphql(rename_fields = "snake_case")]
pub struct Projects {
    pub project_id: Uuid,
    pub name: String,
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
    pub status: ProjectStatus,
    pub member_count: i64,
    pub progress: f64, // Changed from i32 to f64
    pub category: Option<String>,
    pub priority: ProjectPriority,
    pub visibility: ProjectVisibility,
    pub icon_url: Option<String>,
    pub owner: User,
    pub user_role: MemberRole,
}

#[derive(SimpleObject, Debug)]
#[graphql(rename_fields = "snake_case")]
pub struct ProjectResponse {
    pub projectId: Uuid,               // NO NULL
    pub name: String,                  // NO NULL
    pub description: Option<String>,   // YES NULL
    pub startDate: Option<NaiveDate>,  // YES NULL
    pub endDate: Option<NaiveDate>,    // YES NULL
    pub status: ProjectStatus,         // NO NULL
    pub owner: User,                   // owner_id NO NULL
    pub progress: f64,                 // NO NULL
    pub category: Option<String>,      // YES NULL
    pub priority: ProjectPriority,     // NO NULL
    pub visibility: ProjectVisibility, // NO NULL
    pub iconUrl: Option<String>,       // YES NULL
    pub createdAt: DateTime<Utc>,      // NO NULL
    pub metadata: Option<Value>,       // YES NULL
    pub isPublic: bool,                // NO NULL
    pub tags: Option<Vec<String>>,     // YES NULL
    pub members: Vec<ProjectMember>,   // Related table
}

#[derive(SimpleObject, Debug, Clone, Serialize, Deserialize)]
#[graphql(rename_fields = "snake_case")]
pub struct ProjectMember {
    pub role: MemberRole,
    pub joined_at: Option<DateTime<Utc>>,
    pub user: User,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize, Type)]
#[sqlx(rename_all = "lowercase", type_name = "project_priority")]
pub enum ProjectPriority {
    Low,
    Medium,
    High,
    Urgent,
}

impl FromStr for ProjectPriority {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "low" => Ok(ProjectPriority::Low),
            "medium" => Ok(ProjectPriority::Medium),
            "high" => Ok(ProjectPriority::High),
            "urgent" => Ok(ProjectPriority::Urgent),
            _ => Err(format!("Invalid project priority: {}", s)),
        }
    }
}

impl From<String> for ProjectPriority {
    fn from(s: String) -> Self {
        ProjectPriority::from_str(&s).unwrap_or(ProjectPriority::Medium)
    }
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize, Type)]
#[sqlx(rename_all = "lowercase", type_name = "project_visibility")]
pub enum ProjectVisibility {
    Public,
    Private,
    Team,
}

impl FromStr for ProjectVisibility {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "public" => Ok(ProjectVisibility::Public),
            "private" => Ok(ProjectVisibility::Private),
            "team" => Ok(ProjectVisibility::Team),
            _ => Err(format!("Invalid project visibility: {}", s)),
        }
    }
}

impl From<String> for ProjectVisibility {
    fn from(s: String) -> Self {
        ProjectVisibility::from_str(&s).unwrap_or(ProjectVisibility::Private)
    }
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize, Type)]
#[sqlx(rename_all = "lowercase", type_name = "project_status")]
pub enum ProjectStatus {
    Active,
    Completed,
    OnHold,
    Cancelled,
}

impl FromStr for ProjectStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "active" => Ok(ProjectStatus::Active),
            "completed" => Ok(ProjectStatus::Completed),
            "on_hold" => Ok(ProjectStatus::OnHold),
            "cancelled" => Ok(ProjectStatus::Cancelled),
            _ => Err(format!("Invalid project status: {}", s)),
        }
    }
}

impl From<String> for ProjectStatus {
    fn from(s: String) -> Self {
        ProjectStatus::from_str(&s).unwrap_or(ProjectStatus::Active)
    }
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize, Type)]
#[sqlx(rename_all = "lowercase", type_name = "member_role")]
pub enum MemberRole {
    #[graphql(name = "manager")]
    Manager,
    #[graphql(name = "leader")]
    Leader,
    #[graphql(name = "member")]
    Member,
    #[graphql(name = "guest")]
    Guest,
}

impl MemberRole {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Manager => "manager",
            Self::Leader => "leader",
            Self::Member => "member",
            Self::Guest => "guest",
        }
    }

    /// Read the text projection of a stored role without changing its DB value.
    /// Unknown, NULL or missing columns are errors, never a default access grant.
    pub fn from_database_row(row: &sqlx::postgres::PgRow) -> Result<Self> {
        use sqlx::Row;
        row.try_get::<String, _>("role")?
            .parse()
            .map_err(Error::new)
    }

    pub fn from_str_case_insensitive(s: &str) -> Option<Self> {
        let lowercase = s.to_lowercase();
        match lowercase.as_str() {
            "manager" | "admin" => Some(MemberRole::Manager),
            "leader" => Some(MemberRole::Leader),
            "member" => Some(MemberRole::Member),
            "guest" | "viewer" => Some(MemberRole::Guest),
            _ => None,
        }
    }

    /// Returns true if this role can be assigned tasks
    pub fn can_be_assigned(&self) -> bool {
        !matches!(self, MemberRole::Guest)
    }
}

impl FromStr for MemberRole {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        MemberRole::from_str_case_insensitive(s)
            .ok_or_else(|| format!("Invalid member role: {}", s))
    }
}

impl From<String> for MemberRole {
    fn from(s: String) -> Self {
        MemberRole::from_str(&s).unwrap_or(MemberRole::Member)
    }
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, Serialize, Deserialize, Type)]
#[sqlx(rename_all = "lowercase", type_name = "user_role")]
pub enum UserRole {
    Admin,
    User,
}

impl FromStr for UserRole {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "admin" => Ok(UserRole::Admin),
            "user" => Ok(UserRole::User),
            _ => Err("Invalid user role".into()),
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
    Github,
}

impl FromStr for AuthProvider {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "email" => Ok(AuthProvider::Email),
            "google" => Ok(AuthProvider::Google),
            "github" => Ok(AuthProvider::Github),
            _ => Err("Invalid auth provider".into()),
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
#[graphql(rename_fields = "snake_case")]
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
    pub metadata: Option<serde_json::Value>,
}

#[derive(InputObject)]
#[graphql(rename_fields = "snake_case")]
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
    pub metadata: Option<serde_json::Value>,
}

#[derive(InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct AddProjectMemberInput {
    pub project_id: String,
    pub user_id: String,
    pub role: MemberRole,
}

#[derive(InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct UpdateProjectMemberInput {
    pub project_id: String,
    pub user_id: String,
    pub role: MemberRole,
}
