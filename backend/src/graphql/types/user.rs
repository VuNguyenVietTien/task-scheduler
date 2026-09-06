use async_graphql::{SimpleObject, ID};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// For general user data
#[derive(SimpleObject)]
#[graphql(rename_fields = "snake_case")]
pub struct UserResponse {
    pub id: ID,
    pub email: String,
    pub display_name: String,
    pub role: String,
    pub avatar_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
