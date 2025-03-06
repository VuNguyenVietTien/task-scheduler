use async_graphql::*;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Type;
use uuid::Uuid;

// Auth Types
#[derive(InputObject)]
pub struct RegisterInput {
    pub email: String,
    pub password: String,
    pub name: String,
}

#[derive(InputObject)]
pub struct LoginInput {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub name: String,
}

#[Object]
impl User {
    async fn id(&self) -> ID { self.id.into() }
    async fn email(&self) -> &str { &self.email }
    async fn name(&self) -> &str { &self.name }
}

#[derive(SimpleObject)]
pub struct AuthPayload {
    pub access_token: String,
    pub refresh_token: String, 
    pub user: User,
}

#[derive(Debug, Copy, Clone, Eq, PartialEq, Serialize, Deserialize, Type, Enum)]
#[sqlx(type_name = "project_status", rename_all = "lowercase")]
pub enum ProjectStatus {
    #[graphql(name = "active")]
    active,
    #[graphql(name = "completed")]
    completed,
    #[graphql(name = "on-hold")]
    on_hold,
    #[graphql(name = "cancelled")]
    cancelled
}

#[derive(Debug, Copy, Clone, Eq, PartialEq, Serialize, Deserialize, Type, Enum)]
#[sqlx(type_name = "member_role")]
pub enum MemberRole {
    #[graphql(name = "admin")]
    admin,
    #[graphql(name = "member")]
    member,
    #[graphql(name = "viewer")]
    miewer,
}

#[derive(InputObject, Debug, Serialize, Deserialize)]
pub struct ProjectMemberInput {
    pub user_id: Uuid,
    pub role: MemberRole,
}

#[derive(InputObject, Debug, Serialize, Deserialize)]
pub struct CreateProjectInput {
    pub name: String,
    pub description: Option<String>,
    pub ownerId: Uuid,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub members: Vec<ProjectMemberInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMember {
    pub id: Uuid,
    pub user_id: Uuid,
    pub project_id: Uuid,
    pub role: MemberRole,
    pub user: Option<User>,
}

#[Object]
impl ProjectMember {
    async fn id(&self) -> ID { self.id.into() }
    async fn user_id(&self) -> ID { self.user_id.into() }
    async fn project_id(&self) -> ID { self.project_id.into() }
    async fn role(&self) -> MemberRole { self.role }
    async fn user(&self) -> &Option<User> { &self.user }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
    pub status: ProjectStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub members: Vec<ProjectMember>,
}

#[Object]
impl Project {
    async fn id(&self) -> ID { self.id.into() }
    async fn name(&self) -> &str { &self.name }
    async fn description(&self) -> &Option<String> { &self.description }
    async fn start_date(&self) -> DateTime<Utc> { self.start_date }
    async fn end_date(&self) -> DateTime<Utc> { self.end_date }
    async fn status(&self) -> ProjectStatus { self.status }
    async fn created_at(&self) -> DateTime<Utc> { self.created_at }
    async fn updated_at(&self) -> DateTime<Utc> { self.updated_at }
    async fn members(&self) -> &[ProjectMember] { &self.members }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>, 
    pub status: ProjectStatus,
    pub members: Vec<ProjectMember>,
}

#[Object]
impl ProjectResponse {
    async fn id(&self) -> ID { self.id.into() }
    async fn name(&self) -> &str { &self.name }
    async fn description(&self) -> &Option<String> { &self.description }
    async fn start_date(&self) -> DateTime<Utc> { self.start_date }
    async fn end_date(&self) -> DateTime<Utc> { self.end_date }
    async fn status(&self) -> ProjectStatus { self.status }
    async fn members(&self) -> &[ProjectMember] { &self.members }
}