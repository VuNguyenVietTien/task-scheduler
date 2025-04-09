use sqlx::PgPool;
use uuid::Uuid;
use regex::Regex;
use async_graphql::Error;
use std::sync::Arc;

use crate::db::queries::comment::{create_comment as insert_comment, get_comments_by_task_id as get_comments};
use crate::db::models::CreateCommentInput;
use crate::db::services::notification_service::{create_comment_mention_notification, create_task_comment_notification};
use crate::db::queries::notification::create_notification;
use crate::db::models::CreateNotificationInput;
use crate::db::models::{Comment};
use crate::db::services::task_service::get_task_by_id;
use crate::db::services::notification_broadcaster::NotificationBroadcaster;

// Thêm function extract_mentions để trích xuất các mention từ nội dung comment
fn extract_mentions(content: &str) -> Vec<(String, String)> {
    // Cập nhật regex để phù hợp với định dạng thực tế của mentions
    let re = Regex::new(r#"<span[^>]*?data-id="([^"]*)"[^>]*?data-username="([^"]*)"[^>]*?class="mention"[^>]*?>@([^<]*)</span>"#).unwrap();
    
    // Thu thập tất cả các mention từ nội dung
    let mut mentions = Vec::new();
    
    for cap in re.captures_iter(content) {
        if let (Some(user_id), Some(username)) = (cap.get(1), cap.get(2)) {
            mentions.push((user_id.as_str().to_string(), username.as_str().to_string()));
        }
    }
    
    // Log chi tiết để debug
    println!("Found {} mentions in comment content: {}", mentions.len(), content);
    for (user_id, username) in &mentions {
        println!("  Mention: {} ({})", username, user_id);
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
    task_title: &str,
    broadcaster: Option<&Arc<NotificationBroadcaster>>,
) -> Result<Uuid, Error> {
    println!("Starting create_comment_with_notifications for task: {}", input.task_id);
    println!("Comment content: {}", input.content);
    
    // Create the comment first to ensure it's saved
    let comment_id = create_comment(pool, input.clone()).await?;
    println!("Comment created with ID: {}", comment_id);
    
    // Get task details to check assignee
    let task = get_task_by_id(pool, input.task_id).await?;
    println!("Retrieved task: {}, project_id: {}", task.title, task.project_id);
    
    // Extract mentions from comment content
    let mentions = extract_mentions(&input.content);
    println!("Extracted {} mentions from comment", mentions.len());
    
    // Keep track of users who have already received a notification
    let mut notified_users = Vec::new();
    
    // First, process mentions as they have higher priority
    for (mentioned_user_id, username) in mentions {
        println!("Processing mention: user_id={}, username={}", mentioned_user_id, username);
        
        if let Ok(uuid) = Uuid::parse_str(&mentioned_user_id) {
            // Skip if mentioned user is the comment author
            if uuid != input.user_id {
                println!("Processing mention for user: {} ({})", username, uuid);
                
                // Create mention notification
                match create_comment_mention_notification(
                    pool,
                    uuid,
                    input.task_id,
                    input.user_id,
                    comment_id,
                    broadcaster,
                ).await {
                    Ok(notification_id) => {
                        println!("Created mention notification: {}", notification_id);
                        
                        // Add to notified users list
                        notified_users.push(uuid);
                        
                        // Optional: Add entry to comment_mentions table
                        match sqlx::query!(
                            r#"
                            INSERT INTO comment_mentions (id, comment_id, user_id, is_read)
                            VALUES ($1, $2, $3, false)
                            "#,
                            Uuid::new_v4(),
                            comment_id,
                            uuid
                        )
                        .execute(pool)
                        .await {
                            Ok(_) => println!("Added entry to comment_mentions table"),
                            Err(e) => println!("Error adding to comment_mentions: {}", e),
                        }
                    },
                    Err(e) => println!("Error creating mention notification: {}", e),
                }
            } else {
                println!("Skipping mention for comment author: {}", uuid);
            }
        } else {
            println!("Invalid UUID in mention: {}", mentioned_user_id);
        }
    }
    
    // Then, check if assignee notification is needed
    if let Some(assignee_id) = task.assignee_id {
        // Don't notify assignee if they are the comment author or already received a mention notification
        if assignee_id != input.user_id && !notified_users.contains(&assignee_id) {
            println!("Sending notification to task assignee: {}", assignee_id);
            match create_task_comment_notification(
                pool,
                assignee_id,
                input.task_id,
                input.user_id,
                task_title,
                comment_id,
                input.created_by,
                input.project_id,
                broadcaster,
            ).await {
                Ok(notification_id) => println!("Created task comment notification: {}", notification_id),
                Err(e) => println!("Error creating task comment notification: {}", e),
            }
        } else {
            println!("Skipping task comment notification for assignee: already notified or is the commenter");
        }
    } else {
        println!("No assignee for task, skipping task comment notification");
    }
    
    println!("Completed create_comment_with_notifications");
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