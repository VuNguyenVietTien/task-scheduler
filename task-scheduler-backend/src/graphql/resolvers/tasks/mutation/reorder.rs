use async_graphql::Context;
use chrono::Utc;
use sqlx::Row;
use uuid::Uuid;
use serde_json::Value as JsonValue;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::{Task, Assignee, ReorderTasksInput};

pub async fn reorder_tasks(ctx: &Context<'_>, input: ReorderTasksInput) -> Result<Vec<Task>, async_graphql::Error> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;
    let mut tx = pool.begin().await.map_err(|e| AuthError::Database(e))?;
    let mut updated_tasks = Vec::new();
    
    for order in input.task_orders {
        let task_id = Uuid::parse_str(&order.task_id.to_string())?;
        
        let updated = sqlx::query(
            r#"
            WITH reordered_task AS (
                UPDATE tasks
                SET 
                    priority_order = $1,
                    updated_at = $2
                WHERE task_id = $3
                RETURNING *
            )
            SELECT t.*, 
                   u.user_id as assignee_user_id,
                   u.username as assignee_username,
                   u.avatar_url as assignee_avatar_url,
                   u.role as assignee_role
            FROM reordered_task t
            LEFT JOIN users u ON t.assignee_id = u.user_id
            "#
        )
        .bind(order.priority_order)
        .bind(Utc::now())
        .bind(task_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AuthError::Database(e))?;

        updated_tasks.push(Task {
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
            progress_type: updated.get::<Option<String>, _>("progress_type")
                .map(|s| s.into()),
            tags: updated.get::<Option<JsonValue>, _>("tags"),
            child_tasks: Some(Vec::new())
        });
    }

    tx.commit().await.map_err(|e| AuthError::Database(e))?;
    
    Ok(updated_tasks)
}