use async_graphql::*;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::graphql::resolvers::comments::CommentResponse;

pub async fn get_task_comments(
    pool: &PgPool,
    task_id: &str,
) -> Result<Vec<CommentResponse>, Error> {
    let uuid = Uuid::parse_str(task_id)
        .map_err(|_| Error::new("Invalid task ID"))?;
        
    let records = sqlx::query(
        "SELECT c.comment_id, c.content, c.user_id, c.task_id, c.parent_id, c.metadata,
                c.is_deleted, c.created_at, c.updated_at, u.username as name
         FROM comments c
         JOIN users u ON c.user_id = u.user_id
         WHERE c.task_id = $1 AND NOT c.is_deleted
         ORDER BY c.created_at ASC"
    )
    .bind(uuid)
    .map(|row: sqlx::postgres::PgRow| CommentResponse::try_from(row))
    .fetch_all(pool)
    .await
    .map_err(|e| Error::new(format!("Database error: {}", e)))?
    .into_iter()
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| Error::new(format!("Row mapping error: {}", e)))?;

    Ok(records)
} 