use async_graphql::{Context, InputObject, ID};
use chrono::Utc;
use sqlx::Row;
use uuid::Uuid;
use serde_json::Value as JsonValue;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::{Task, Assignee};

#[derive(InputObject)]
#[graphql(rename_fields = "camelCase")]
pub struct UpdateTaskEffortInput {
    pub task_id: ID,
    pub effort: f64,
}

pub async fn update_task_effort(ctx: &Context<'_>, input: UpdateTaskEffortInput) -> Result<Task, async_graphql::Error> {
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

    let now = Utc::now();

    // Chỉ cập nhật trường effort, không động đến assignee_id
    let updated = sqlx::query(
        r#"
        WITH updated_task AS (
            UPDATE tasks 
            SET
                effort = $1,
                updated_at = $2
            WHERE task_id = $3
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
    .bind(input.effort)
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
        status: updated.get("status"),
        priority: updated.get("priority"),
        type_: updated.get("type"),
        category: updated.get("category"),
        progress_type: updated.get("progress_type"),
        tags: updated.get::<Option<JsonValue>, _>("tags"),
        child_tasks: Some(Vec::new())
    })
} 