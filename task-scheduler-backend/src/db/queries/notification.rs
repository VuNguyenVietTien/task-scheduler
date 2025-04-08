use sqlx::{PgPool, Row};
use uuid::Uuid;
use chrono::Utc;
use serde_json::Value as JsonValue;

use crate::db::models::{Notification, CreateNotificationInput};
use crate::error::AppError;

/// Get a notification by its ID
pub async fn get_notification_by_id(pool: &PgPool, notification_id: Uuid) -> Result<Option<Notification>, sqlx::Error> {
    let row = sqlx::query(
        "SELECT * FROM notifications WHERE notification_id = $1"
    )
    .bind(notification_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|row| Notification {
        notification_id: row.get("notification_id"),
        user_id: row.get("user_id"),
        project_id: row.get("project_id"),
        sender_id: row.get("sender_id"),
        type_: row.get("type"),
        reference_type: row.get("reference_type"),
        reference_id: row.get("reference_id"),
        message: row.get("message"),
        action: row.get("action"),
        metadata: row.get("metadata"),
        is_read: row.get("is_read"),
        created_at: row.get("created_at"),
        read_at: row.get("read_at"),
    }))
}

/// Get notifications for a user
pub async fn get_user_notifications(
    pool: &PgPool,
    user_id: Uuid,
    limit: i64,
    offset: i64,
) -> Result<Vec<Notification>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT * FROM notifications 
        WHERE user_id = $1 
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        "#
    )
    .bind(user_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|row| Notification {
        notification_id: row.get("notification_id"),
        user_id: row.get("user_id"),
        project_id: row.get("project_id"),
        sender_id: row.get("sender_id"),
        type_: row.get("type"),
        reference_type: row.get("reference_type"),
        reference_id: row.get("reference_id"),
        message: row.get("message"),
        action: row.get("action"),
        metadata: row.get("metadata"),
        is_read: row.get("is_read"),
        created_at: row.get("created_at"),
        read_at: row.get("read_at"),
    }).collect())
}

/// Get unread notifications count for a user
pub async fn get_unread_notifications_count(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<i64, sqlx::Error> {
    let row = sqlx::query(
        r#"
        SELECT COUNT(*) as count 
        FROM notifications 
        WHERE user_id = $1 AND is_read = false
        "#
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(row.try_get::<i64, _>(0).unwrap_or(0))
}

/// Create a new notification
pub async fn create_notification(
    pool: &PgPool,
    input: CreateNotificationInput,
) -> Result<Notification, sqlx::Error> {
    let metadata = input.metadata.unwrap_or(JsonValue::Object(serde_json::Map::new()));
    
    let row = sqlx::query(
        r#"
        INSERT INTO notifications (
            user_id, project_id, sender_id, type, reference_type, 
            reference_id, message, action, metadata, is_read, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
        "#
    )
    .bind(input.user_id)
    .bind(input.project_id)
    .bind(input.sender_id)
    .bind(input.type_)
    .bind(input.reference_type)
    .bind(input.reference_id)
    .bind(input.message)
    .bind(input.action)
    .bind(metadata)
    .bind(false)
    .bind(Utc::now())
    .fetch_one(pool)
    .await?;

    Ok(Notification {
        notification_id: row.get("notification_id"),
        user_id: row.get("user_id"),
        project_id: row.get("project_id"),
        sender_id: row.get("sender_id"),
        type_: row.get("type"),
        reference_type: row.get("reference_type"),
        reference_id: row.get("reference_id"),
        message: row.get("message"),
        action: row.get("action"),
        metadata: row.get("metadata"),
        is_read: row.get("is_read"),
        created_at: row.get("created_at"),
        read_at: row.get("read_at"),
    })
}

/// Mark a notification as read
pub async fn mark_notification_as_read(
    pool: &PgPool,
    notification_id: Uuid,
    user_id: Uuid,
) -> Result<Notification, sqlx::Error> {
    let row = sqlx::query(
        r#"
        UPDATE notifications
        SET is_read = true, read_at = $1
        WHERE notification_id = $2 AND user_id = $3
        RETURNING *
        "#
    )
    .bind(Utc::now())
    .bind(notification_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(Notification {
        notification_id: row.get("notification_id"),
        user_id: row.get("user_id"),
        project_id: row.get("project_id"),
        sender_id: row.get("sender_id"),
        type_: row.get("type"),
        reference_type: row.get("reference_type"),
        reference_id: row.get("reference_id"),
        message: row.get("message"),
        action: row.get("action"),
        metadata: row.get("metadata"),
        is_read: row.get("is_read"),
        created_at: row.get("created_at"),
        read_at: row.get("read_at"),
    })
}

/// Mark all notifications as read for a user
pub async fn mark_all_notifications_as_read(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE notifications
        SET is_read = true, read_at = $1
        WHERE user_id = $2 AND is_read = false
        "#
    )
    .bind(Utc::now())
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
} 