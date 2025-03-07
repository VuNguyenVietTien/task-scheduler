use async_graphql::*;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Type;
use std::fmt;
use uuid::Uuid;
use serde_json::Value as JsonValue;
use rust_decimal::Decimal;
use rust_decimal::prelude::*;

#[allow(unused_imports)]
use serde_json::json;

use crate::db::models;
use crate::db::ProjectPriority; 
use crate::db::ProjectVisibility;

// Auth Types
#[derive(InputObject)]
pub struct RegisterInput {
    pub email: String,
    pub password: String,
    pub username: Option<String>
}

#[derive(InputObject)]
pub struct LoginInput {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub user_id: Uuid,
    pub email: String,
    pub username: Option<String>,
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
}

#[Object]
impl User {
    async fn user_id(&self) -> ID { self.user_id.into() }
    async fn email(&self) -> String { self.email.clone() }
    async fn username(&self) -> String { self.username.clone().unwrap_or_default() }
    async fn full_name(&self) -> String { self.full_name.clone().unwrap_or_default() }
    async fn avatar_url(&self) -> String { self.avatar_url.clone().unwrap_or_default() }
}

#[derive(SimpleObject)]
pub struct AuthPayload {
    pub access_token: String,
    pub refresh_token: String, 
    pub user: User,
}

#[derive(Debug, Copy, Clone, Eq, PartialEq, Serialize, Deserialize, Type, Enum)]
#[sqlx(type_name = "project_status")]
pub enum ProjectStatus {
    #[graphql(name = "active")]
    active,
    #[graphql(name = "completed")]
    completed,
    #[graphql(name = "on_hold")]
    on_hold,
    #[graphql(name = "cancelled")]
    cancelled,
}

#[derive(Debug, Copy, Clone, Eq, PartialEq, Serialize, Deserialize, Type, Enum)]
#[sqlx(type_name = "member_role")]
pub enum MemberRole {
    #[graphql(name = "admin")]
    admin,
    #[graphql(name = "member")]
    member,
    #[graphql(name = "viewer")]
    viewer,
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
    pub user_id: Uuid,
    pub role: MemberRole,
    pub username: String,
    pub avatar_url: String,
    
}

#[Object]
impl ProjectMember {
    async fn user_id(&self) -> ID { self.user_id.into() }
    async fn role(&self) -> MemberRole { self.role }
    async fn username(&self) -> String { self.username.clone() }
    async fn avatar_url(&self) -> String { self.avatar_url.clone() }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Projects {
    pub project_id: Uuid,
    pub name: String,
    pub member_count: i64,
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
    pub status: ProjectStatus,
    pub owner: User,
    pub progress: f64,
    pub category: String,
    pub priority: ProjectPriority,
    pub visibility: ProjectVisibility,
    pub icon_url: Option<String>
}

#[Object]
impl Projects {
    async fn project_id(&self) -> ID { self.project_id.into() }
    async fn name(&self) -> &str { &self.name }
    async fn member_count(&self) -> i64 { self.member_count }
    async fn start_date(&self) -> DateTime<Utc> { self.start_date }
    async fn end_date(&self) -> DateTime<Utc> { self.end_date }
    async fn status(&self) -> ProjectStatus { self.status }
    async fn owner(&self) -> &User { &self.owner }
    async fn progress(&self) -> f64 { self.progress }
    async fn category(&self) -> &str { &self.category }
    async fn priority(&self) -> ProjectPriority { self.priority }
    async fn visibility(&self) -> ProjectVisibility { self.visibility }
    async fn icon_url(&self) -> &Option<String> { &self.icon_url }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub project_id: Uuid,
    pub name: String,
    pub members: Vec<ProjectMember>,
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
    pub status: ProjectStatus,
    pub owner: User,
    pub progress: f64,
    pub category: String,
    pub priority: ProjectPriority,
    pub visibility: ProjectVisibility,
    pub icon_url: Option<String>,
    pub tags: Vec<String>,
    pub metadata: JsonValue,
    pub is_public: bool,
    pub created_at: DateTime<Utc>,
    pub description: Option<String>,
    pub updated_at: Option<DateTime<Utc>>,
    pub member_count: i64,
}

#[Object]
impl Project {
    async fn project_id(&self) -> ID { self.project_id.into() }
    async fn name(&self) -> &str { &self.name }
    async fn members(&self) -> &Vec<ProjectMember> { &self.members }
    async fn start_date(&self) -> DateTime<Utc> { self.start_date }
    async fn end_date(&self) -> DateTime<Utc> { self.end_date }
    async fn status(&self) -> ProjectStatus { self.status }
    async fn owner(&self) -> &User { &self.owner }
    async fn progress(&self) -> f64 { self.progress }
    async fn category(&self) -> &str { &self.category }
    async fn priority(&self) -> ProjectPriority { self.priority }
    async fn visibility(&self) -> ProjectVisibility { self.visibility }
    async fn icon_url(&self) -> &Option<String> { &self.icon_url }
    async fn tags(&self) -> &Vec<String> { &self.tags }
    async fn metadata(&self) -> &JsonValue { &self.metadata }
    async fn is_public(&self) -> bool { self.is_public }
    async fn created_at(&self) -> DateTime<Utc> { self.created_at }
    async fn description(&self) -> &Option<String> { &self.description }
    async fn updated_at(&self) -> &Option<DateTime<Utc>> { &self.updated_at }
    async fn member_count(&self) -> i64 { self.member_count }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectResponse {
    pub project_id: Uuid,
    pub name: String,
    pub members: Vec<ProjectMember>,
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
    pub status: ProjectStatus,
    pub owner: User,
    pub progress: f64,
    pub category: String,
    pub priority: ProjectPriority,
    pub visibility: ProjectVisibility,
    pub icon_url: Option<String>,
    pub tags: Vec<String>,
    pub metadata: JsonValue,
    pub is_public: bool,
    pub created_at: DateTime<Utc>,
    pub description: Option<String>,
}

#[Object]
impl ProjectResponse {
    async fn project_id(&self) -> ID { self.project_id.into() }
    async fn name(&self) -> &str { &self.name }
    async fn description(&self) -> &Option<String> { &self.description }
    async fn start_date(&self) -> DateTime<Utc> { self.start_date }
    async fn end_date(&self) -> DateTime<Utc> { self.end_date }
    async fn status(&self) -> ProjectStatus { self.status }
    async fn owner(&self) -> &User { &self.owner }
    async fn progress(&self) -> f64 { self.progress }
    async fn category(&self) -> &str { &self.category }
    async fn priority(&self) -> ProjectPriority { self.priority }
    async fn visibility(&self) -> ProjectVisibility { self.visibility }
    async fn icon_url(&self) -> &Option<String> { &self.icon_url }
    async fn tags(&self) -> &Vec<String> { &self.tags }
    async fn metadata(&self) -> &JsonValue { &self.metadata }
    async fn is_public(&self) -> bool { self.is_public }
    async fn created_at(&self) -> DateTime<Utc> { self.created_at }
    async fn members(&self) -> Vec<&ProjectMember> { self.members.iter().collect() }
}

#[derive(Debug, Copy, Clone, Eq, PartialEq, Serialize, Deserialize, Type, Enum)]
#[sqlx(type_name = "task_status")]
pub enum TaskStatus {
    #[graphql(name = "todo")]
    todo,
    #[graphql(name = "doing")]
    doing,
    #[graphql(name = "done")]
    done,
    #[graphql(name = "close")]
    close,    
    #[graphql(name = "pending")]
    pending,
    #[graphql(name = "review")]
    review,
    #[graphql(name = "blocked")]
    blocked,
    #[graphql(name = "rejected")]
    rejected,
    #[graphql(name = "archived")]
    archived,
}

impl fmt::Display for TaskStatus {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            TaskStatus::todo => write!(f, "todo"),
            TaskStatus::doing => write!(f, "doing"),
            TaskStatus::done => write!(f, "done"),
            TaskStatus::close => write!(f, "close"),
            TaskStatus::pending => write!(f, "pending"),
            TaskStatus::review => write!(f, "review"),
            TaskStatus::blocked => write!(f, "blocked"),
            TaskStatus::rejected => write!(f, "rejected"),
            TaskStatus::archived => write!(f, "archived"),
        }
    }
}

#[derive(Debug, Copy, Clone, Eq, PartialEq, Serialize, Deserialize, Type, Enum)]
#[sqlx(type_name = "task_priority")]
pub enum TaskPriority {
    #[graphql(name = "high")]
    high,
    #[graphql(name = "medium")]
    medium,
    #[graphql(name = "low")]
    low,
    #[graphql(name = "urgent")]
    urgent,
    #[graphql(name = "critical")]
    critical,
}

#[derive(InputObject)]
pub struct TaskAssignment {
    pub user_id: ID,
    pub assigned_at: DateTime<Utc>,
}

#[derive(SimpleObject)]
pub struct TaskAssignee {
    pub assignment_id: ID,
    pub task_id: ID,
    pub user_id: ID,
    pub assigned_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub task_id: Uuid,
    pub project_id: Uuid,
    pub parent_task_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>, 
    pub assignee_id: Option<Uuid>,
    pub status: TaskStatus,
    pub priority_order: i32,
    pub priority: TaskPriority,
    pub start_date: Option<DateTime<Utc>>,
    pub due_date: Option<DateTime<Utc>>,
    pub actual_start_date: Option<DateTime<Utc>>,
    pub actual_end_date: Option<DateTime<Utc>>,
    pub effort: Option<Decimal>,
    pub progress: i32,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_deleted: bool,
}

#[Object]
impl Task {
    async fn task_id(&self) -> ID { self.task_id.into() }
    async fn project_id(&self) -> ID { self.project_id.into() }
    async fn parent_task_id(&self) -> Option<ID> { self.parent_task_id.map(|id| id.into()) }
    async fn title(&self) -> &str { &self.title }
    async fn description(&self) -> &Option<String> { &self.description }
    async fn assignee_id(&self) -> Option<ID> { self.assignee_id.map(|id| id.into()) }
    async fn status(&self) -> TaskStatus { self.status }
    async fn priority_order(&self) -> i32 { self.priority_order }
    async fn priority(&self) -> TaskPriority { self.priority }
    async fn start_date(&self) -> Option<DateTime<Utc>> { self.start_date }
    async fn due_date(&self) -> Option<DateTime<Utc>> { self.due_date }
    async fn actual_start_date(&self) -> Option<DateTime<Utc>> { self.actual_start_date }
    async fn actual_end_date(&self) -> Option<DateTime<Utc>> { self.actual_end_date }
    async fn effort(&self) -> Option<f64> { self.effort.map(|e| e.to_f64().unwrap_or(0.0)) }
    async fn progress(&self) -> i32 { self.progress }
    async fn created_by(&self) -> ID { self.created_by.into() }
    async fn created_at(&self) -> DateTime<Utc> { self.created_at }
    async fn updated_at(&self) -> DateTime<Utc> { self.updated_at }
}

#[derive(InputObject, Debug)]
pub struct CreateTaskInput {
    pub project_id: ID,
    pub parent_task_id: Option<ID>,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub priority: TaskPriority,
    pub priority_order: Option<i32>,
    pub start_date: Option<DateTime<Utc>>,
    pub due_date: Option<DateTime<Utc>>,
    pub effort: Option<f64>,
    pub assignee_id: Option<ID>,
}

#[derive(InputObject, Debug)]
pub struct UpdateTaskInput {
    pub task_id: ID,
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<TaskStatus>,
    pub priority: Option<TaskPriority>,
    pub priority_order: Option<i32>,
    pub start_date: Option<DateTime<Utc>>,
    pub due_date: Option<DateTime<Utc>>,
    pub actual_start_date: Option<DateTime<Utc>>, 
    pub actual_end_date: Option<DateTime<Utc>>,
    pub effort: Option<f64>,
    pub progress: Option<i32>,
    pub assignee_id: Option<ID>,
}

#[derive(InputObject)]
pub struct TaskOrderInput {
    pub task_id: ID,
    pub priority_order: i32,
}

#[derive(InputObject)]
pub struct ReorderTasksInput {
    pub task_orders: Vec<TaskOrderInput>,
}