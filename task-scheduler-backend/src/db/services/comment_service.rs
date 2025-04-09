use sqlx::PgPool;
use uuid::Uuid;
use regex::Regex;
use async_graphql::Error;

use crate::db::queries::comment::{create_comment as insert_comment, get_comments_by_task_id as get_comments};
use crate::db::models::CreateCommentInput;
use crate::db::services::notification_service::{create_comment_mention_notification, create_task_comment_notification};
use crate::db::queries::notification::create_notification;
use crate::db::models::CreateNotificationInput;
use crate::db::models::{Comment};
use crate::db::services::task_service::get_task_by_id;

// Thêm function extract_mentions để trích xuất các mention từ nội dung comment
fn extract_mentions(content: &str) -> Vec<(String, String)> {
    // Regex để tìm các thẻ span với data-mention và data-id
    let re = Regex::new(r#"<span[^>]*?data-id="([^"]*)"[^>]*?data-username="([^"]*)"[^>]*?data-mention[^>]*?>"#).unwrap();
    
    // Thu thập tất cả các mention từ nội dung
    let mut mentions = Vec::new();
    
    for cap in re.captures_iter(content) {
        if let (Some(user_id), Some(username)) = (cap.get(1), cap.get(2)) {
            mentions.push((user_id.as_str().to_string(), username.as_str().to_string()));
        }
    }
    
    mentions
}

pub async fn create_comment(pool: &PgPool, input: CreateCommentInput) -> Result<Uuid, Error> {
    let comment_id = Uuid::new_v4();
    
    sqlx::query!(
        r#"
        INSERT INTO comments (comment_id, task_id, user_id, content)
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
    
    // Extract mentions from comment content and send notifications
    let mentions = extract_mentions(&input.content);
    for (mentioned_user_id, username) in mentions {
        if let Ok(uuid) = Uuid::parse_str(&mentioned_user_id) {
            // Skip if mentioned user is the comment author
            if uuid != input.user_id {
                // Create mention notification
                create_comment_mention_notification(
                    pool,
                    uuid,
                    input.task_id,
                    input.user_id,
                    comment_id,
                ).await?;
                
                // Optional: Add entry to comment_mentions table
                sqlx::query!(
                    r#"
                    INSERT INTO comment_mentions (id, comment_id, user_id, is_read)
                    VALUES ($1, $2, $3, false)
                    "#,
                    Uuid::new_v4(),
                    comment_id,
                    uuid
                )
                .execute(pool)
                .await?;
            }
        }
    }
    
    Ok(comment_id)
}

pub async fn get_comments_by_task_id(pool: &PgPool, task_id: Uuid) -> Result<Vec<Comment>, Error> {
    let comments = sqlx::query_as!(
        Comment,
        r#"
        SELECT comment_id as id, task_id, user_id, content, created_at, updated_at
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