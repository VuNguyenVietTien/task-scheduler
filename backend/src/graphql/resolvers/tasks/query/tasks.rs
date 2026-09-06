use async_graphql::{Context, Result, ID};
use serde_json::Value as JsonValue;
use sqlx::Row;
use std::collections::HashMap;
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::{Assignee, Task};

pub async fn tasks(
    ctx: &Context<'_>,
    project_id: Option<ID>,
    status: Option<String>,
    assignee_id: Option<ID>,
) -> Result<Vec<Task>> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;

    let project_id = project_id
        .map(|id| Uuid::parse_str(&id.to_string()))
        .transpose()?;
    let assignee_id = assignee_id
        .map(|id| Uuid::parse_str(&id.to_string()))
        .transpose()?;

    let tasks = sqlx::query(
        r#"
        WITH RECURSIVE task_tree AS (
            SELECT t.*, 
                au.user_id as assignee_user_id,
                au.username as assignee_username,
                au.avatar_url as assignee_avatar_url,
                au.role::text as assignee_role,
                cu.user_id as creator_user_id,
                cu.username as creator_username,
                cu.avatar_url as creator_avatar_url,
                cu.role::text as creator_role
            FROM tasks t
            LEFT JOIN users au ON t.assignee_id = au.user_id
            LEFT JOIN users cu ON t.created_by = cu.user_id
            WHERE NOT t.is_deleted
            AND t.parent_task_id IS NULL
            AND ($1::uuid IS NULL OR t.project_id = $1)
            AND ($2::text IS NULL OR t.status::text = $2)
            AND ($3::uuid IS NULL OR t.assignee_id = $3)
            
            UNION ALL
            
            SELECT t.*, 
                au.user_id as assignee_user_id,
                au.username as assignee_username,
                au.avatar_url as assignee_avatar_url,
                au.role::text as assignee_role,
                cu.user_id as creator_user_id,
                cu.username as creator_username,
                cu.avatar_url as creator_avatar_url,
                cu.role::text as creator_role
            FROM tasks t
            LEFT JOIN users au ON t.assignee_id = au.user_id
            LEFT JOIN users cu ON t.created_by = cu.user_id
            INNER JOIN task_tree tt ON t.parent_task_id = tt.task_id
            WHERE NOT t.is_deleted
        )
        SELECT * FROM task_tree
        ORDER BY priority_order ASC
        "#,
    )
    .bind(project_id)
    .bind(status)
    .bind(assignee_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AuthError::Database(e))?;

    // Build the hierarchy from flat rows via the shared pure assembler
    // (domain::taxonomy::assemble_forest) so arbitrary depth materializes
    // correctly regardless of row order AND corrupt data (legacy parent
    // cycles, self-parents, orphans) can never panic the query: every row
    // surfaces exactly once, corrupt rows fall back to root (review P3).
    let mut rows: Vec<crate::domain::taxonomy::ForestRow<Task>> =
        Vec::with_capacity(tasks.len());
    for row in &tasks {
        let task = Task {
            task_id: row.get("task_id"),
            project_id: row.get("project_id"),
            assignee_resource_member_id: row.get("assignee_resource_member_id"),
            parent_task_id: row.get("parent_task_id"),
            phase_id: row.get("phase_id"),
            category_id: row.get("category_id"),
            title: row.get("title"),
            description: row.get("description"),
            assignee: row
                .get::<Option<Uuid>, _>("assignee_user_id")
                .map(|_| Assignee {
                    user_id: row.get("assignee_user_id"),
                    full_name: None,
                    username: row.get("assignee_username"),
                    avatar_url: row.get("assignee_avatar_url"),
                    role: row.get("assignee_role"),
                }),
            priority_order: row.get("priority_order"),
            start_date: row.get("start_date"),
            due_date: row.get("due_date"),
            actual_start_date: row.get("actual_start_date"),
            actual_end_date: row.get("actual_end_date"),
            effort: row.get("effort"),
            progress: row.get("progress"),
            created_by: row.get("created_by"),
            creator: row
                .get::<Option<Uuid>, _>("creator_user_id")
                .map(|_| Assignee {
                    user_id: row.get("creator_user_id"),
                    full_name: None,
                    username: row.get("creator_username"),
                    avatar_url: row.get("creator_avatar_url"),
                    role: row.get("creator_role"),
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
            child_tasks: Some(Vec::new()),
        };

        rows.push(crate::domain::taxonomy::ForestRow {
            task_id: row.get("task_id"),
            parent_task_id: row.get("parent_task_id"),
            payload: task,
        });
    }

    let forest = crate::domain::taxonomy::assemble_forest(rows);

    // Re-attach materialized children onto each GraphQL Task node.
    fn flatten(mut task: Task, children: Vec<Task>) -> Task {
        task.child_tasks = Some(children);
        task
    }
    fn attach(node: crate::domain::taxonomy::ForestTree<Task>) -> Task {
        let children = node.children.into_iter().map(attach).collect();
        flatten(node.payload, children)
    }

    // Roots only, in unchanged healthy order. Healthy fetched sets are
    // closed under parent (recursive CTE), so ordering is identical to the
    // previous assembler; corrupt rows surface as extra roots instead of
    // dropping/crashing.
    Ok(forest.into_iter().map(attach).collect())
}
