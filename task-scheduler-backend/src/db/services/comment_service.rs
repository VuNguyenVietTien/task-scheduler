use sqlx::PgPool;
use uuid::Uuid;
use regex::Regex;
use async_graphql::Error;
use std::collections::HashSet;
use chrono::Utc;
use serde_json::json;

use crate::db::queries::comment::{create_comment as insert_comment, get_comments_by_task_id as get_comments};
use crate::db::models::CreateCommentInput;
use crate::db::services::notification_service::{create_comment_mention_notification, create_task_comment_notification};
use crate::db::queries::notification::create_notification;
use crate::db::models::CreateNotificationInput;
use crate::db::models::{Comment};
use crate::db::services::task_service::get_task_by_id;
use crate::firebase::FirebaseService;
use crate::db::services::user_service::get_user_by_id;
use crate::error_handling::ErrorMessage;
use log::{debug, error, info};

/// Extract user mentions from comment content
pub fn extract_mentions(content: &str) -> Vec<Uuid> {
    let re = Regex::new(r"@user:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})").unwrap();
    re.captures_iter(content)
        .filter_map(|cap| {
            if let Some(id_str) = cap.get(1) {
                match Uuid::parse_str(id_str.as_str()) {
                    Ok(uuid) => Some(uuid),
                    Err(_) => None,
                }
            } else {
                None
            }
        })
        .collect()
}

/// Create a new comment
pub async fn create_comment(
    pool: &PgPool,
    input: CreateCommentInput,
) -> Result<Uuid, ErrorMessage> {
    debug!("Starting create_comment");

    let now = Utc::now();
    let comment_id = Uuid::new_v4();

    let result = sqlx::query!(
        r#"
        INSERT INTO comments (id, task_id, user_id, content, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        "#,
        comment_id,
        input.task_id,
        input.user_id,
        input.content,
        now,
        now
    )
    .fetch_one(pool)
    .await;

    match result {
        Ok(record) => {
            debug!("Comment created successfully with ID: {}", record.id);
            Ok(record.id)
        }
        Err(err) => {
            error!("Error creating comment: {:?}", err);
            Err(ErrorMessage::new(&format!("Failed to create comment: {}", err)))
        }
    }
}

/// Create a comment with notifications for mentions and assignee
pub async fn create_comment_with_notifications(
    pool: &PgPool,
    input: CreateCommentInput,
    task_title: &str,
    firebase_service: Option<&FirebaseService>,
) -> Result<Uuid, ErrorMessage> {
    info!("Starting create_comment_with_notifications");
    
    // Tạo comment trong database
    let comment_id = create_comment(pool, input.clone()).await?;
    
    // Lấy thông tin về người tạo comment
    let commenter = match get_user_by_id(pool, input.user_id).await {
        Ok(user) => user,
        Err(e) => {
            error!("Error getting commenter info: {:?}", e);
            return Ok(comment_id); // Vẫn trả về comment ID dù không tìm thấy thông tin người dùng
        }
    };
    
    // Lấy danh sách người được mention trong comment
    let mentions = extract_mentions(&input.content);
    let mut notified_users = HashSet::new();
    
    // Thêm người tạo comment vào danh sách đã thông báo để tránh gửi thông báo cho chính họ
    notified_users.insert(input.user_id);
    
    // Gửi thông báo cho mỗi người được mention
    for mention_id in &mentions {
        if notified_users.contains(mention_id) {
            continue; // Bỏ qua nếu đã gửi thông báo cho người này
        }
        
        match create_comment_mention_notification(pool, *mention_id, input.user_id, input.task_id, task_title).await {
            Ok(notification_id) => {
                notified_users.insert(*mention_id);
                
                // Gửi FCM notification nếu có FirebaseService
                if let Some(firebase) = firebase_service {
                    match get_user_by_id(pool, *mention_id).await {
                        Ok(user) => {
                            // Lấy FCM tokens từ user
                            let tokens = match user.fcm_tokens {
                                Some(value) if value.is_array() => {
                                    value.as_array().unwrap().iter()
                                        .filter_map(|t| t.as_str().map(|s| s.to_string()))
                                        .collect::<Vec<String>>()
                                },
                                _ => Vec::new()
                            };
                            
                            if !tokens.is_empty() {
                                let notification_title = format!("You were mentioned in a comment");
                                let notification_body = format!("{} mentioned you in a comment on task '{}'", commenter.name, task_title);
                                
                                let notification_payload = crate::firebase::FcmNotificationPayload {
                                    title: notification_title,
                                    body: notification_body,
                                    icon: None,
                                    click_action: None,
                                };
                                
                                let data_payload = crate::firebase::FcmDataPayload {
                                    notification_id: notification_id.to_string(),
                                    notification_type: "COMMENT_MENTION".to_string(),
                                    project_id: None,
                                    task_id: Some(input.task_id.to_string()),
                                    comment_id: Some(comment_id.to_string()),
                                    user_id: mention_id.to_string(),
                                    sender_id: Some(input.user_id.to_string()),
                                    extra: std::collections::HashMap::new(),
                                };
                                
                                if let Err(e) = firebase.send_fcm_notification_to_multiple(
                                    &tokens,
                                    notification_payload,
                                    data_payload
                                ).await {
                                    error!("Failed to send FCM notification to mentioned user: {:?}", e);
                                } else {
                                    debug!("FCM notification sent successfully to mentioned user: {}", mention_id);
                                }
                            } else {
                                debug!("No FCM tokens found for mentioned user: {}", mention_id);
                            }
                        },
                        Err(e) => error!("Failed to get user for FCM notification: {:?}", e),
                    }
                }
            },
            Err(e) => error!("Failed to create mention notification: {:?}", e),
        }
    }
    
    // Gửi thông báo về comment cho người được giao task (nếu họ chưa được thông báo và không phải người comment)
    let task_info = sqlx::query!(
        "SELECT assignee_id FROM tasks WHERE id = $1",
        input.task_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| ErrorMessage::new(&format!("Failed to fetch task info: {}", e)))?;
    
    if let Some(record) = task_info {
        if let Some(assignee_id) = record.assignee_id {
            if !notified_users.contains(&assignee_id) {
                match create_task_comment_notification(pool, assignee_id, input.user_id, input.task_id, task_title).await {
                    Ok(notification_id) => {
                        // Gửi FCM notification cho assignee
                        if let Some(firebase) = firebase_service {
                            match get_user_by_id(pool, assignee_id).await {
                                Ok(user) => {
                                    // Lấy FCM tokens từ user
                                    let tokens = match user.fcm_tokens {
                                        Some(value) if value.is_array() => {
                                            value.as_array().unwrap().iter()
                                                .filter_map(|t| t.as_str().map(|s| s.to_string()))
                                                .collect::<Vec<String>>()
                                        },
                                        _ => Vec::new()
                                    };
                                    
                                    if !tokens.is_empty() {
                                        let notification_title = format!("New comment on your task");
                                        let notification_body = format!("{} commented on task '{}'", commenter.name, task_title);
                                        
                                        let notification_payload = crate::firebase::FcmNotificationPayload {
                                            title: notification_title,
                                            body: notification_body,
                                            icon: None,
                                            click_action: None,
                                        };
                                        
                                        let data_payload = crate::firebase::FcmDataPayload {
                                            notification_id: notification_id.to_string(),
                                            notification_type: "TASK_COMMENT".to_string(),
                                            project_id: None,
                                            task_id: Some(input.task_id.to_string()),
                                            comment_id: Some(comment_id.to_string()),
                                            user_id: assignee_id.to_string(),
                                            sender_id: Some(input.user_id.to_string()),
                                            extra: std::collections::HashMap::new(),
                                        };
                                        
                                        if let Err(e) = firebase.send_fcm_notification_to_multiple(
                                            &tokens,
                                            notification_payload,
                                            data_payload
                                        ).await {
                                            error!("Failed to send FCM notification to assignee: {:?}", e);
                                        } else {
                                            debug!("FCM notification sent successfully to assignee: {}", assignee_id);
                                        }
                                    } else {
                                        debug!("No FCM tokens found for assignee: {}", assignee_id);
                                    }
                                },
                                Err(e) => error!("Failed to get assignee for FCM notification: {:?}", e),
                            }
                        }
                    },
                    Err(e) => error!("Failed to create task comment notification: {:?}", e),
                }
            }
        }
    }
    
    info!("Completed create_comment_with_notifications");
    Ok(comment_id)
}

/// Get comments for a task
pub async fn get_comments_by_task_id(
    pool: &PgPool,
    task_id: Uuid,
) -> Result<Vec<Comment>, ErrorMessage> {
    debug!("Getting comments for task: {}", task_id);

    let result = sqlx::query_as!(
        Comment,
        r#"
        SELECT c.id, c.task_id, c.user_id, c.content, c.created_at, c.updated_at,
               u.username as "author_name",
               u.avatar_url as "author_avatar"
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.task_id = $1
        ORDER BY c.created_at ASC
        "#,
        task_id
    )
    .fetch_all(pool)
    .await;

    match result {
        Ok(comments) => {
            debug!("Found {} comments for task {}", comments.len(), task_id);
            Ok(comments)
        }
        Err(err) => {
            error!("Error fetching comments: {:?}", err);
            Err(ErrorMessage::new(&format!(
                "Failed to fetch comments: {}",
                err
            )))
        }
    }
} 