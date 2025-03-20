use async_graphql::Context;
use chrono::Utc;
use sqlx::Row;
use uuid::Uuid;
use serde_json::{json, Value as JsonValue};

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::{Task, Assignee, UpdateTaskInput};

pub async fn update_task(ctx: &Context<'_>, input: UpdateTaskInput) -> Result<Task, async_graphql::Error> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;
    let task_id = Uuid::parse_str(&input.task_id.to_string())?;
    
    let mut tx = pool.begin().await.map_err(|e| AuthError::Database(e))?;

    let existing = sqlx::query(
        r#"
        SELECT *
        FROM tasks
        WHERE task_id = $1 AND NOT is_deleted
        "#
    )
    .bind(task_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AuthError::Database(e))?;

    if existing.is_none() {
        return Err(AuthError::Other("Task not found".to_string()).into());
    }

    let tags_json = input.tags.as_ref().map(|tags| json!(tags));
    let now = Utc::now();

    let updated = sqlx::query(
        r#"
        WITH updated_task AS (
            UPDATE tasks 
            SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                status = COALESCE($3, status),
                priority_order = COALESCE($4, priority_order),
                priority = COALESCE($5, priority),
                start_date = COALESCE($6, start_date),
                due_date = COALESCE($7, due_date),
                actual_start_date = COALESCE($8, actual_start_date),
                actual_end_date = COALESCE($9, actual_end_date),
                effort = COALESCE($10, effort),
                progress = COALESCE($11, progress),
                assignee_id = $12,
                type = COALESCE($13, type),
                category = COALESCE($14, category),
                progress_type = COALESCE($15, progress_type),
                tags = COALESCE($16, tags),
                is_deleted = COALESCE($17, is_deleted),
                updated_at = $18
            WHERE task_id = $19
            RETURNING *
        )
        SELECT t.*, 
               u.user_id as assignee_user_id,
               u.username as assignee_username,
               u.avatar_url as assignee_avatar_url,
               u.role::text as assignee_role
        FROM updated_task t
        LEFT JOIN users u ON t.assignee_id = u.user_id
        "#
    )
    .bind(input.title)
    .bind(input.description)
    .bind(input.status)
    .bind(input.priority_order)
    .bind(input.priority)
    .bind(input.start_date)
    .bind(input.due_date)
    .bind(input.actual_start_date)
    .bind(input.actual_end_date)
    .bind(input.effort)
    .bind(input.progress)
    .bind(input.assignee_id.map(|id| Uuid::parse_str(&id.to_string())).transpose()?)
    .bind(input.type_)
    .bind(input.category)
    .bind(input.progress_type)
    .bind(tags_json)
    .bind(input.is_deleted)
    .bind(now)
    .bind(task_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AuthError::Database(e))?;

    tx.commit().await.map_err(|e| AuthError::Database(e))?;

    Ok(Task {
        task_id: updated.get("task_id"),
        project_id: updated.get("project_id"),
        parent_task_id: updated.get("parent_task_id"),
        title: updated.get("title"),
        description: updated.get("description"),
        assignee: updated.get::<Option<Uuid>, _>("assignee_user_id").map(|_| Assignee {
            user_id: updated.get("assignee_user_id"),
            username: updated.get("assignee_username"),
            avatar_url: updated.get("assignee_avatar_url"),
            role: updated.get("assignee_role")
        }),
        priority_order: updated.get("priority_order"),
        start_date: updated.get("start_date"),
        due_date: updated.get("due_date"),
        actual_start_date: updated.get("actual_start_date"),
        actual_end_date: updated.get("actual_end_date"),
        effort: updated.get("effort"),
        progress: updated.get("progress"),
        created_by: updated.get("created_by"),
        created_at: updated.get("created_at"),
        updated_at: updated.get("updated_at"),
        is_deleted: updated.get("is_deleted"),
        status: updated.get::<String, _>("status").into(),
        priority: updated.get::<String, _>("priority").into(),
        type_: updated.get("type"),
        category: updated.get("category"),
        progress_type: updated.get("progress_type"),
        tags: updated.get::<Option<JsonValue>, _>("tags"),
        child_tasks: Some(Vec::new())
    })
}