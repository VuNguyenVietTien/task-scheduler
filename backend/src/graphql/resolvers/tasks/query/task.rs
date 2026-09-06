use async_graphql::{Context, Result, ID};
use serde_json::Value as JsonValue;
use sqlx::Row;
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::{Assignee, Task};

pub async fn task(ctx: &Context<'_>, task_id: ID) -> Result<Option<Task>> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;
    let task_id = Uuid::parse_str(&task_id.to_string())?;

    let task = sqlx::query(
        r#"
        WITH RECURSIVE child_tasks AS (
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
            WHERE t.task_id = $1 AND NOT t.is_deleted
            
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
            INNER JOIN child_tasks ct ON t.parent_task_id = ct.task_id
            WHERE NOT t.is_deleted
        )
        SELECT * FROM child_tasks
        "#,
    )
    .bind(task_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AuthError::Database(e))?;

    if task.is_empty() {
        return Ok(None);
    }

    // Build task hierarchy
    let parent_task = &task[0];
    let child_tasks = task[1..]
        .iter()
        .map(|row| Task {
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
            child_tasks: None,
        })
        .collect::<Vec<_>>();

    Ok(Some(Task {
        task_id: parent_task.get("task_id"),
        project_id: parent_task.get("project_id"),
        assignee_resource_member_id: parent_task.get("assignee_resource_member_id"),
        parent_task_id: parent_task.get("parent_task_id"),
        phase_id: parent_task.get("phase_id"),
        category_id: parent_task.get("category_id"),
        title: parent_task.get("title"),
        description: parent_task.get("description"),
        assignee: parent_task
            .get::<Option<Uuid>, _>("assignee_user_id")
            .map(|_| Assignee {
                user_id: parent_task.get("assignee_user_id"),
                full_name: None,
                username: parent_task.get("assignee_username"),
                avatar_url: parent_task.get("assignee_avatar_url"),
                role: parent_task.get("assignee_role"),
            }),
        priority_order: parent_task.get("priority_order"),
        start_date: parent_task.get("start_date"),
        due_date: parent_task.get("due_date"),
        actual_start_date: parent_task.get("actual_start_date"),
        actual_end_date: parent_task.get("actual_end_date"),
        effort: parent_task.get("effort"),
        progress: parent_task.get("progress"),
        created_by: parent_task.get("created_by"),
        creator: parent_task
            .get::<Option<Uuid>, _>("creator_user_id")
            .map(|_| Assignee {
                user_id: parent_task.get("creator_user_id"),
                full_name: None,
                username: parent_task.get("creator_username"),
                avatar_url: parent_task.get("creator_avatar_url"),
                role: parent_task.get("creator_role"),
            }),
        created_at: parent_task.get("created_at"),
        updated_at: parent_task.get("updated_at"),
        is_deleted: parent_task.get("is_deleted"),
        status: parent_task.get("status"),
        priority: parent_task.get("priority"),
        type_: parent_task.get("type"),
        category: parent_task.get("category"),
        progress_type: parent_task.get("progress_type"),
        tags: parent_task.get::<Option<JsonValue>, _>("tags"),
        child_tasks: Some(child_tasks),
    }))
}
