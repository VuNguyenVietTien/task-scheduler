use async_graphql::*;
use chrono::Utc;
use serde_json::Value as JsonValue;
use sqlx::{PgPool, Row};
use uuid::Uuid;

pub mod mutation;
pub mod query;

pub struct CommentResponse {
    pub id: String,
    pub content: String,
    pub user_id: String,
    pub task_id: String,
    pub parent_id: Option<String>,
    pub metadata: Option<JsonValue>,
    pub is_deleted: bool,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: chrono::DateTime<Utc>,
    pub username: Option<String>,
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
}

#[Object(rename_fields = "snake_case")]
impl CommentResponse {
    async fn id(&self) -> &str {
        &self.id
    }

    async fn content(&self) -> &str {
        &self.content
    }

    async fn user_id(&self) -> &str {
        &self.user_id
    }

    async fn task_id(&self) -> &str {
        &self.task_id
    }

    async fn parent_id(&self) -> Option<&str> {
        self.parent_id.as_deref()
    }

    async fn metadata(&self) -> Option<&JsonValue> {
        self.metadata.as_ref()
    }

    async fn is_deleted(&self) -> bool {
        self.is_deleted
    }

    async fn created_at(&self) -> chrono::DateTime<Utc> {
        self.created_at
    }

    async fn updated_at(&self) -> chrono::DateTime<Utc> {
        self.updated_at
    }

    async fn username(&self) -> Option<&str> {
        self.username.as_deref()
    }

    async fn full_name(&self) -> Option<&str> {
        self.full_name.as_deref()
    }

    async fn avatar_url(&self) -> Option<&str> {
        self.avatar_url.as_deref()
    }
}

impl TryFrom<sqlx::postgres::PgRow> for CommentResponse {
    type Error = sqlx::Error;

    fn try_from(row: sqlx::postgres::PgRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: row.get::<Uuid, _>("comment_id").to_string(),
            content: row.get("content"),
            user_id: row.get::<Uuid, _>("user_id").to_string(),
            task_id: row.get::<Uuid, _>("task_id").to_string(),
            parent_id: row
                .get::<Option<Uuid>, _>("parent_id")
                .map(|id| id.to_string()),
            metadata: row.get("metadata"),
            is_deleted: row.get("is_deleted"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            username: row.try_get::<Option<String>, _>("name").ok().flatten(),
            full_name: row.try_get::<Option<String>, _>("full_name").ok().flatten(),
            avatar_url: row
                .try_get::<Option<String>, _>("avatar_url")
                .ok()
                .flatten(),
        })
    }
}

#[derive(Debug, InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct CreateCommentInput {
    pub content: String,
    pub task_id: String,
    pub parent_id: Option<String>,
    pub metadata: Option<JsonValue>,
}
