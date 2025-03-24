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

    let result = sqlx::query(
        r#"
        WITH updated_task AS (
            UPDATE tasks
            SET 
                title = COALESCE($2, title),
                description = COALESCE($3, description),
                assignee_id = COALESCE($4, assignee_id),
                start_date = COALESCE($5, start_date),
                due_date = COALESCE($6, due_date),
                actual_start_date = COALESCE($7, actual_start_date),
                actual_end_date = COALESCE($8, actual_end_date),
                effort = COALESCE($9, effort),
                progress = COALESCE($10, progress),
                status = COALESCE($11::task_status, status),
                priority = COALESCE($12::task_priority, priority),
                type = COALESCE($13::task_type, type),
                category = COALESCE($14::task_category, category),
                progress_type = COALESCE($15::task_progress_type, progress_type),
                tags = COALESCE($16, tags),
                updated_at = NOW()
            WHERE task_id = $1
            RETURNING *
        )
        SELECT 
            t.*,
            au.user_id as assignee_user_id,
            au.username as assignee_username,
            au.avatar_url as assignee_avatar_url,
            au.role::text as assignee_role,
            cu.user_id as creator_user_id,
            cu.username as creator_username,
            cu.avatar_url as creator_avatar_url,
            cu.role::text as creator_role
        FROM updated_task t
        LEFT JOIN users au ON t.assignee_id = au.user_id
        LEFT JOIN users cu ON t.created_by = cu.user_id
        "#,
    )
    .bind(task_id)
    .bind(input.title)
    .bind(input.description)
    .bind(input.assignee_id.map(|id| Uuid::parse_str(&id.to_string())).transpose()?)
    .bind(input.start_date)
    .bind(input.due_date)
    .bind(input.actual_start_date)
    .bind(input.actual_end_date)
    .bind(input.effort)
    .bind(input.progress)
    .bind(input.status)
    .bind(input.priority)
    .bind(input.type_)
    .bind(input.category)
    .bind(input.progress_type)
    .bind(input.tags.as_ref().map(|tags| json!(tags)))
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| AuthError::Database(e))?;

    if result.is_empty() {
        return Err("Task not found".into());
    }

    let row = &result[0];

    let task = Task {
        task_id: row.get("task_id"),
        project_id: row.get("project_id"),
        parent_task_id: row.get("parent_task_id"),
        title: row.get("title"),
        description: row.get("description"),
        assignee: row.get::<Option<Uuid>, _>("assignee_user_id").map(|_| Assignee {
            user_id: row.get("assignee_user_id"),
            username: row.get("assignee_username"),
            avatar_url: row.get("assignee_avatar_url"),
            role: row.get("assignee_role")
        }),
        priority_order: row.get("priority_order"),
        start_date: row.get("start_date"),
        due_date: row.get("due_date"),
        actual_start_date: row.get("actual_start_date"),
        actual_end_date: row.get("actual_end_date"),
        effort: row.get("effort"),
        progress: row.get("progress"),
        created_by: row.get("created_by"),
        creator: row.get::<Option<Uuid>, _>("creator_user_id").map(|_| Assignee {
            user_id: row.get("creator_user_id"),
            username: row.get("creator_username"),
            avatar_url: row.get("creator_avatar_url"),
            role: row.get("creator_role")
        }),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        is_deleted: row.get("is_deleted"),
        status: row.get("status"),
        priority: row.get("priority"),
        type_: row.get("type"),
        category: row.get("category"),
        progress_type: row.get("progress_type"),
        tags: row.get::<Option<JsonValue>, _>("tags"),
        child_tasks: None,
    };

    tx.commit().await.map_err(|e| AuthError::Database(e))?;

    Ok(task)
}