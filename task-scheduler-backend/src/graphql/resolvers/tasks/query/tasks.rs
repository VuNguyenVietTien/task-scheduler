use async_graphql::{Context, Result, ID};
use sqlx::Row;
use uuid::Uuid;
use serde_json::Value as JsonValue;
use std::collections::HashMap;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::{Task, Assignee};

pub async fn tasks(
    ctx: &Context<'_>,
    project_id: Option<ID>,
    status: Option<String>,
    assignee_id: Option<ID>
) -> Result<Vec<Task>> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;
    
    let project_id = project_id.map(|id| Uuid::parse_str(&id.to_string())).transpose()?;
    let assignee_id = assignee_id.map(|id| Uuid::parse_str(&id.to_string())).transpose()?;
    
    let tasks = sqlx::query(
        r#"
        WITH RECURSIVE task_tree AS (
            SELECT t.*, 
                u.user_id as assignee_user_id,
                u.username as assignee_username,
                u.avatar_url as assignee_avatar_url,
                u.role as assignee_role
            FROM tasks t
            LEFT JOIN users u ON t.assignee_id = u.user_id
            WHERE NOT t.is_deleted
            AND t.parent_task_id IS NULL
            AND ($1::uuid IS NULL OR t.project_id = $1)
            AND ($2::text IS NULL OR t.status::text = $2)
            AND ($3::uuid IS NULL OR t.assignee_id = $3)
            
            UNION ALL
            
            SELECT t.*, 
                u.user_id as assignee_user_id,
                u.username as assignee_username,
                u.avatar_url as assignee_avatar_url,
                u.role as assignee_role
            FROM tasks t
            LEFT JOIN users u ON t.assignee_id = u.user_id
            INNER JOIN task_tree tt ON t.parent_task_id = tt.task_id
            WHERE NOT t.is_deleted
        )
        SELECT * FROM task_tree
        ORDER BY priority_order ASC
        "#
    )
    .bind(project_id)
    .bind(status)
    .bind(assignee_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AuthError::Database(e))?;

    // Build task tree
    let mut task_map = HashMap::new();
    let mut root_tasks = Vec::new();

    // First pass: create all tasks
    for row in &tasks {
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
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            is_deleted: row.get("is_deleted"),
            status: row.get("status"),
            priority: row.get("priority"),
            type_: row.get("type"),
            category: row.get("category"),
            progress_type: row.get("progress_type"),
            tags: row.get::<Option<JsonValue>, _>("tags"),
            child_tasks: Some(Vec::new())
        };

        let task_id: Uuid = row.get("task_id");
        if row.get::<Option<Uuid>, _>("parent_task_id").is_none() {
            root_tasks.push(task_id);
        }
        task_map.insert(task_id, task);
    }

    // Second pass: build tree structure
    for row in &tasks {
        if let Some(parent_id) = row.get::<Option<Uuid>, _>("parent_task_id") {
            let task_id: Uuid = row.get("task_id");
            if let Some(task) = task_map.get(&task_id).cloned() {
                if let Some(parent_task) = task_map.get_mut(&parent_id) {
                    if let Some(children) = &mut parent_task.child_tasks {
                        children.push(task);
                    }
                }
            }
        }
    }

    // Return only root tasks
    Ok(root_tasks.into_iter()
        .filter_map(|id| task_map.get(&id))
        .cloned()
        .collect())
}