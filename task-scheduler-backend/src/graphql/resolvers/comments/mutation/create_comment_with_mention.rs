use async_graphql::*;
use chrono::Utc;
use regex::Regex;
use sqlx::{PgPool, Row};
use uuid::Uuid;
use log::{info, debug, error};
use serde_json::json;
use std::collections::HashSet;

use crate::graphql::resolvers::comments::CommentResponse;
use crate::graphql::resolvers::comments::CreateCommentInput;
use crate::firebase::FirebaseService;

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
    firebase_service: Option<&FirebaseService>,
) -> Result<CommentResponse, Error> {
    info!("Creating comment for task {} with mention detection", input.task_id);
    debug!("Comment content: {}", input.content);
    
    // Thêm log kiểm tra Firebase service
    debug!("Firebase service available: {}", firebase_service.is_some());

    let task_id = Uuid::parse_str(&input.task_id)
        .map_err(|_| Error::new("Invalid task ID"))?;
        
    let parent_id = if let Some(pid) = &input.parent_id {
        Some(Uuid::parse_str(pid)
            .map_err(|_| Error::new("Invalid parent comment ID"))?)
    } else {
        None
    };
    
    // Get task details for notifications
    let task_row = sqlx::query(
        "SELECT title, project_id, assignee_id FROM tasks WHERE task_id = $1"
    )
    .bind(task_id)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch task details: {:?}", e);
        Error::new(format!("Failed to fetch task: {:?}", e))
    })?;
    
    let task_title: String = task_row.try_get("title").map_err(|e| {
        error!("Failed to get task title: {:?}", e);
        Error::new(format!("Failed to get task data: {:?}", e))
    })?;
    
    let project_id: Uuid = task_row.try_get("project_id").map_err(|e| {
        error!("Failed to get project_id: {:?}", e);
        Error::new(format!("Failed to get task data: {:?}", e))
    })?;
    
    let assignee_id: Option<Uuid> = task_row.try_get("assignee_id").map_err(|e| {
        error!("Failed to get assignee_id: {:?}", e);
        Error::new(format!("Failed to get task data: {:?}", e))
    })?;
    
    info!("Fetched task details: {}, project_id: {}", task_title, project_id);
    
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
                        &task_title,
                        project_id
                    ).await {
                        Ok(notification_id) => {
                            info!("Created mention notification for user {}", username);
                            notified_users.insert(mentioned_uuid);
                            
                            // Gửi FCM notification nếu có FirebaseService
                            if let Some(firebase) = firebase_service {
                                // Lấy thông tin người comment
                                let commenter_row = sqlx::query(
                                    "SELECT username FROM users WHERE user_id = $1"
                                )
                                .bind(user_id)
                                .fetch_one(pool)
                                .await;
                                
                                let commenter_name = match commenter_row {
                                    Ok(row) => row.try_get::<String, _>("username").unwrap_or_else(|_| "Someone".to_string()),
                                    Err(e) => {
                                        error!("Failed to get commenter info: {:?}", e);
                                        "Someone".to_string()
                                    }
                                };
                                
                                // Lấy FCM tokens của người được mention
                                let user_result = sqlx::query(
                                    "SELECT fcm_tokens FROM users WHERE user_id = $1"
                                )
                                .bind(mentioned_uuid)
                                .fetch_one(pool)
                                .await;
                                
                                if let Ok(user_row) = user_result {
                                    // Xử lý FCM tokens từ JSONB
                                    let fcm_tokens_value: Option<serde_json::Value> = user_row.try_get("fcm_tokens").ok();
                                    debug!("FCM tokens for user {}: {:?}", mentioned_uuid, fcm_tokens_value);
                                    
                                    let tokens = match fcm_tokens_value {
                                        Some(value) if value.is_array() => {
                                            value.as_array().unwrap().iter()
                                                .filter_map(|t| t.as_str().map(|s| s.to_string()))
                                                .collect::<Vec<String>>()
                                        },
                                        _ => Vec::new()
                                    };
                                    
                                    if tokens.is_empty() {
                                        debug!("No FCM tokens found for mentioned user: {}", mentioned_uuid);
                                        
                                        // Thêm log để kiểm tra FCM service
                                        if let Some(firebase) = firebase_service {
                                            debug!("Firebase service is available, but no tokens to send notifications to");
                                        } else {
                                            debug!("Firebase service is not available");
                                        }
                                    } else {
                                        info!("Found {} FCM tokens for user {}", tokens.len(), mentioned_uuid);
                                        
                                        // Chỉ thực hiện FCM notification khi có tokens
                                        if let Some(firebase) = firebase_service {
                                            let notification_title = format!("You were mentioned in a comment");
                                            let notification_body = format!("{} mentioned you in a comment on task '{}'", 
                                                commenter_name, task_title);
                                            
                                            let notification_payload = crate::firebase::FcmNotificationPayload {
                                                title: notification_title,
                                                body: notification_body,
                                            };
                                            
                                            let data_payload = crate::firebase::FcmDataPayload {
                                                notification_id: notification_id.to_string(),
                                                notification_type: "COMMENT_MENTION".to_string(),
                                                project_id: Some(project_id.to_string()),
                                                task_id: Some(task_id.to_string()),
                                                comment_id: Some(comment_id.to_string()),
                                                user_id: mentioned_uuid.to_string(),
                                                sender_id: Some(user_id.to_string()),
                                                extra: std::collections::HashMap::new(),
                                            };
                                            
                                            match firebase.send_notification_to_tokens(
                                                tokens.clone(),
                                                notification_payload,
                                                data_payload
                                            ).await {
                                                Ok(fcm_response) => {
                                                    info!("Successfully sent FCM notification to user {}: {:?}", mentioned_uuid, fcm_response);
                                                },
                                                Err(e) => {
                                                    error!("Failed to send FCM notification to user {}: {:?}", mentioned_uuid, e);
                                                }
                                            }
                                        } else {
                                            debug!("Firebase service is not available");
                                        }
                                    }
                                }
                            }
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
    if let Some(assignee_id) = assignee_id {
        if assignee_id != user_id && !notified_users.contains(&assignee_id) {
            debug!("Notifying task assignee: {}", assignee_id);
            match create_task_comment_notification(
                pool, 
                assignee_id, 
                task_id, 
                user_id,
                &task_title,
                project_id,
                comment_id
            ).await {
                Ok(notification_id) => {
                    info!("Created task comment notification for assignee");
                    
                    // Gửi FCM notification cho assignee nếu có FirebaseService
                    if let Some(firebase) = firebase_service {
                        // Lấy thông tin người comment
                        let commenter_row = sqlx::query(
                            "SELECT username FROM users WHERE user_id = $1"
                        )
                        .bind(user_id)
                        .fetch_one(pool)
                        .await;
                        
                        let commenter_name = match commenter_row {
                            Ok(row) => row.try_get::<String, _>("username").unwrap_or_else(|_| "Someone".to_string()),
                            Err(e) => {
                                error!("Failed to get commenter info: {:?}", e);
                                "Someone".to_string()
                            }
                        };
                        
                        // Lấy FCM tokens của assignee
                        let user_query = sqlx::query!(
                            "SELECT fcm_tokens FROM users WHERE user_id = $1",
                            assignee_id
                        )
                        .fetch_one(pool)
                        .await;
                        
                        if let Ok(user) = user_query {
                            // Xử lý FCM tokens từ JSONB
                            let tokens = match user.fcm_tokens {
                                Some(value) if value.is_array() => {
                                    value.as_array().unwrap().iter()
                                        .filter_map(|t| t.as_str().map(|s| s.to_string()))
                                        .collect::<Vec<String>>()
                                },
                                _ => Vec::new()
                            };
                            
                            if tokens.is_empty() {
                                debug!("No FCM tokens found for task assignee: {}", assignee_id);
                                
                                // Thêm log để kiểm tra FCM service
                                if let Some(firebase) = firebase_service {
                                    debug!("Firebase service is available, but no tokens to send notifications to");
                                } else {
                                    debug!("Firebase service is not available");
                                }
                            } else {
                                info!("Found {} FCM tokens for assignee {}", tokens.len(), assignee_id);
                                
                                // Chỉ thực hiện FCM notification khi có tokens
                                if let Some(firebase) = firebase_service {
                                    let notification_title = format!("New comment on your task");
                                    let notification_body = format!("{} commented on task '{}'", 
                                        commenter_name, task_title);
                                    
                                    let notification_payload = crate::firebase::FcmNotificationPayload {
                                        title: notification_title,
                                        body: notification_body,
                                    };
                                    
                                    let data_payload = crate::firebase::FcmDataPayload {
                                        notification_id: notification_id.to_string(),
                                        notification_type: "TASK_COMMENT".to_string(),
                                        project_id: Some(project_id.to_string()),
                                        task_id: Some(task_id.to_string()),
                                        comment_id: Some(comment_id.to_string()),
                                        user_id: assignee_id.to_string(),
                                        sender_id: Some(user_id.to_string()),
                                        extra: std::collections::HashMap::new(),
                                    };
                                    
                                    match firebase.send_notification_to_tokens(
                                        tokens.clone(),
                                        notification_payload,
                                        data_payload
                                    ).await {
                                        Ok(fcm_response) => {
                                            info!("Successfully sent FCM notification to assignee {}: {:?}", assignee_id, fcm_response);
                                        },
                                        Err(e) => {
                                            error!("Failed to send FCM notification to assignee {}: {:?}", assignee_id, e);
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
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
) -> Result<Uuid, Error> {
    // Get commenter username
    let user_row = sqlx::query(
        "SELECT username FROM users WHERE user_id = $1"
    )
    .bind(commenter_id)
    .fetch_one(pool)
    .await
    .map_err(|e| Error::new(format!("Failed to fetch user: {:?}", e)))?;
    
    let username: String = user_row.try_get("username")
        .map_err(|e| Error::new(format!("Failed to get username: {:?}", e)))?;
    
    let message = format!("{} commented on task: {}", username, task_title);
    let notification_id = Uuid::new_v4();
    
    let metadata = json!({
        "comment_id": comment_id.to_string(),
        "task_id": task_id.to_string(),
        "task_title": task_title,
        "project_id": project_id.to_string(),
    });
    
    sqlx::query(
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
        "#
    )
    .bind(notification_id)
    .bind(user_id)
    .bind(comment_id)
    .bind(message)
    .bind(project_id)
    .bind(commenter_id)
    .bind(metadata)
    .execute(pool)
    .await
    .map_err(|e| Error::new(format!("Failed to create notification: {:?}", e)))?;
    
    Ok(notification_id)
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
) -> Result<Uuid, Error> {
    // Get mentioner username
    let user_row = sqlx::query(
        "SELECT username FROM users WHERE user_id = $1"
    )
    .bind(mentioned_by)
    .fetch_one(pool)
    .await
    .map_err(|e| Error::new(format!("Failed to fetch user: {:?}", e)))?;
    
    let username: String = user_row.try_get("username")
        .map_err(|e| Error::new(format!("Failed to get username: {:?}", e)))?;
    
    let message = format!("{} mentioned you in a comment on task: {}", 
        username, task_title);
    
    let notification_id = Uuid::new_v4();
    
    let metadata = json!({
        "comment_id": comment_id.to_string(),
        "task_id": task_id.to_string(),
        "task_title": task_title,
        "project_id": project_id.to_string(),
    });
    
    // Insert notification
    sqlx::query(
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
        "#
    )
    .bind(notification_id)
    .bind(mentioned_user_id)
    .bind(comment_id)
    .bind(message)
    .bind(project_id)
    .bind(mentioned_by)
    .bind(metadata)
    .execute(pool)
    .await
    .map_err(|e| Error::new(format!("Failed to create notification: {:?}", e)))?;
    
    // Also add an entry to comment_mentions table
    sqlx::query(
        r#"
        INSERT INTO comment_mentions (id, comment_id, user_id, is_read)
        VALUES ($1, $2, $3, false)
        "#
    )
    .bind(Uuid::new_v4())
    .bind(comment_id)
    .bind(mentioned_user_id)
    .execute(pool)
    .await
    .map_err(|e| Error::new(format!("Failed to create comment mention: {:?}", e)))?;
    
    Ok(notification_id)
} 