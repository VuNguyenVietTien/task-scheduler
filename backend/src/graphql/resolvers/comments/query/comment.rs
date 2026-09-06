use async_graphql::*;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::graphql::resolvers::comments::CommentResponse;

pub async fn get_comment(
    pool: &PgPool,
    comment_id: &str,
) -> Result<Option<CommentResponse>, Error> {
    let uuid = Uuid::parse_str(comment_id).map_err(|_| Error::new("Invalid comment ID"))?;

    let record = sqlx::query(
        "SELECT c.comment_id, c.content, c.user_id, c.task_id, c.parent_id, c.metadata, 
                c.is_deleted, c.created_at, c.updated_at, u.username as name, u.full_name, u.avatar_url
         FROM comments c
         JOIN users u ON c.user_id = u.user_id
         WHERE c.comment_id = $1 AND NOT c.is_deleted"
    )
    .bind(uuid)
    .map(|row: sqlx::postgres::PgRow| CommentResponse::try_from(row))
    .fetch_optional(pool)
    .await
    .map_err(|e| Error::new(format!("Database error: {}", e)))?
    .transpose()
    .map_err(|e| Error::new(format!("Row mapping error: {}", e)))?;

    Ok(record)
}
