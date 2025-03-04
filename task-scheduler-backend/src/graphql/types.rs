//! Common GraphQL input and response types
use async_graphql::*;
use chrono::{DateTime, NaiveDate, Utc};
use serde_json::Value as JsonValue;

/// Project input types
#[derive(Debug, InputObject)]
pub struct CreateProjectInput {
    pub name: String,
    pub description: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub icon_url: Option<String>,
    pub is_public: Option<bool>,
    pub metadata: Option<JsonValue>,
}

#[derive(Debug, InputObject)]
pub struct UpdateProjectInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>, 
    pub status: Option<String>,
    pub icon_url: Option<String>,
    pub is_public: Option<bool>,
    pub progress: Option<f64>,
    pub metadata: Option<JsonValue>,
}

/// User input types
#[derive(Debug, InputObject)]
pub struct UpdateUserProfileInput {
    pub name: Option<String>,
    pub avatar_url: Option<String>,
    pub metadata: Option<JsonValue>,
}

/// Comment input types
#[derive(Debug, InputObject)]
pub struct CreateCommentInput {
    pub task_id: ID,
    pub content: String,
    pub metadata: Option<JsonValue>,
}

#[derive(Debug, InputObject)]
pub struct UpdateCommentInput {
    pub content: String,
    pub metadata: Option<JsonValue>,
}

/// Response types
#[derive(Debug, SimpleObject)]
pub struct ProjectResponse {
    pub id: ID,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: ID,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub status: String,
    pub icon_url: Option<String>,
    pub is_public: bool,
    pub progress: Option<f64>,
    pub metadata: Option<JsonValue>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, SimpleObject)]
pub struct UserResponse {
    pub id: ID,
    pub email: String,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
    pub metadata: Option<JsonValue>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, SimpleObject)]
pub struct CommentResponse {
    pub id: ID,
    pub task_id: ID,
    pub user_id: ID,
    pub content: String,
    pub metadata: Option<JsonValue>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
