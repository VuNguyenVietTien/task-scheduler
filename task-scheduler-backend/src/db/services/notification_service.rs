use sqlx::PgPool;
use uuid::Uuid;
use serde_json::json;
use async_graphql::Error;
use std::sync::Arc;

use crate::db::queries::notification::create_notification;
use crate::db::models::CreateNotificationInput;
use crate::websocket::NotificationBroadcaster;
use crate::websocket::NotificationMessage;

/// Broadcast notification through WebSocket
pub async fn broadcast_notification(
    broadcaster: Option<&Arc<NotificationBroadcaster>>, 
    notification_id: Uuid,
    user_id: Uuid,
    type_: &str,
    message: &str,
    content: serde_json::Value,
) {
    if let Some(broadcaster) = broadcaster {
        let notification = NotificationMessage {
            id: notification_id,
            user_id,
            type_: type_.to_string(),
            content,
            created_at: chrono::offset::Utc::now().into(),
        };
        
        println!("Broadcasting notification to websocket: {:?}", notification);
        
        match broadcaster.send(notification) {
            Ok(receivers) => println!("Notification broadcasted to {} receivers", receivers),
            Err(err) => println!("Failed to broadcast notification: {}", err),
        };
    } else {
        println!("No broadcaster available, skipping websocket notification");
    }
}

/// Create a notification for task assignment
pub async fn create_task_assignment_notification(
    pool: &PgPool,
    task_id: Uuid,
    project_id: Uuid,
    assignee_id: Uuid,
    created_by: Uuid,
    task_title: &str,
    broadcaster: Option<&Arc<NotificationBroadcaster>>,
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

    let notification = create_notification(pool, input).await?;
    
    // Broadcast through WebSocket
    broadcast_notification(
        broadcaster,
        notification.notification_id,
        assignee_id,
        "task_assignment",
        &format!("You have been assigned to task: {}", task_title),
        json!({
            "task_id": task_id.to_string(),
            "project_id": project_id.to_string(),
            "task_title": task_title,
        }),
    ).await;

    Ok(())
}

/// Create a notification for task reassignment
pub async fn create_task_reassignment_notification(
    pool: &PgPool,
    task_id: Uuid,
    project_id: Uuid,
    assignee_id: Uuid,
    created_by: Uuid,
    task_title: &str,
    broadcaster: Option<&Arc<NotificationBroadcaster>>,
) -> Result<(), sqlx::Error> {
    // Don't create notification if the assignee is the same as the creator
    if assignee_id == created_by {
        return Ok(());
    }

    let input = CreateNotificationInput {
        user_id: assignee_id,
        project_id: Some(project_id),
        sender_id: Some(created_by),
        type_: "task_reassignment".to_string(),
        reference_type: "task".to_string(),
        reference_id: task_id,
        message: format!("You have been reassigned to task: {}", task_title),
        action: "reassign".to_string(),
        metadata: Some(json!({
            "task_id": task_id.to_string(),
            "project_id": project_id.to_string(),
            "task_title": task_title,
        })),
    };

    let notification = create_notification(pool, input).await?;
    
    // Broadcast through WebSocket
    broadcast_notification(
        broadcaster,
        notification.notification_id,
        assignee_id,
        "task_reassignment",
        &format!("You have been reassigned to task: {}", task_title),
        json!({
            "task_id": task_id.to_string(),
            "project_id": project_id.to_string(),
            "task_title": task_title,
        }),
    ).await;

    Ok(())
}

/// Create a notification for comment mention
pub async fn create_comment_mention_notification(
    pool: &PgPool,
    task_id: Uuid,
    task_title: &str,
    comment_id: Uuid,
    mentioned_user_id: Uuid,
    commenter_id: Uuid,
    project_id: Uuid,
    broadcaster: Option<&Arc<NotificationBroadcaster>>,
) -> Result<(), sqlx::Error> {
    println!(
        "Creating comment mention notification for user: {}, task: {}",
        mentioned_user_id, task_id
    );

    // Don't create notification if the mentioned user is the same as the commenter
    if mentioned_user_id == commenter_id {
        println!("Mentioned user is the same as commenter, skipping notification");
        return Ok(());
    }

    println!(
        "Fetching task title for task: {} to include in notification",
        task_id
    );

    // Get commenter's name
    let commenter = match sqlx::query!(
        r#"
        SELECT username as "username!"
        FROM users
        WHERE user_id = $1
        "#,
        commenter_id
    )
    .fetch_one(pool)
    .await
    {
        Ok(user) => user.username,
        Err(err) => {
            println!("Failed to get commenter name: {}", err);
            "Someone".to_string()
        }
    };

    println!("Creating notification with commenter name: {}", commenter);

    let input = CreateNotificationInput {
        user_id: mentioned_user_id,
        project_id: Some(project_id),
        sender_id: Some(commenter_id),
        type_: "comment_mention".to_string(),
        reference_type: "comment".to_string(),
        reference_id: comment_id,
        message: format!("{} mentioned you in a comment on task: {}", commenter, task_title),
        action: "mention".to_string(),
        metadata: Some(json!({
            "task_id": task_id.to_string(),
            "project_id": project_id.to_string(),
            "task_title": task_title,
            "comment_id": comment_id.to_string(),
            "commenter": commenter,
        })),
    };

    println!("Inserting mention notification into database");
    let notification = create_notification(pool, input).await?;
    println!("Successfully created mention notification");
    
    // Broadcast through WebSocket
    broadcast_notification(
        broadcaster,
        notification.notification_id,
        mentioned_user_id,
        "comment_mention",
        &format!("{} mentioned you in a comment on task: {}", commenter, task_title),
        json!({
            "task_id": task_id.to_string(),
            "project_id": project_id.to_string(),
            "task_title": task_title,
            "comment_id": comment_id.to_string(),
            "commenter": commenter,
        }),
    ).await;

    Ok(())
}

/// Create a notification for a comment on a task
pub async fn create_task_comment_notification(
    pool: &PgPool,
    task_id: Uuid,
    task_title: &str,
    comment_id: Uuid,
    assignee_id: Uuid,
    commenter_id: Uuid,
    project_id: Uuid,
    broadcaster: Option<&Arc<NotificationBroadcaster>>,
) -> Result<(), sqlx::Error> {
    println!(
        "Creating task comment notification for assignee: {}, task: {}",
        assignee_id, task_id
    );

    // Don't create notification if the assignee is the same as the commenter
    if assignee_id == commenter_id {
        println!("Assignee is the same as commenter, skipping notification");
        return Ok(());
    }

    // Get commenter's name
    let commenter = match sqlx::query!(
        r#"
        SELECT username as "username!"
        FROM users
        WHERE user_id = $1
        "#,
        commenter_id
    )
    .fetch_one(pool)
    .await
    {
        Ok(user) => user.username,
        Err(err) => {
            println!("Failed to get commenter name: {}", err);
            "Someone".to_string()
        }
    };

    println!("Creating notification with commenter name: {}", commenter);

    let input = CreateNotificationInput {
        user_id: assignee_id,
        project_id: Some(project_id),
        sender_id: Some(commenter_id),
        type_: "task_comment".to_string(),
        reference_type: "comment".to_string(),
        reference_id: comment_id,
        message: format!("{} commented on your task: {}", commenter, task_title),
        action: "comment".to_string(),
        metadata: Some(json!({
            "task_id": task_id.to_string(),
            "project_id": project_id.to_string(),
            "task_title": task_title,
            "comment_id": comment_id.to_string(),
            "commenter": commenter,
        })),
    };

    println!("Inserting task comment notification into database");
    let notification = create_notification(pool, input).await?;
    println!("Successfully created task comment notification");
    
    // Broadcast through WebSocket
    broadcast_notification(
        broadcaster,
        notification.notification_id,
        assignee_id,
        "task_comment",
        &format!("{} commented on your task: {}", commenter, task_title),
        json!({
            "task_id": task_id.to_string(),
            "project_id": project_id.to_string(),
            "task_title": task_title,
            "comment_id": comment_id.to_string(),
            "commenter": commenter,
        }),
    ).await;

    Ok(())
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