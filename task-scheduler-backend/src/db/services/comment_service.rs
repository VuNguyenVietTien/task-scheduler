use sqlx::PgPool;
use uuid::Uuid;
use regex::Regex;
use async_graphql::Error;

use crate::db::queries::comment::{create_comment, get_task_by_id};
use crate::db::models::CreateCommentInput;
use crate::db::services::notification_service::{create_comment_mention_notification, create_task_comment_notification};
use crate::db::queries::notification::create_notification;
use crate::db::models::CreateNotificationInput;
use crate::db::models::{Comment};
use crate::db::services::task_service::get_task_by_id;

pub async fn create_comment(pool: &PgPool, input: CreateCommentInput) -> Result<Uuid, Error> {
    let comment_id = Uuid::new_v4();
    
    sqlx::query!(
        r#"
        INSERT INTO comments (id, task_id, user_id, content)
        VALUES ($1, $2, $3, $4)
        "#,
        comment_id,
        input.task_id,
        input.user_id,
        input.content
    )
    .execute(pool)
    .await?;

    Ok(comment_id)
}

pub async fn create_comment_with_notifications(
    pool: &PgPool,
    input: CreateCommentInput,
) -> Result<Uuid, Error> {
    // Get task details to check assignee
    let task = get_task_by_id(pool, input.task_id).await?;
    
    // Create the comment
    let comment_id = create_comment(pool, input.clone()).await?;
    
    // If the comment author is not the task assignee, send a notification
    if let Some(assignee_id) = task.assignee_id {
        if assignee_id != input.user_id {
            create_task_comment_notification(
                pool,
                assignee_id,
                input.task_id,
                input.user_id,
            ).await?;
        }
    }
    
    Ok(comment_id)
}

pub async fn get_comments_by_task_id(pool: &PgPool, task_id: Uuid) -> Result<Vec<Comment>, Error> {
    let comments = sqlx::query_as!(
        Comment,
        r#"
        SELECT id, task_id, user_id, content, created_at, updated_at
        FROM comments
        WHERE task_id = $1
        ORDER BY created_at DESC
        "#,
        task_id
    )
    .fetch_all(pool)
    .await?;

    Ok(comments)
} 