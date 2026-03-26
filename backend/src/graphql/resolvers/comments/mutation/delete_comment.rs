use async_graphql::*;
use chrono::Utc;
use sqlx::{PgPool, Row};
use uuid::Uuid;
use log::{info, error};

pub async fn delete_comment(
    pool: &PgPool,
    user_id: Uuid,
    comment_id: &str,
) -> Result<bool, Error> {
    info!("Attempting to delete comment: {}", comment_id);
    
    let comment_uuid = Uuid::parse_str(comment_id)
        .map_err(|_| Error::new("Invalid comment ID"))?;
        
    // Check if comment exists and user has permission to delete
    let comment = sqlx::query(
        "SELECT * FROM comments WHERE comment_id = $1 AND NOT is_deleted"
    )
    .bind(comment_uuid)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        error!("Database error when fetching comment: {:?}", e);
        Error::new(format!("Database error: {:?}", e))
    })?;
    
    // Verify comment exists
    let comment = match comment {
        Some(comment) => comment,
        None => {
            info!("Comment not found: {}", comment_id);
            return Err(Error::new("Comment not found"));
        }
    };
    
    // Verify user has permission
    let comment_user_id: Uuid = comment.try_get("user_id")?;
    if comment_user_id != user_id {
        info!("Permission denied: User {} tried to delete comment {} owned by {}", 
            user_id, comment_id, comment_user_id);
        return Err(Error::new("You don't have permission to delete this comment"));
    }
    
    // Perform soft delete
    let now = Utc::now();
    let result = sqlx::query(
        "UPDATE comments SET is_deleted = true, updated_at = $1 WHERE comment_id = $2"
    )
    .bind(now)
    .bind(comment_uuid)
    .execute(pool)
    .await
    .map_err(|e| {
        error!("Failed to delete comment: {:?}", e);
        Error::new(format!("Failed to delete comment: {:?}", e))
    })?;
    
    info!("Comment deleted successfully: {}", comment_id);
    Ok(result.rows_affected() > 0)
} 