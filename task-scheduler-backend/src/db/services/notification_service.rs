use sqlx::PgPool;
use uuid::Uuid;
use serde_json::json;
use async_graphql::Error;

use crate::db::queries::notification::create_notification;
use crate::db::models::CreateNotificationInput;

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
    mentioned_by: Uuid,
    comment_id: Uuid,
) -> Result<Uuid, sqlx::Error> {
    // Don't create notification if the mentioned user is the same as the comment creator
    if mentioned_user_id == mentioned_by {
        return Ok(Uuid::nil());
    }

    let notification_id = Uuid::new_v4();
    
    println!("Creating mention notification - Getting task info for task_id: {}", task_id);
    
    // Lấy thông tin task để hiển thị trong thông báo
    let task_info = sqlx::query!(
        r#"
        SELECT title, project_id FROM tasks WHERE task_id = $1
        "#,
        task_id
    )
    .fetch_one(pool)
    .await?;
    
    println!("Task info retrieved: title={}, project_id={}", task_info.title, task_info.project_id);
    
    // Lấy tên người mention
    let user_info = sqlx::query!(
        r#"
        SELECT username FROM users WHERE user_id = $1
        "#,
        mentioned_by
    )
    .fetch_one(pool)
    .await?;
    
    println!("User info retrieved: username={}", user_info.username);
    
    let message = format!("{} mentioned you in a comment on task: {}", 
        user_info.username, task_info.title);
    
    // Log thông tin để debug
    println!("Creating mention notification: mentioned_user_id={}, task_id={}, mentioned_by={}, comment_id={}", 
        mentioned_user_id, task_id, mentioned_by, comment_id);
    println!("Notification message: {}", message);
    
    // Prepare metadata
    let metadata = serde_json::json!({
        "comment_id": comment_id.to_string(),
        "task_id": task_id.to_string(),
        "task_title": task_info.title,
        "project_id": task_info.project_id.to_string(),
    });
    
    println!("Notification metadata: {}", metadata);
    
    // Lưu thông báo vào bảng notifications - Cải thiện xử lý lỗi
    let result = sqlx::query!(
        r#"
        INSERT INTO notifications (
            notification_id, user_id, type, reference_type, reference_id, 
            message, is_read, created_at, project_id, sender_id, action, metadata
        )
        VALUES (
            $1, $2, 'COMMENT_MENTION', 'comment', $3, 
            $4, false, CURRENT_TIMESTAMP, $5, $6, 'mention',
            $7::jsonb
        )
        "#,
        notification_id,
        mentioned_user_id,
        comment_id,
        message,
        task_info.project_id,
        mentioned_by,
        metadata.to_string()
    )
    .execute(pool)
    .await;
    
    match result {
        Ok(_) => {
            println!("Successfully created mention notification with ID: {}", notification_id);
            Ok(notification_id)
        },
        Err(e) => {
            println!("Error creating mention notification: {}", e);
            Err(e)
        }
    }
}

pub async fn create_task_comment_notification(
    pool: &PgPool,
    user_id: Uuid,
    task_id: Uuid,
    commenter_id: Uuid,
) -> Result<Uuid, sqlx::Error> {
    // Don't create notification if the user is the same as the commenter
    if user_id == commenter_id {
        return Ok(Uuid::nil());
    }

    let notification_id = Uuid::new_v4();
    
    // Lấy thông tin task để hiển thị trong thông báo
    let task_info = sqlx::query!(
        r#"
        SELECT title, project_id FROM tasks WHERE task_id = $1
        "#,
        task_id
    )
    .fetch_one(pool)
    .await?;
    
    // Lấy tên người comment
    let user_info = sqlx::query!(
        r#"
        SELECT username FROM users WHERE user_id = $1
        "#,
        commenter_id
    )
    .fetch_one(pool)
    .await?;
    
    let message = format!("{} commented on task: {}", 
        user_info.username, task_info.title);
    
    // Log thông tin để debug
    println!("Creating task comment notification: user_id={}, task_id={}, commenter_id={}", 
        user_id, task_id, commenter_id);
    println!("Notification message: {}", message);
    
    // Lưu thông báo vào bảng notifications với schema phù hợp
    let result = sqlx::query!(
        r#"
        INSERT INTO notifications (
            notification_id, user_id, type, reference_type, reference_id, 
            message, is_read, created_at, project_id, sender_id, action, metadata
        )
        VALUES (
            $1, $2, 'TASK_COMMENT', 'task', $3, 
            $4, false, CURRENT_TIMESTAMP, $5, $6, 'comment',
            $7::jsonb
        )
        "#,
        notification_id,
        user_id,
        task_id,
        message,
        task_info.project_id,
        commenter_id,
        serde_json::json!({
            "task_id": task_id.to_string(),
            "task_title": task_info.title,
            "project_id": task_info.project_id.to_string(),
        }).to_string()
    )
    .execute(pool)
    .await;
    
    match result {
        Ok(_) => {
            println!("Successfully created task comment notification with ID: {}", notification_id);
            Ok(notification_id)
        },
        Err(e) => {
            println!("Error creating task comment notification: {}", e);
            Err(e)
        }
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

pub async fn mark_notification_as_read(
    pool: &PgPool,
    notification_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE notifications
        SET read = true, updated_at = NOW()
        WHERE id = $1
        "#,
        notification_id
    )
    .execute(pool)
    .await?;
    
    Ok(())
}

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