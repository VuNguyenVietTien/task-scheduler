use sqlx::PgPool;
use uuid::Uuid;
use serde_json::json;
use async_graphql::Error;
use chrono::Utc;

use crate::db::queries::notification::create_notification;
use crate::db::models::CreateNotificationInput;
use crate::firebase::{FirebaseService, FcmNotificationPayload, FcmDataPayload};
use crate::db::queries::user::get_fcm_tokens;

/// Create a notification for task assignment
pub async fn create_task_assignment_notification(
    pool: &PgPool,
    task_id: Uuid,
    project_id: Uuid,
    assignee_id: Uuid,
    created_by: Uuid,
    task_title: &str,
) -> Result<(), sqlx::Error> {
    // Don't create notification if the assignee is the same as the creator
    if assignee_id == created_by {
        return Ok(());
    }

    let input = CreateNotificationInput {
        user_id: assignee_id,
        project_id: Some(project_id),
        sender_id: Some(created_by),
        type_: "task_assignment".to_string(),
        reference_type: "task".to_string(),
        reference_id: task_id,
        message: format!("You have been assigned to task: {}", task_title),
        action: "assign".to_string(),
        metadata: Some(json!({
            "task_id": task_id.to_string(),
            "project_id": project_id.to_string(),
            "task_title": task_title,
        })),
    };

    create_notification(pool, input).await?;
    Ok(())
}

/// Create a notification for task reassignment
pub async fn create_task_reassignment_notification(
    pool: &PgPool,
    task_id: Uuid,
    project_id: Uuid,
    assignee_id: Uuid,
    updated_by: Uuid,
    task_title: &str,
) -> Result<(), sqlx::Error> {
    // Don't create notification if the assignee is the same as the updater
    if assignee_id == updated_by {
        return Ok(());
    }

    let input = CreateNotificationInput {
        user_id: assignee_id,
        project_id: Some(project_id),
        sender_id: Some(updated_by),
        type_: "task_reassignment".to_string(),
        reference_type: "task".to_string(),
        reference_id: task_id,
        message: format!("You have been assigned to task: {}", task_title),
        action: "reassign".to_string(),
        metadata: Some(json!({
            "task_id": task_id.to_string(),
            "project_id": project_id.to_string(),
            "task_title": task_title,
        })),
    };

    create_notification(pool, input).await?;
    Ok(())
}

/// Create a notification for comment mention
pub async fn create_comment_mention_notification(
    pool: &PgPool,
    mentioned_user_id: Uuid,
    task_id: Uuid,
    task_title: &str,
    comment_id: Uuid,
    comment_content: &str,
    mentioned_by: Uuid,
    firebase_service: Option<&FirebaseService>,
) -> Result<Uuid, sqlx::Error> {
    // Don't create notification if the mentioned user is the same as the comment creator
    if mentioned_user_id == mentioned_by {
        println!("Not creating mention notification, mentioned user is the comment creator");
        return Ok(Uuid::nil());
    }

    let notification_id = Uuid::new_v4();

    println!("Creating mention notification - Getting task info for task_id: {}", task_id);
    
    // Get project ID for the task
    let task = sqlx::query!(
        r#"
        SELECT project_id FROM tasks WHERE task_id = $1
        "#,
        task_id
    )
    .fetch_one(pool)
    .await?;

    // Get mentioned by user info
    let mentioner = sqlx::query!(
        r#"
        SELECT username FROM users WHERE user_id = $1
        "#,
        mentioned_by
    )
    .fetch_one(pool)
    .await?;

    // Create notification message
    let mentioner_name = mentioner.username.unwrap_or_else(|| "Someone".to_string());
    let message = format!("{} mentioned you in a comment on task: {}", mentioner_name, task_title);
    println!("Notification message: {}", message);

    // Create metadata with task and comment info
    let metadata = serde_json::json!({
        "taskId": task_id.to_string(),
        "projectId": task.project_id.to_string(),
        "commentId": comment_id.to_string(),
        "taskTitle": task_title,
        "excerpt": truncate_comment(comment_content, 100),
    });
    println!("Notification metadata: {}", metadata);

    // Lưu thông báo vào bảng notifications - Cải thiện xử lý lỗi
    let notification = sqlx::query!(
        r#"
        INSERT INTO notifications (
            notification_id, user_id, type, reference_type, reference_id,
            message, is_read, created_at, project_id, sender_id, action, metadata
        )
        VALUES (
            $1, $2, 'COMMENT_MENTION', 'comment', $3,
            $4, false, $5, $6, $7, 'comment_mention', $8
        )
        RETURNING notification_id
        "#,
        notification_id,
        mentioned_user_id,
        comment_id,
        message,
        Utc::now(),
        task.project_id,
        mentioned_by,
        metadata
    )
    .fetch_one(pool)
    .await?;

    // Send push notification via FCM if firebase service is available
    if let Some(firebase) = firebase_service {
        // Get FCM tokens for the mentioned user
        match get_fcm_tokens(pool, mentioned_user_id).await {
            Ok(tokens) if !tokens.is_empty() => {
                println!("Found {} FCM tokens for user {}", tokens.len(), mentioned_user_id);
                
                // Create FCM notification payload
                let notification_payload = FcmNotificationPayload {
                    title: format!("You were mentioned by {}", mentioner_name),
                    body: format!("In task: {}", task_title),
                    icon: None,
                    click_action: Some("OPEN_TASK".to_string()),
                };
                
                // Create FCM data payload
                let data_payload = FcmDataPayload {
                    notification_id: notification_id.to_string(),
                    notification_type: "COMMENT_MENTION".to_string(),
                    project_id: Some(task.project_id.to_string()),
                    task_id: Some(task_id.to_string()),
                    comment_id: Some(comment_id.to_string()),
                    user_id: mentioned_user_id.to_string(),
                    sender_id: Some(mentioned_by.to_string()),
                    extra: std::collections::HashMap::new(),
                };
                
                // Send notifications to all tokens
                match firebase.send_fcm_notification_to_multiple(&tokens, notification_payload, data_payload).await {
                    Ok(_) => println!("Successfully sent FCM notifications for mention"),
                    Err(e) => println!("Failed to send FCM notifications: {}", e),
                }
            },
            Ok(_) => println!("No FCM tokens found for user {}", mentioned_user_id),
            Err(e) => println!("Error fetching FCM tokens: {}", e),
        }
    } else {
        println!("Firebase service not available, skipping FCM notification");
    }

    println!("Successfully created mention notification with ID: {}", notification_id);
    Ok(notification_id)
}

/// Create a notification for task comment
pub async fn create_task_comment_notification(
    pool: &PgPool,
    user_id: Uuid,
    task_id: Uuid,
    task_title: &str,
    comment_id: Uuid,
    comment_content: &str,
    commenter_id: Uuid,
    firebase_service: Option<&FirebaseService>,
) -> Result<Uuid, sqlx::Error> {
    // Don't create notification if the user is the same as the commenter
    if user_id == commenter_id {
        println!("Not creating task comment notification, user is the commenter");
        return Ok(Uuid::nil());
    }

    let notification_id = Uuid::new_v4();
    
    // Get project ID for the task
    let task = sqlx::query!(
        r#"
        SELECT project_id FROM tasks WHERE task_id = $1
        "#,
        task_id
    )
    .fetch_one(pool)
    .await?;

    // Get commenter info
    let commenter = sqlx::query!(
        r#"
        SELECT username FROM users WHERE user_id = $1
        "#,
        commenter_id
    )
    .fetch_one(pool)
    .await?;

    // Create notification message
    let commenter_name = commenter.username.unwrap_or_else(|| "Someone".to_string());
    let message = format!("{} commented on your task: {}", commenter_name, task_title);
    
    println!("Creating task comment notification: user_id={}, task_id={}, commenter_id={}", 
        user_id, task_id, commenter_id);
    println!("Notification message: {}", message);
    
    // Lưu thông báo vào bảng notifications với schema phù hợp
    let notification = sqlx::query!(
        r#"
        INSERT INTO notifications (
            notification_id, user_id, type, reference_type, reference_id,
            message, is_read, created_at, project_id, sender_id, action, metadata
        )
        VALUES (
            $1, $2, 'TASK_COMMENT', 'comment', $3,
            $4, false, $5, $6, $7, 'task_comment', $8
        )
        RETURNING notification_id
        "#,
        notification_id,
        user_id,
        comment_id,
        message,
        Utc::now(),
        task.project_id,
        commenter_id,
        serde_json::json!({
            "taskId": task_id.to_string(),
            "projectId": task.project_id.to_string(),
            "commentId": comment_id.to_string(),
            "taskTitle": task_title,
            "excerpt": truncate_comment(comment_content, 100),
        })
    )
    .fetch_one(pool)
    .await?;

    // Send push notification via FCM if firebase service is available
    if let Some(firebase) = firebase_service {
        // Get FCM tokens for the task owner
        match get_fcm_tokens(pool, user_id).await {
            Ok(tokens) if !tokens.is_empty() => {
                println!("Found {} FCM tokens for user {}", tokens.len(), user_id);
                
                // Create FCM notification payload
                let notification_payload = FcmNotificationPayload {
                    title: format!("New comment from {}", commenter_name),
                    body: format!("On task: {}", task_title),
                    icon: None,
                    click_action: Some("OPEN_TASK".to_string()),
                };
                
                // Create FCM data payload
                let data_payload = FcmDataPayload {
                    notification_id: notification_id.to_string(),
                    notification_type: "TASK_COMMENT".to_string(),
                    project_id: Some(task.project_id.to_string()),
                    task_id: Some(task_id.to_string()),
                    comment_id: Some(comment_id.to_string()),
                    user_id: user_id.to_string(),
                    sender_id: Some(commenter_id.to_string()),
                    extra: std::collections::HashMap::new(),
                };
                
                // Send notifications to all tokens
                match firebase.send_fcm_notification_to_multiple(&tokens, notification_payload, data_payload).await {
                    Ok(_) => println!("Successfully sent FCM notifications for task comment"),
                    Err(e) => println!("Failed to send FCM notifications: {}", e),
                }
            },
            Ok(_) => println!("No FCM tokens found for user {}", user_id),
            Err(e) => println!("Error fetching FCM tokens: {}", e),
        }
    }

    println!("Successfully created task comment notification with ID: {}", notification_id);
    Ok(notification_id)
}

// Helper function to truncate comment content for notification
fn truncate_comment(content: &str, max_length: usize) -> String {
    if content.len() <= max_length {
        content.to_string()
    } else {
        let mut truncated = content.chars().take(max_length - 3).collect::<String>();
        truncated.push_str("...");
        truncated
    }
}

pub async fn get_notifications_by_user_id(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<Notification>, sqlx::Error> {
    sqlx::query_as!(
        Notification,
        r#"
        SELECT id, user_id, task_id, type, title, message, read, created_at, updated_at
        FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        "#,
        user_id
    )
    .fetch_all(pool)
    .await
}

pub async fn get_notification_by_id(
    pool: &PgPool,
    notification_id: Uuid,
) -> Result<Option<Notification>, sqlx::Error> {
    sqlx::query_as!(
        Notification,
        r#"
        SELECT id, user_id, task_id, type, title, message, read, created_at, updated_at
        FROM notifications
        WHERE id = $1
        "#,
        notification_id
    )
    .fetch_optional(pool)
    .await
}

// pub async fn mark_notification_as_read(
//     pool: &PgPool,
//     notification_id: Uuid,
// ) -> Result<(), sqlx::Error> {
//     sqlx::query!(
//         r#"
//         UPDATE notifications
//         SET read = true, updated_at = NOW()
//         WHERE notification_id = $1
//         "#,
//         notification_id
//     )
//     .execute(pool)
//     .await?;
    
//     Ok(())
// }

pub async fn mark_all_notifications_as_read(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE notifications
        SET read = true, updated_at = NOW()
        WHERE user_id = $1 AND read = false
        "#,
        user_id
    )
    .execute(pool)
    .await?;
    
    Ok(())
}

pub async fn get_notification_count(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<NotificationCount, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE read = false) as unread
        FROM notifications
        WHERE user_id = $1
        "#,
        user_id
    )
    .fetch_one(pool)
    .await?;
    
    Ok(NotificationCount {
        total: result.total.unwrap_or(0) as i32,
        unread: result.unread.unwrap_or(0) as i32,
    })
}

#[derive(Debug, sqlx::FromRow)]
pub struct Notification {
    pub id: Uuid,
    pub user_id: Uuid,
    pub task_id: Option<Uuid>,
    pub type_: String,
    pub title: String,
    pub message: String,
    pub read: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug)]
pub struct NotificationCount {
    pub total: i32,
    pub unread: i32,
} 