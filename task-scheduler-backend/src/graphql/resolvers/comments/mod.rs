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
    pub author_id: String,
    pub task_id: String,
    pub parent_id: Option<String>,
    pub metadata: Option<JsonValue>,
    pub is_deleted: bool,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: chrono::DateTime<Utc>,
    pub username: String,
}

#[Object]
impl CommentResponse {
    async fn id(&self) -> &str {
        &self.id
    }

    async fn content(&self) -> &str {
        &self.content
    }

    #[graphql(name = "authorId")]
    async fn author_id(&self) -> &str {
        &self.author_id
    }

    #[graphql(name = "taskId")]
    async fn task_id(&self) -> &str {
        &self.task_id
    }

    #[graphql(name = "parentId")]
    async fn parent_id(&self) -> Option<&str> {
        self.parent_id.as_deref()
    }

    async fn metadata(&self) -> Option<&JsonValue> {
        self.metadata.as_ref()
    }

    #[graphql(name = "isDeleted")]
    async fn is_deleted(&self) -> bool {
        self.is_deleted
    }

    #[graphql(name = "createdAt")]
    async fn created_at(&self) -> chrono::DateTime<Utc> {
        self.created_at
    }

    #[graphql(name = "updatedAt")]
    async fn updated_at(&self) -> chrono::DateTime<Utc> {
        self.updated_at
    }

    async fn username(&self) -> &str {
        &self.username
    }
}

impl TryFrom<sqlx::postgres::PgRow> for CommentResponse {
    type Error = sqlx::Error;

    fn try_from(row: sqlx::postgres::PgRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: row.get::<Uuid, _>("comment_id").to_string(),
            content: row.get("content"),
            author_id: row.get::<Uuid, _>("user_id").to_string(),
            task_id: row.get::<Uuid, _>("task_id").to_string(),
            parent_id: row.get::<Option<Uuid>, _>("parent_id").map(|id| id.to_string()),
            metadata: row.get("metadata"),
            is_deleted: row.get("is_deleted"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            username: row.get::<Option<String>, _>("name").unwrap_or_else(|| "Người dùng".to_string()),
        })
    }
}

#[derive(Debug, InputObject)]
pub struct CreateCommentInput {
    pub content: String,
    pub task_id: String,
    pub parent_id: Option<String>,
    pub metadata: Option<JsonValue>,
} 