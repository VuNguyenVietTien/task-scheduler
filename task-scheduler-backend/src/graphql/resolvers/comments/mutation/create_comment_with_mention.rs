use async_graphql::*;
use chrono::Utc;
use regex::Regex;
use sqlx::{PgPool, Row};
use uuid::Uuid;
use log::{info, debug, error};
use serde_json::json;
use std::collections::HashSet;
use std::sync::Arc;

use crate::graphql::resolvers::comments::CommentResponse;
use crate::graphql::resolvers::comments::CreateCommentInput;
use crate::websocket::{NotificationBroadcaster, NotificationMessage};

// Function to extract mentions from comment content
fn extract_mentions(content: &str) -> Vec<(String, String)> {
    // Regex to match mentions in format: <span data-id="UUID" data-username="username" class="mention">@username</span>
    // This regex is updated to match the actual frontend format seen in the log
    // For example: <span data-id="0ae3e4cb-a035-47ef-b27a-203f62395a50" data-label="Zack Awesome" data-username="Zack Awesome" data-mention="" class="mention">@Zack Awesome</span>
    let re = Regex::new(r#"<span[^>]*?data-id="([^"]*)"[^>]*?data-username="([^"]*)"[^>]*?class="mention"[^>]*?>@([^<]*)</span>"#).unwrap();
    
    let mut mentions = Vec::new();
    
    for cap in re.captures_iter(content) {
        if let (Some(user_id), Some(username)) = (cap.get(1), cap.get(2)) {
            mentions.push((user_id.as_str().to_string(), username.as_str().to_string()));
        }
    }
    
    debug!("Found {} mentions in comment content", mentions.len());
    for (user_id, username) in &mentions {
        debug!("Mention: {} ({})", username, user_id);
    }
    
    mentions
}

pub async fn create_comment_with_mentions(
    pool: &PgPool, 
    user_id: Uuid,
    input: CreateCommentInput,
    broadcaster: Option<&Arc<NotificationBroadcaster>>,
) -> Result<CommentResponse, Error> {
    info!("Creating comment for task {} with mention detection", input.task_id);
    debug!("Comment content: {}", input.content);
    
    let task_id = Uuid::parse_str(&input.task_id)
        .map_err(|_| Error::new("Invalid task ID"))?;
        
    let parent_id = if let Some(pid) = &input.parent_id {
        Some(Uuid::parse_str(pid)
            .map_err(|_| Error::new("Invalid parent comment ID"))?)
    } else {
        None
    };
    
    // Get task details for notifications
    let task = sqlx::query!(
        "SELECT title, project_id, assignee_id FROM tasks WHERE task_id = $1",
        task_id
    )
    .fetch_one(pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch task details: {:?}", e);
        Error::new(format!("Failed to fetch task: {:?}", e))
    })?;
    
    info!("Fetched task details: {}, project_id: {}", task.title, task.project_id);
    
    let comment_id = Uuid::new_v4();
    let now = Utc::now();
    
    // Insert the comment in the database
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
    .fetch_one(pool)
    .await
    .map_err(|e| {
        error!("Database error while creating comment: {:?}", e);
        Error::new(format!("Database error: {:?}", e))
    })?
    .map_err(|e| {
        error!("Row mapping error: {:?}", e);
        Error::new(format!("Row mapping error: {:?}", e))
    })?;
    
    info!("Comment created with ID: {}", comment_id);
    
    // Process mentions and create notifications
    let mentions = extract_mentions(&input.content);
    info!("Found {} mentions in comment", mentions.len());
    
    // Keep track of which users we've already sent notifications to
    let mut notified_users = HashSet::new();
    
    // First, process all mentions (these take priority)
    for (mentioned_user_id, username) in mentions {
        match Uuid::parse_str(&mentioned_user_id) {
            Ok(mentioned_uuid) => {
                // Skip if the mentioned user is the comment author
                if mentioned_uuid != user_id {
                    debug!("Processing mention notification for user: {}", username);
                    
                    match create_mention_notification(
                        pool,
                        mentioned_uuid,
                        task_id,
                        user_id,
                        comment_id,
                        &task.title,
                        task.project_id,
                        broadcaster,
                    ).await {
                        Ok(_) => {
                            info!("Created mention notification for user {}", username);
                            notified_users.insert(mentioned_uuid);
                        },
                        Err(e) => error!("Failed to create mention notification: {:?}", e),
                    }
                } else {
                    debug!("Skipping self-mention for user: {}", username);
                }
            },
            Err(e) => error!("Invalid UUID in mention: {}, error: {:?}", mentioned_user_id, e),
        }
    }
    
    // Now, only notify the task assignee if they haven't already been notified via a mention
    if let Some(assignee_id) = task.assignee_id {
        if assignee_id != user_id && !notified_users.contains(&assignee_id) {
            debug!("Notifying task assignee: {}", assignee_id);
            match create_task_comment_notification(
                pool, 
                assignee_id, 
                task_id, 
                user_id,
                &task.title,
                task.project_id,
                comment_id,
                broadcaster,
            ).await {
                Ok(_) => info!("Created task comment notification for assignee"),
                Err(e) => error!("Failed to create task comment notification: {:?}", e),
            }
        }
    }
    
    Ok(record)
}

// Helper function to create a task comment notification
async fn create_task_comment_notification(
    pool: &PgPool,
    user_id: Uuid,
    task_id: Uuid,
    commenter_id: Uuid,
    task_title: &str,
    project_id: Uuid,
    comment_id: Uuid,
    broadcaster: Option<&Arc<NotificationBroadcaster>>,
) -> Result<(), Error> {
    // Get commenter username
    let user = sqlx::query!(
        "SELECT username FROM users WHERE user_id = $1",
        commenter_id
    )
    .fetch_one(pool)
    .await
    .map_err(|e| Error::new(format!("Failed to fetch user: {:?}", e)))?;
    
    let message = format!("{} commented on task: {}", user.username, task_title);
    let notification_id = Uuid::new_v4();
    
    let metadata = json!({
        "comment_id": comment_id.to_string(),
        "task_id": task_id.to_string(),
        "task_title": task_title,
        "project_id": project_id.to_string(),
    });
    
    sqlx::query!(
        r#"
        INSERT INTO notifications (
            notification_id, user_id, type, reference_type, reference_id, 
            message, is_read, created_at, project_id, sender_id, action, metadata
        )
        VALUES (
            $1, $2, 'COMMENT_MENTION', 'comment', $3, 
            $4, false, CURRENT_TIMESTAMP, $5, $6, 'comment',
            $7
        )
        "#,
        notification_id,
        user_id,
        comment_id,
        message,
        project_id,
        commenter_id,
        metadata
    )
    .execute(pool)
    .await
    .map_err(|e| Error::new(format!("Failed to create notification: {:?}", e)))?;
    
    // Send notification through WebSocket if broadcaster is available
    if let Some(broadcaster) = broadcaster {
        let now = chrono::Utc::now().fixed_offset();
        let notification_message = NotificationMessage {
            id: notification_id,
            user_id,
            type_: "COMMENT_MENTION".to_string(),
            content: metadata,
            created_at: now,
        };
        
        if let Err(e) = broadcaster.send(notification_message) {
            error!("Failed to broadcast notification: {:?}", e);
        } else {
            info!("Notification broadcasted successfully");
        }
    }
    
    Ok(())
}

// Helper function to create a mention notification
async fn create_mention_notification(
    pool: &PgPool,
    mentioned_user_id: Uuid,
    task_id: Uuid,
    mentioned_by: Uuid,
    comment_id: Uuid,
    task_title: &str,
    project_id: Uuid,
    broadcaster: Option<&Arc<NotificationBroadcaster>>,
) -> Result<(), Error> {
    // Get mentioner username
    let user = sqlx::query!(
        "SELECT username FROM users WHERE user_id = $1",
        mentioned_by
    )
    .fetch_one(pool)
    .await
    .map_err(|e| Error::new(format!("Failed to fetch user: {:?}", e)))?;
    
    let message = format!("{} mentioned you in a comment on task: {}", 
        user.username, task_title);
    
    let notification_id = Uuid::new_v4();
    
    let metadata = json!({
        "comment_id": comment_id.to_string(),
        "task_id": task_id.to_string(),
        "task_title": task_title,
        "project_id": project_id.to_string(),
    });
    
    // Insert notification
    sqlx::query!(
        r#"
        INSERT INTO notifications (
            notification_id, user_id, type, reference_type, reference_id, 
            message, is_read, created_at, project_id, sender_id, action, metadata
        )
        VALUES (
            $1, $2, 'COMMENT_MENTION', 'comment', $3, 
            $4, false, CURRENT_TIMESTAMP, $5, $6, 'mention',
            $7
        )
        "#,
        notification_id,
        mentioned_user_id,
        comment_id,
        message,
        project_id,
        mentioned_by,
        metadata
    )
    .execute(pool)
    .await
    .map_err(|e| Error::new(format!("Failed to create notification: {:?}", e)))?;
    
    // Send notification through WebSocket if broadcaster is available
    if let Some(broadcaster) = broadcaster {
        let now = chrono::Utc::now().fixed_offset();
        let notification_message = NotificationMessage {
            id: notification_id,
            user_id: mentioned_user_id,
            type_: "COMMENT_MENTION".to_string(),
            content: metadata,
            created_at: now,
        };
        
        if let Err(e) = broadcaster.send(notification_message) {
            error!("Failed to broadcast notification: {:?}", e);
        } else {
            info!("Mention notification broadcasted successfully");
        }
    }
    
    Ok(())
} 