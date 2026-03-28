use async_graphql::{Context, Result, ID};
use serde_json::Value as JsonValue;
use sqlx::Row;
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::{Assignee, Task};

pub async fn task_subtasks(ctx: &Context<'_>, task_id: ID) -> Result<Vec<Task>> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;
    let task_id = Uuid::parse_str(&task_id.to_string())?;

    // Truy vấn để lấy tất cả các task con
    let subtasks = sqlx::query(
        r#"
        SELECT t.*, 
            u.user_id as assignee_user_id,
            u.username as assignee_username,
            u.avatar_url as assignee_avatar_url,
            u.role::text as assignee_role,
            c.user_id as creator_user_id,
            c.username as creator_username,
            c.avatar_url as creator_avatar_url,
            c.role::text as creator_role
        FROM tasks t
        LEFT JOIN users u ON t.assignee_id = u.user_id
        LEFT JOIN users c ON t.created_by = c.user_id
        WHERE t.parent_task_id = $1 AND NOT t.is_deleted
        ORDER BY t.priority_order, t.created_at
        "#,
    )
    .bind(task_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AuthError::Database(e))?;

    let mut result = Vec::new();

    // Chuyển đổi kết quả thành danh sách Task
    for row in subtasks {
        let assignee = row
            .get::<Option<Uuid>, _>("assignee_user_id")
            .map(|_| Assignee {
                user_id: row.get("assignee_user_id"),
                username: row.get("assignee_username"),
                avatar_url: row.get("assignee_avatar_url"),
                role: row.get("assignee_role"),
            });

        let creator = row
            .get::<Option<Uuid>, _>("creator_user_id")
            .map(|_| Assignee {
                user_id: row.get("creator_user_id"),
                username: row.get("creator_username"),
                avatar_url: row.get("creator_avatar_url"),
                role: row.get("creator_role"),
            });

        let task = Task {
            task_id: row.get("task_id"),
            project_id: row.get("project_id"),
            parent_task_id: row.get("parent_task_id"),
            title: row.get("title"),
            description: row.get("description"),
            assignee,
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
            child_tasks: None,
            creator,
        };

        result.push(task);
    }

    Ok(result)
}
