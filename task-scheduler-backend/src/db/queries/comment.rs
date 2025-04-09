use sqlx::{PgPool, Row};
use uuid::Uuid;
use chrono::Utc;
use serde_json::Value as JsonValue;

use crate::db::models::Comment;

pub struct CommentFilters {
    pub task_id: Option<Uuid>,
    pub parent_comment_id: Option<Uuid>,
    pub pagination: Option<PaginationParams>,
}

pub struct PaginationParams {
    pub page: i64,
    pub per_page: i64,
}

pub async fn get_comment_by_id(pool: &PgPool, comment_id: Uuid) -> Result<Option<Comment>, sqlx::Error> {
    let row = sqlx::query(
        "SELECT * FROM comments WHERE comment_id = $1 AND NOT is_deleted"
    )
    .bind(comment_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|row| Comment {
        comment_id: row.get("comment_id"),
        task_id: row.get("task_id"),
        user_id: row.get("user_id"),
        content: row.get("content"),
        parent_comment_id: row.get("parent_comment_id"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        is_deleted: row.get("is_deleted"),
    }))
}

pub async fn get_comment_replies(pool: &PgPool, parent_id: Uuid) -> Result<Vec<Comment>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT * FROM comments WHERE parent_comment_id = $1 AND NOT is_deleted ORDER BY created_at ASC"
    )
    .bind(parent_id)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|row| Comment {
        comment_id: row.get("comment_id"),
        task_id: row.get("task_id"),
        user_id: row.get("user_id"),
        content: row.get("content"),
        parent_comment_id: row.get("parent_comment_id"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        is_deleted: row.get("is_deleted"),
    }).collect())
}

pub async fn list_comments(pool: &PgPool, filters: &CommentFilters) -> Result<Vec<Comment>, sqlx::Error> {
    let mut query = String::from(
        "SELECT * FROM comments WHERE NOT is_deleted"
    );

    if let Some(task_id) = filters.task_id {
        query.push_str(" AND task_id = $1");
    }
    if let Some(parent_id) = filters.parent_comment_id {
        query.push_str(" AND parent_comment_id = $2");
    }
    query.push_str(" ORDER BY created_at DESC");

    if let Some(ref pagination) = filters.pagination {
        query.push_str(&format!(" LIMIT {} OFFSET {}", 
            pagination.per_page, 
            (pagination.page - 1) * pagination.per_page
        ));
    }

    let rows = match (filters.task_id, filters.parent_comment_id) {
        (Some(task_id), Some(parent_id)) => {
            sqlx::query(&query)
                .bind(task_id)
                .bind(parent_id)
                .fetch_all(pool)
                .await?
        },
        (Some(task_id), None) => {
            sqlx::query(&query)
                .bind(task_id)
                .fetch_all(pool)
                .await?
        },
        (None, Some(parent_id)) => {
            sqlx::query(&query)
                .bind(parent_id)
                .fetch_all(pool)
                .await?
        },
        (None, None) => {
            sqlx::query(&query)
                .fetch_all(pool)
                .await?
        }
    };

    Ok(rows.into_iter().map(|row| Comment {
        comment_id: row.get("comment_id"),
        task_id: row.get("task_id"), 
        user_id: row.get("user_id"),
        content: row.get("content"),
        parent_comment_id: row.get("parent_comment_id"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        is_deleted: row.get("is_deleted"),
    }).collect())
}

pub async fn create_comment(pool: &PgPool, comment: Comment) -> Result<Comment, sqlx::Error> {
    let row = sqlx::query(
        r#"
        INSERT INTO comments (
            comment_id, task_id, user_id, content,
            parent_comment_id, created_at, updated_at, is_deleted
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#
    )
    .bind(comment.comment_id)
    .bind(comment.task_id)
    .bind(comment.user_id)
    .bind(&comment.content)
    .bind(comment.parent_comment_id)
    .bind(comment.created_at)
    .bind(comment.updated_at)
    .bind(comment.is_deleted)
    .fetch_one(pool)
    .await?;

    Ok(Comment {
        comment_id: row.get("comment_id"),
        task_id: row.get("task_id"),
        user_id: row.get("user_id"),
        content: row.get("content"),
        parent_comment_id: row.get("parent_comment_id"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        is_deleted: row.get("is_deleted"),
    })
}

pub async fn create_notification(
    pool: &PgPool,
    user_id: Uuid,
    type_: String,
    content: JsonValue
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO notifications (
            notification_id, user_id, type, content,
            created_at
        ) VALUES ($1, $2, $3, $4, $5)
        "#
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(type_)
    .bind(sqlx::types::Json(content))
    .execute(pool)
    .await?;

    Ok(())
}
