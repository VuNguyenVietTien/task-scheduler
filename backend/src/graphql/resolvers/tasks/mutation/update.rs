use async_graphql::{Context, MaybeUndefined};
use serde_json::{json, Value as JsonValue};
use sqlx::Row;
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::domain::project_member_identity::{self, Field};
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::resolvers::{project_authz, project_catalogs};
use crate::graphql::types::{Assignee, Task, UpdateTaskInput};

fn id_field(
    value: &MaybeUndefined<async_graphql::ID>,
) -> Result<Field<Uuid>, async_graphql::Error> {
    match value {
        MaybeUndefined::Undefined => Ok(Field::Omitted),
        MaybeUndefined::Null => Ok(Field::Null),
        MaybeUndefined::Value(id) if id.to_string().is_empty() => Ok(Field::Null),
        MaybeUndefined::Value(id) => Ok(Field::Value(Uuid::parse_str(&id.to_string())?)),
    }
}

pub async fn update_task(
    ctx: &Context<'_>,
    input: UpdateTaskInput,
) -> Result<Task, async_graphql::Error> {
    let context = ctx.data::<GraphQLContext>()?;
    let caller_id = project_authz::require_user(context)?;
    let task_id = Uuid::parse_str(&input.task_id.to_string())?;
    let mut tx = context.db.begin().await.map_err(AuthError::Database)?;

    let existing = sqlx::query(
        "SELECT project_id, progress_catalog_item_id, category_catalog_item_id, \
         task_type_catalog_item_id, progress_type::text AS progress_legacy, category, type \
         FROM tasks WHERE task_id = $1 AND NOT COALESCE(is_deleted, false)",
    )
    .bind(task_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(AuthError::Database)?
    .ok_or_else(|| async_graphql::Error::new("Task not found"))?;
    let project_id: Uuid = existing.get("project_id");
    project_authz::require_project_write_tx(&mut tx, caller_id, project_id).await?;
    crate::domain::taxonomy::lock_project_hierarchy(&mut *tx, project_id).await?;
    sqlx::query("SELECT task_id FROM tasks WHERE task_id = $1 AND project_id = $2 AND NOT COALESCE(is_deleted, false) FOR UPDATE")
        .bind(task_id).bind(project_id).fetch_optional(&mut *tx).await.map_err(AuthError::Database)?
        .ok_or_else(|| async_graphql::Error::new("Task not found"))?;

    let classifications = project_catalogs::resolve_update_task_catalogs(
        &mut tx,
        project_id,
        project_catalogs::task_catalog_id(&input.progress_catalog_item_id)?,
        project_catalogs::task_catalog_id(&input.category_catalog_item_id)?,
        project_catalogs::task_catalog_id(&input.task_type_catalog_item_id)?,
        project_catalogs::progress_legacy(input.progress_type),
        input.category.clone(),
        input.type_.clone(),
        project_catalogs::TaskCatalogState {
            progress_id: existing.get("progress_catalog_item_id"),
            category_id: existing.get("category_catalog_item_id"),
            task_type_id: existing.get("task_type_catalog_item_id"),
            progress_legacy: existing.get("progress_legacy"),
            category_legacy: existing.get("category"),
            task_type_legacy: existing.get("type"),
        },
    ).await?;
    let legacy_progress_type = project_catalogs::progress_type(classifications.progress_legacy.clone())?;

    let assignment = project_member_identity::normalize_task_assignment(
        &mut tx,
        project_id,
        id_field(&input.assignee_resource_member_id)?,
        id_field(&input.assignee_id)?,
    )
    .await
    .map_err(|error| async_graphql::Error::new(error.to_string()))?;

    let parent = id_field(&input.parent_task_id)?;
    let (parent_changed, parent_task_id) = match parent {
        Field::Omitted => (false, None),
        Field::Null => (true, None),
        Field::Value(parent_id) => {
            let refs = crate::domain::taxonomy::fetch_task_refs(&mut *tx, project_id).await?;
            crate::domain::taxonomy::validate_reparent(task_id, Some(parent_id), &refs).map_err(
                |error| async_graphql::Error::new(format!("invalid parent_task_id: {error:?}")),
            )?;
            (true, Some(parent_id))
        }
    };
    let (assignment_changed, resource_member_id, assignee_id) = match assignment {
        None => (false, None, None),
        Some(None) => (true, None, None),
        Some(Some(value)) => (true, Some(value.resource_member_id), value.user_id),
    };

    let row = sqlx::query(
        r#"
        WITH updated_task AS (
            UPDATE tasks SET
                title = COALESCE($2, title),
                description = COALESCE($3, description),
                status = COALESCE($4::task_status, status),
                priority = COALESCE($5::task_priority, priority),
                priority_order = COALESCE($6, priority_order),
                start_date = COALESCE($7, start_date),
                due_date = COALESCE($8, due_date),
                actual_start_date = COALESCE($9, actual_start_date),
                actual_end_date = COALESCE($10, actual_end_date),
                effort = COALESCE($11, effort),
                progress = COALESCE($12, progress),
                type = $13,
                category = $14,
                progress_type = $15::task_progress_type,
                tags = COALESCE($16, tags),
                is_deleted = COALESCE($17, is_deleted),
                parent_task_id = CASE WHEN $18 THEN $19 ELSE parent_task_id END,
                assignee_resource_member_id = CASE WHEN $20 THEN $21 ELSE assignee_resource_member_id END,
                assignee_id = CASE WHEN $20 THEN $22 ELSE assignee_id END,
                progress_catalog_item_id = $23,
                category_catalog_item_id = $24,
                task_type_catalog_item_id = $25,
                updated_at = now()
            WHERE task_id = $1 RETURNING *
        )
        SELECT t.*, au.user_id AS assignee_user_id, au.username AS assignee_username,
               au.avatar_url AS assignee_avatar_url, au.role::text AS assignee_role,
               cu.user_id AS creator_user_id, cu.username AS creator_username,
               cu.avatar_url AS creator_avatar_url, cu.role::text AS creator_role
        FROM updated_task t
        LEFT JOIN users au ON t.assignee_id = au.user_id
        LEFT JOIN users cu ON t.created_by = cu.user_id
        "#,
    )
    .bind(task_id)
    .bind(input.title)
    .bind(input.description)
    .bind(input.status)
    .bind(input.priority)
    .bind(input.priority_order)
    .bind(input.start_date)
    .bind(input.due_date)
    .bind(input.actual_start_date)
    .bind(input.actual_end_date)
    .bind(input.effort)
    .bind(input.progress)
    .bind(classifications.task_type_legacy)
    .bind(classifications.category_legacy)
    .bind(legacy_progress_type)
    .bind(input.tags.as_ref().map(|tags| json!(tags)))
    .bind(input.is_deleted)
    .bind(parent_changed)
    .bind(parent_task_id)
    .bind(assignment_changed)
    .bind(resource_member_id)
    .bind(assignee_id)
    .bind(classifications.progress_id)
    .bind(classifications.category_id)
    .bind(classifications.task_type_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(AuthError::Database)?
    .ok_or_else(|| async_graphql::Error::new("Task not found"))?;

    let task = Task {
        task_id: row.get("task_id"),
        project_id: row.get("project_id"),
        assignee_resource_member_id: row.get("assignee_resource_member_id"),
        parent_task_id: row.get("parent_task_id"),
        phase_id: row.get("phase_id"),
        category_id: row.get("category_id"),
        progress_catalog_item_id: row.get("progress_catalog_item_id"),
        category_catalog_item_id: row.get("category_catalog_item_id"),
        task_type_catalog_item_id: row.get("task_type_catalog_item_id"),
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
    tx.commit().await.map_err(AuthError::Database)?;
    Ok(task)
}
