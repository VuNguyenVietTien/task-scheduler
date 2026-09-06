use async_graphql::Context;
use chrono::Utc;
use log::error;
use serde_json::Value as JsonValue;
use sqlx::Row;
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::{Assignee, ReorderTasksInput, Task};

pub async fn reorder_tasks(
    ctx: &Context<'_>,
    input: ReorderTasksInput,
) -> Result<Vec<Task>, async_graphql::Error> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;
    let mut tasks = Vec::new();

    let mut tx = pool.begin().await.map_err(|e| AuthError::Database(e))?;

    let project_id = Uuid::parse_str(&input.project_id.to_string())?;

    for order in input.tasks.iter() {
        let task_id = Uuid::parse_str(&order.task_id.to_string())?;
        let now = Utc::now();

        let updated_task = sqlx::query(
            r#"
            WITH updated_task AS (
                UPDATE tasks 
                SET priority_order = $1, updated_at = $2
                WHERE task_id = $3 AND project_id = $4
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
        .bind(order.priority_order)
        .bind(now)
        .bind(task_id)
        .bind(project_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            error!("Error reordering task: {:?}", e);
            AuthError::Database(e)
        })?;

        tasks.push(Task {
            task_id: updated_task.get("task_id"),
            project_id: updated_task.get("project_id"),
            assignee_resource_member_id: updated_task.get("assignee_resource_member_id"),
        parent_task_id: updated_task.get("parent_task_id"),
        phase_id: updated_task.get("phase_id"),
        category_id: updated_task.get("category_id"),
            title: updated_task.get("title"),
            description: updated_task.get("description"),
            assignee: updated_task
                .get::<Option<Uuid>, _>("assignee_user_id")
                .map(|_| Assignee {
                    user_id: updated_task.get("assignee_user_id"),
                    full_name: None,
                    username: updated_task.get("assignee_username"),
                    avatar_url: updated_task.get("assignee_avatar_url"),
                    role: updated_task.get("assignee_role"),
                }),
            priority_order: updated_task.get("priority_order"),
            start_date: updated_task.get("start_date"),
            due_date: updated_task.get("due_date"),
            actual_start_date: updated_task.get("actual_start_date"),
            actual_end_date: updated_task.get("actual_end_date"),
            effort: updated_task.get("effort"),
            progress: updated_task.get("progress"),
            created_by: updated_task.get("created_by"),
            creator: updated_task
                .get::<Option<Uuid>, _>("creator_user_id")
                .map(|_| Assignee {
                    user_id: updated_task.get("creator_user_id"),
                    full_name: None,
                    username: updated_task.get("creator_username"),
                    avatar_url: updated_task.get("creator_avatar_url"),
                    role: updated_task.get("creator_role"),
                }),
            created_at: updated_task.get("created_at"),
            updated_at: updated_task.get("updated_at"),
            is_deleted: updated_task.get("is_deleted"),
            status: updated_task.get("status"),
            priority: updated_task.get("priority"),
            type_: updated_task.get("type"),
            category: updated_task.get("category"),
            progress_type: updated_task.get("progress_type"),
            tags: updated_task.get::<Option<JsonValue>, _>("tags"),
            child_tasks: None,
        });
    }

    tx.commit().await.map_err(|e| AuthError::Database(e))?;

    Ok(tasks)
}
