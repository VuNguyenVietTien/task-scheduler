use crate::graphql::resolvers::project_authz;
use async_graphql::{Context, ErrorExtensions};
use chrono::Utc;
use log::error;
use serde_json::Value as JsonValue;
use sqlx::Row;
use std::collections::HashSet;
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
    let caller = project_authz::require_user(context)?;
    project_authz::require_project_write_tx(&mut tx, caller, project_id).await?;
    crate::domain::taxonomy::lock_project_hierarchy(&mut *tx, project_id).await?;
    let current: Vec<Uuid> = sqlx::query_scalar(
        "SELECT task_id FROM tasks WHERE project_id = $1 AND NOT COALESCE(is_deleted, false) \
         ORDER BY priority_order, task_id FOR UPDATE",
    )
    .bind(project_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(AuthError::Database)?;
    let invalid = || {
        async_graphql::Error::new(
            "reorder requires every live project task once with unique nonnegative ranks",
        )
        .extend_with(|_, e| e.set("code", "BAD_USER_INPUT"))
    };
    let ids: HashSet<Uuid> = input
        .tasks
        .iter()
        .map(|t| Uuid::parse_str(&t.task_id))
        .collect::<Result<_, _>>()?;
    let ranks: HashSet<i32> = input.tasks.iter().map(|t| t.priority_order).collect();
    if ids.len() != input.tasks.len()
        || ranks.len() != input.tasks.len()
        || input.tasks.iter().any(|t| t.priority_order < 0)
        || ids != current.iter().copied().collect()
    {
        return Err(invalid());
    }
    if let Some(expected) = &input.expected_order {
        let expected: Vec<Uuid> = expected
            .iter()
            .map(|id| Uuid::parse_str(id))
            .collect::<Result<_, _>>()?;
        if expected != current {
            return Err(
                async_graphql::Error::new("task order changed; refresh before retrying")
                    .extend_with(|_, e| e.set("code", "CONFLICT")),
            );
        }
    }

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
            progress_catalog_item_id: updated_task.get("progress_catalog_item_id"),
            category_catalog_item_id: updated_task.get("category_catalog_item_id"),
            task_type_catalog_item_id: updated_task.get("task_type_catalog_item_id"),
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
