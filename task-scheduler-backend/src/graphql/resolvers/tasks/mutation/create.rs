use async_graphql::Context;
use chrono::{DateTime, Utc};
use sqlx::Row;
use uuid::Uuid;
use serde_json::{json, Value as JsonValue};

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::{Task, Assignee, CreateTaskInput};

pub async fn create_task(ctx: &Context<'_>, input: CreateTaskInput) -> Result<Task, async_graphql::Error> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;
    let auth = context.auth.as_ref().ok_or_else(|| AuthError::InvalidCredentials)?;
    let user_id = auth.sub.clone();

    let mut tx = pool.begin().await.map_err(|e| AuthError::Database(e))?;

    let tags_json = input.tags.as_ref().map(|tags| json!(tags));
    let task_id = Uuid::new_v4();
    let now = Utc::now();
    let project_id = Uuid::parse_str(&input.project_id.to_string())?;
    let parent_task_id = input.parent_task_id
        .map(|id| Uuid::parse_str(&id.to_string()))
        .transpose()?;
    let assignee_id = input.assignee_id
        .map(|id| Uuid::parse_str(&id.to_string()))
        .transpose()?;

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
                type, category, progress_type, tags
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
            RETURNING *
        )
        SELECT t.*, 
               u.user_id as assignee_user_id,
               u.username as assignee_username,
               u.avatar_url as assignee_avatar_url,
               u.role::text as assignee_role
        FROM inserted_task t
        LEFT JOIN users u ON t.assignee_id = u.user_id
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
    .bind(input.progress.unwrap_or(0f64))
    .bind(Uuid::parse_str(&user_id)?)
    .bind(now)
    .bind(now)
    .bind(false)
    .bind(assignee_id)
    .bind(None::<DateTime<Utc>>)
    .bind(None::<DateTime<Utc>>)
    .bind(input.type_)
    .bind(input.category)
    .bind(input.progress_type)
    .bind(tags_json)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        eprintln!("Error creating task: {:?}", e);
        AuthError::Database(e)
    })?;

    tx.commit().await.map_err(|e| AuthError::Database(e))?;

    Ok(Task {
        task_id: created.get("task_id"),
        project_id: created.get("project_id"),
        parent_task_id: created.get("parent_task_id"),
        title: created.get("title"),
        description: created.get("description"),
        assignee: created.get::<Option<Uuid>, _>("assignee_user_id").map(|_| Assignee {
            user_id: created.get("assignee_user_id"),
            username: created.get("assignee_username"),
            avatar_url: created.get("assignee_avatar_url"),
            role: created.get("assignee_role")
        }),
        priority_order: created.get("priority_order"),
        start_date: created.get("start_date"),
        due_date: created.get("due_date"),
        actual_start_date: created.get("actual_start_date"),
        actual_end_date: created.get("actual_end_date"),
        effort: created.get("effort"),
        progress: created.get("progress"),
        created_by: created.get("created_by"),
        created_at: created.get("created_at"),
        updated_at: created.get("updated_at"),
        is_deleted: created.get("is_deleted"),
        status: created.get("status"),
        priority: created.get("priority"),
        type_: created.get("type"),
        category: created.get("category"),
        progress_type: created.get("progress_type"),
        tags: created.get::<Option<JsonValue>, _>("tags"),
        child_tasks: Some(Vec::new())
    })
}