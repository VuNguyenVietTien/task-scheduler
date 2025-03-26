use async_graphql::{Context, Object, ID, Result, InputObject};
use chrono::Utc;
use serde_json::Value as JsonValue;
use sqlx::{PgPool, Row};
use uuid::Uuid;

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

    async fn author_id(&self) -> &str {
        &self.author_id
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

#[derive(Default)]
pub struct CommentQuery;

#[Object]
impl CommentQuery {
    pub async fn comment(&self, ctx: &Context<'_>, id: ID) -> Result<Option<CommentResponse>> {
        let db = ctx.data::<PgPool>().unwrap();
        let comment_id = Uuid::parse_str(&id)
            .map_err(|_| async_graphql::Error::new("Invalid comment ID"))?;

        let record = sqlx::query(
            "SELECT c.comment_id, c.content, c.user_id, c.task_id, c.parent_id, c.metadata, 
                    c.is_deleted, c.created_at, c.updated_at, u.username as name
             FROM comments c
             JOIN users u ON c.user_id = u.user_id
             WHERE c.comment_id = $1 AND NOT c.is_deleted"
        )
        .bind(comment_id)
        .map(|row: sqlx::postgres::PgRow| CommentResponse::try_from(row))
        .fetch_optional(db)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?
        .transpose()
        .map_err(|e| async_graphql::Error::new(format!("Row mapping error: {}", e)))?;

        Ok(record)
    }

    pub async fn task_comments(
        &self,
        ctx: &Context<'_>,
        task_id: ID,
    ) -> Result<Vec<CommentResponse>> {
        let db = ctx.data::<PgPool>().unwrap();
        let task_uuid = Uuid::parse_str(&task_id)
            .map_err(|_| async_graphql::Error::new("Invalid task ID"))?;

        let records = sqlx::query(
            "SELECT c.comment_id, c.content, c.user_id, c.task_id, c.parent_id, c.metadata,
                    c.is_deleted, c.created_at, c.updated_at, u.username as name
             FROM comments c
             JOIN users u ON c.user_id = u.user_id
             WHERE c.task_id = $1 AND NOT c.is_deleted
             ORDER BY c.created_at ASC"
        )
        .bind(task_uuid)
        .map(|row: sqlx::postgres::PgRow| CommentResponse::try_from(row))
        .fetch_all(db)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?
        .into_iter()
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| async_graphql::Error::new(format!("Row mapping error: {}", e)))?;

        Ok(records)
    }
}

#[derive(Debug, InputObject)]
pub struct CreateCommentInput {
    pub content: String,
    pub task_id: String,
    pub parent_id: Option<String>,
    pub metadata: Option<JsonValue>,
}

#[derive(Default)]
pub struct CommentMutation;

#[Object]
impl CommentMutation {
    pub async fn create_comment(
        &self,
        ctx: &Context<'_>,
        input: CreateCommentInput,
    ) -> Result<CommentResponse> {
        let db = ctx.data::<PgPool>().unwrap();
        
        let auth = ctx.data::<crate::graphql::Context>()
            .map_err(|e| async_graphql::Error::new(format!("Không thể lấy context: {:?}", e)))?
            .auth
            .as_ref()
            .ok_or_else(|| async_graphql::Error::new("Bạn cần đăng nhập để thêm bình luận"))?;
        
        let user_id = auth.user_id()
            .map_err(|_| async_graphql::Error::new("ID người dùng không hợp lệ"))?;

        let task_id = Uuid::parse_str(&input.task_id)
            .map_err(|_| async_graphql::Error::new("Invalid task ID"))?;

        let parent_id = if let Some(pid) = input.parent_id {
            Some(Uuid::parse_str(&pid)
                .map_err(|_| async_graphql::Error::new("Invalid parent comment ID"))?)
        } else {
            None
        };

        let comment_id = Uuid::new_v4();
        let now = Utc::now();

        let record = sqlx::query(
            "WITH inserted_comment AS (
                INSERT INTO comments (
                    comment_id, content, user_id, task_id, parent_id,
                    metadata, is_deleted, created_at, updated_at
                ) 
                VALUES ($1, $2, $3, $4, $5, $6, false, $7, $7)
                RETURNING *
            )
            SELECT c.comment_id, c.content, c.user_id, c.task_id, c.parent_id, 
                   c.metadata, c.is_deleted, c.created_at, c.updated_at, u.username as name
            FROM inserted_comment c
            JOIN users u ON c.user_id = u.user_id"
        )
        .bind(comment_id)
        .bind(&input.content)
        .bind(user_id)
        .bind(task_id)
        .bind(parent_id)
        .bind(input.metadata)
        .bind(now)
        .map(|row: sqlx::postgres::PgRow| CommentResponse::try_from(row))
        .fetch_one(db)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?
        .map_err(|e| async_graphql::Error::new(format!("Row mapping error: {}", e)))?;

        Ok(record)
    }
    
    pub async fn delete_comment(
        &self,
        ctx: &Context<'_>,
        comment_id: ID,
    ) -> Result<bool> {
        let db = ctx.data::<PgPool>().unwrap();
        
        // Lấy thông tin xác thực người dùng từ context
        let auth = ctx.data::<crate::graphql::Context>()
            .map_err(|e| async_graphql::Error::new(format!("Không thể lấy context: {:?}", e)))?
            .auth
            .as_ref()
            .ok_or_else(|| async_graphql::Error::new("Bạn cần đăng nhập để xóa bình luận"))?;
        
        let user_id = auth.user_id()
            .map_err(|_| async_graphql::Error::new("ID người dùng không hợp lệ"))?;
            
        let comment_uuid = Uuid::parse_str(&comment_id)
            .map_err(|_| async_graphql::Error::new("Invalid comment ID"))?;
            
        // Lấy thông tin comment để kiểm tra quyền xóa
        let comment = sqlx::query(
            "SELECT * FROM comments WHERE comment_id = $1 AND NOT is_deleted"
        )
        .bind(comment_uuid)
        .fetch_optional(db)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;
        
        // Kiểm tra comment có tồn tại không
        let comment = match comment {
            Some(comment) => comment,
            None => return Err(async_graphql::Error::new("Không tìm thấy bình luận này")),
        };
        
        // Kiểm tra quyền xóa comment
        let comment_user_id: Uuid = comment.get("user_id");
        if comment_user_id != user_id {
            return Err(async_graphql::Error::new("Bạn không có quyền xóa bình luận này"));
        }
        
        // Thực hiện xóa comment (soft delete)
        let now = Utc::now();
        let result = sqlx::query(
            "UPDATE comments SET is_deleted = true, updated_at = $1 WHERE comment_id = $2"
        )
        .bind(now)
        .bind(comment_uuid)
        .execute(db)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Không thể xóa bình luận: {}", e)))?;
        
        Ok(result.rows_affected() > 0)
    }
}
