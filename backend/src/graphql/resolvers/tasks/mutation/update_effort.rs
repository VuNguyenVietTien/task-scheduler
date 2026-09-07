use async_graphql::{Context, InputObject, ID};
use chrono::Utc;
use log::error;
use serde_json::Value as JsonValue;
use sqlx::Row;
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::{Assignee, Task};

#[derive(InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct UpdateTaskEffortInput {
    pub task_id: ID,
    pub effort: f64,
}

pub async fn update_task_effort(
    ctx: &Context<'_>,
    input: UpdateTaskEffortInput,
) -> Result<Task, async_graphql::Error> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;
    let task_id = Uuid::parse_str(&input.task_id.to_string())?;

    let mut tx = pool.begin().await.map_err(|e| AuthError::Database(e))?;

    let existing = sqlx::query(
        r#"
        SELECT *
        FROM tasks
        WHERE task_id = $1 AND NOT is_deleted
        "#,
    )
    .bind(task_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AuthError::Database(e))?;

    if existing.is_none() {
        return Err(AuthError::Other("Task not found".to_string()).into());
    }

    let now = Utc::now();

    let updated = sqlx::query(
        r#"
        WITH updated_task AS (
            UPDATE tasks 
            SET effort = $1, updated_at = $2
            WHERE task_id = $3
            RETURNING *
        )
        SELECT t.*, 
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
    .bind(input.effort)
    .bind(now)
    .bind(task_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        error!("Error updating task effort: {:?}", e);
        AuthError::Database(e)
    })?;

    tx.commit().await.map_err(|e| AuthError::Database(e))?;

    Ok(Task {
        task_id: updated.get("task_id"),
        project_id: updated.get("project_id"),
        assignee_resource_member_id: updated.get("assignee_resource_member_id"),
        parent_task_id: updated.get("parent_task_id"),
        phase_id: updated.get("phase_id"),
        category_id: updated.get("category_id"),
        progress_catalog_item_id: updated.get("progress_catalog_item_id"),
        category_catalog_item_id: updated.get("category_catalog_item_id"),
        task_type_catalog_item_id: updated.get("task_type_catalog_item_id"),
        title: updated.get("title"),
        description: updated.get("description"),
        assignee: updated
            .get::<Option<Uuid>, _>("assignee_user_id")
            .map(|_| Assignee {
                user_id: updated.get("assignee_user_id"),
                full_name: None,
                username: updated.get("assignee_username"),
                avatar_url: updated.get("assignee_avatar_url"),
                role: updated.get("assignee_role"),
            }),
        priority_order: updated.get("priority_order"),
        start_date: updated.get("start_date"),
        due_date: updated.get("due_date"),
        actual_start_date: updated.get("actual_start_date"),
        actual_end_date: updated.get("actual_end_date"),
        effort: updated.get("effort"),
        progress: updated.get("progress"),
        created_by: updated.get("created_by"),
        creator: updated
            .get::<Option<Uuid>, _>("creator_user_id")
            .map(|_| Assignee {
                user_id: updated.get("creator_user_id"),
                full_name: None,
                username: updated.get("creator_username"),
                avatar_url: updated.get("creator_avatar_url"),
                role: updated.get("creator_role"),
            }),
        created_at: updated.get("created_at"),
        updated_at: updated.get("updated_at"),
        is_deleted: updated.get("is_deleted"),
        status: updated.get("status"),
        priority: updated.get("priority"),
        type_: updated.get("type"),
        category: updated.get("category"),
        progress_type: updated.get("progress_type"),
        tags: updated.get::<Option<JsonValue>, _>("tags"),
        child_tasks: None,
    })
}
