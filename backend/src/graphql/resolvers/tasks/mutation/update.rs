use async_graphql::Context;
use chrono::Utc;
use serde_json::{json, Value as JsonValue};
use sqlx::Row;
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::{Assignee, Task, UpdateTaskInput};

pub async fn update_task(
    ctx: &Context<'_>,
    input: UpdateTaskInput,
) -> Result<Task, async_graphql::Error> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;
    let task_id = Uuid::parse_str(&input.task_id.to_string())?;

    let mut tx = pool.begin().await.map_err(|e| AuthError::Database(e))?;

    let assignee_resource_member_id = input
        .assignee_resource_member_id
        .as_ref()
        .map(|id| Uuid::parse_str(&id.to_string()))
        .transpose()?;
    // herdr-260906 R5: validate same-project membership for a direct
    // resource-member assignment (placeholders allowed).
    if let Some(member_id) = assignee_resource_member_id {
        let proj: Option<(Uuid,)> = sqlx::query_as(
            "SELECT project_id FROM tasks WHERE task_id = $1 AND NOT COALESCE(is_deleted, false)",
        )
        .bind(task_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
        let project_id = proj
            .ok_or_else(|| async_graphql::Error::new("Task not found"))?
            .0;
        let ok: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM resource_members WHERE resource_member_id = $1 AND project_id = $2)",
        )
        .bind(member_id)
        .bind(project_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
        if !ok {
            return Err(async_graphql::Error::new(
                "assignee_resource_member_id does not belong to this project",
            ));
        }
    }

    let parent_task_id = match &input.parent_task_id {
        Some(id) if id.to_string().is_empty() => None,
        Some(id) => Some(Uuid::parse_str(&id.to_string())?),
        None => None,
    };

    // Task 1.1: reject self / cycle / cross-project re-parenting before the
    // write (design doc §6). The UPDATE below never touches phase_id or
    // category_id, so re-parenting preserves the task's phase/category.
    // Hardening (review P3 TOCTOU): validation reads run through the SAME
    // open transaction as the UPDATE, under the per-project advisory lock,
    // so concurrent opposing reparents serialize instead of both passing
    // validation on stale snapshots and committing a cycle.
    if let Some(new_parent) = parent_task_id {
        let project_row: Option<(Uuid,)> = sqlx::query_as(
            "SELECT project_id FROM tasks WHERE task_id = $1 AND NOT COALESCE(is_deleted, false)",
        )
        .bind(task_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
        let project_id = project_row
            .ok_or_else(|| async_graphql::Error::new("Task not found"))?
            .0;
        crate::domain::taxonomy::lock_project_hierarchy(&mut *tx, project_id).await?;
        let refs = crate::domain::taxonomy::fetch_task_refs(&mut *tx, project_id).await?;
        crate::domain::taxonomy::validate_reparent(task_id, Some(new_parent), &refs)
            .map_err(|e| async_graphql::Error::new(format!("invalid parent_task_id: {e:?}")))?;
    }

    let result = sqlx::query(
        r#"
        WITH updated_task AS (
            UPDATE tasks
            SET 
                title = COALESCE($2, title),
                description = COALESCE($3, description),
                assignee_id = COALESCE($4, assignee_id),
                parent_task_id = $5,
                start_date = COALESCE($6, start_date),
                due_date = COALESCE($7, due_date),
                actual_start_date = COALESCE($8, actual_start_date),
                actual_end_date = COALESCE($9, actual_end_date),
                effort = COALESCE($10, effort),
                progress = COALESCE($11, progress),
                status = COALESCE($12::task_status, status),
                priority = COALESCE($13::task_priority, priority),
                type = COALESCE($14, type),
                category = COALESCE($15, category),
                progress_type = COALESCE($16::task_progress_type, progress_type),
                tags = COALESCE($17, tags),
                assignee_resource_member_id = COALESCE($18, assignee_resource_member_id),
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
    .bind(
        input
            .assignee_id
            .map(|id| Uuid::parse_str(&id.to_string()))
            .transpose()?,
    )
    .bind(parent_task_id)
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
    .bind(assignee_resource_member_id)
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
    };

    tx.commit().await.map_err(|e| AuthError::Database(e))?;

    Ok(task)
}
