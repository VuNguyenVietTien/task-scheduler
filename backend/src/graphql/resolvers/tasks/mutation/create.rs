use async_graphql::Context;
use chrono::{DateTime, Utc};
use log::error;
use serde_json::{json, Value as JsonValue};
use sqlx::Row;
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::domain::project_member_identity::{self, Field};
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::resolvers::{project_authz, project_catalogs};
use crate::graphql::types::{Assignee, CreateTaskInput, Task, TaskStatus};

pub async fn create_task(
    ctx: &Context<'_>,
    input: CreateTaskInput,
) -> Result<Task, async_graphql::Error> {
    if input.status == TaskStatus::Rejected {
        return Err(async_graphql::Error::new(
            "REJECTED permanently deletes a task; create a task with another status",
        ));
    }

    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;
    let auth = context
        .auth
        .as_ref()
        .ok_or_else(|| AuthError::InvalidCredentials)?;
    let user_id = auth.sub.clone();

    let mut tx = pool.begin().await.map_err(|e| AuthError::Database(e))?;

    let tags_json = input.tags.as_ref().map(|tags| json!(tags));
    let task_id = Uuid::new_v4();
    let now = Utc::now();
    let project_id = Uuid::parse_str(&input.project_id.to_string())?;
    let parent_task_id = input
        .parent_task_id
        .map(|id| Uuid::parse_str(&id.to_string()))
        .transpose()?;
    let caller_id = Uuid::parse_str(&user_id)?;
    project_authz::require_project_write_tx(&mut tx, caller_id, project_id).await?;
    crate::domain::taxonomy::lock_project_hierarchy(&mut *tx, project_id).await?;
    let classifications = project_catalogs::resolve_create_task_catalogs(
        &mut tx,
        project_id,
        input
            .progress_catalog_item_id
            .as_ref()
            .map(|id| Uuid::parse_str(&id.to_string()))
            .transpose()?,
        input
            .category_catalog_item_id
            .as_ref()
            .map(|id| Uuid::parse_str(&id.to_string()))
            .transpose()?,
        input
            .task_type_catalog_item_id
            .as_ref()
            .map(|id| Uuid::parse_str(&id.to_string()))
            .transpose()?,
        project_catalogs::progress_legacy(input.progress_type),
        input.category.clone(),
        input.type_.clone(),
    )
    .await?;
    let legacy_progress_type =
        project_catalogs::progress_type(classifications.progress_legacy.clone())?;
    let assignment = project_member_identity::normalize_task_assignment(
        &mut tx,
        project_id,
        input
            .assignee_resource_member_id
            .map(|id| Uuid::parse_str(&id.to_string()))
            .transpose()?
            .map_or(Field::Omitted, Field::Value),
        input
            .assignee_id
            .map(|id| Uuid::parse_str(&id.to_string()))
            .transpose()?
            .map_or(Field::Omitted, Field::Value),
    )
    .await
    .map_err(|error| async_graphql::Error::new(error.to_string()))?;
    let (assignee_resource_member_id, assignee_id) = match assignment {
        None | Some(None) => (None, None),
        Some(Some(value)) => (Some(value.resource_member_id), value.user_id),
    };

    // Task 1.1: a new parent must be a non-deleted task of the SAME project
    // (self/cycle cannot occur at creation; cross-project is rejected here).
    if let Some(parent) = parent_task_id {
        let same_project: Option<(Uuid,)> = sqlx::query_as(
            "SELECT project_id FROM tasks WHERE task_id = $1 AND project_id = $2 \
             AND NOT COALESCE(is_deleted, false)",
        )
        .bind(parent)
        .bind(project_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
        if same_project.is_none() {
            return Err("parent_task_id must reference a task in the same project".into());
        }
    }

    let created = sqlx::query(
        r#"
        WITH inserted_task AS (
            INSERT INTO tasks (
                task_id, project_id, parent_task_id,
                title, description, status, priority,
                priority_order, start_date, due_date,
                effort, progress, created_by,
                created_at, updated_at, is_deleted,
                assignee_id, actual_start_date, actual_end_date,
                type, category, progress_type, tags, assignee_resource_member_id,
                progress_catalog_item_id, category_catalog_item_id, task_type_catalog_item_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
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
        FROM inserted_task t
        LEFT JOIN users au ON t.assignee_id = au.user_id
        LEFT JOIN users cu ON t.created_by = cu.user_id
        "#
    )
    .bind(task_id)
    .bind(project_id)
    .bind(parent_task_id)
    .bind(&input.title)
    .bind(input.description.as_ref())
    .bind(input.status)
    .bind(input.priority)
    .bind(input.priority_order)
    .bind(input.start_date)
    .bind(input.due_date)
    .bind(input.effort)
    .bind(0f64) // Default progress to 0
    .bind(caller_id)
    .bind(now)
    .bind(now)
    .bind(false)
    .bind(assignee_id)
    .bind(None::<DateTime<Utc>>)
    .bind(None::<DateTime<Utc>>)
    .bind(classifications.task_type_legacy)
    .bind(classifications.category_legacy)
    .bind(legacy_progress_type)
    .bind(tags_json)
    .bind(assignee_resource_member_id)
    .bind(classifications.progress_id)
    .bind(classifications.category_id)
    .bind(classifications.task_type_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        error!("Error creating task: {:?}", e);
        AuthError::Database(e)
    })?;

    tx.commit().await.map_err(|e| AuthError::Database(e))?;

    Ok(Task {
        task_id: created.get("task_id"),
        project_id: created.get("project_id"),
        assignee_resource_member_id: created.get("assignee_resource_member_id"),
        parent_task_id: created.get("parent_task_id"),
        phase_id: created.get("phase_id"),
        category_id: created.get("category_id"),
        progress_catalog_item_id: created.get("progress_catalog_item_id"),
        category_catalog_item_id: created.get("category_catalog_item_id"),
        task_type_catalog_item_id: created.get("task_type_catalog_item_id"),
        title: created.get("title"),
        description: created.get("description"),
        assignee: created
            .get::<Option<Uuid>, _>("assignee_user_id")
            .map(|_| Assignee {
                user_id: created.get("assignee_user_id"),
                full_name: None,
                username: created.get("assignee_username"),
                avatar_url: created.get("assignee_avatar_url"),
                role: created.get("assignee_role"),
            }),
        priority_order: created.get("priority_order"),
        start_date: created.get("start_date"),
        due_date: created.get("due_date"),
        actual_start_date: created.get("actual_start_date"),
        actual_end_date: created.get("actual_end_date"),
        effort: created.get("effort"),
        progress: created.get("progress"),
        created_by: created.get("created_by"),
        creator: created
            .get::<Option<Uuid>, _>("creator_user_id")
            .map(|_| Assignee {
                user_id: created.get("creator_user_id"),
                full_name: None,
                username: created.get("creator_username"),
                avatar_url: created.get("creator_avatar_url"),
                role: created.get("creator_role"),
            }),
        created_at: created.get("created_at"),
        updated_at: created.get("updated_at"),
        is_deleted: created.get("is_deleted"),
        status: created.get("status"),
        priority: created.get("priority"),
        type_: created.get("type"),
        category: created.get("category"),
        progress_type: created.get("progress_type"),
        tags: created.get::<Option<JsonValue>, _>("tags"),
        child_tasks: None,
    })
}
