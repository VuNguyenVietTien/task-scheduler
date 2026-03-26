use sqlx::{postgres::PgRow, PgPool, Row};
use uuid::Uuid;
use crate::db::{
    models::Task,
    helpers::row_to_task,
};

/// Get a task by its ID
pub async fn get_task_by_id(pool: &PgPool, task_id: Uuid) -> Result<Option<Task>, sqlx::Error> {
    let row = sqlx::query(
        "SELECT * FROM tasks WHERE task_id = $1 AND NOT is_deleted"
    )
    .bind(task_id)
    .fetch_optional(pool)
    .await?;

    match row {
        Some(row) => row_to_task(row).map(Some),
        None => Ok(None),
    }
}

/// List all tasks in a project
pub async fn list_project_tasks(
    pool: &PgPool,
    project_id: Uuid,
    parent_task_id: Option<Uuid>,
) -> Result<Vec<Task>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT * 
        FROM tasks 
        WHERE project_id = $1
        AND ($2::uuid IS NULL OR parent_task_id = $2)
        AND NOT is_deleted
        ORDER BY created_at DESC
        "#
    )
    .bind(project_id)
    .bind(parent_task_id)
    .fetch_all(pool)
    .await?;

    let mut tasks = Vec::with_capacity(rows.len());
    for row in rows {
        tasks.push(row_to_task(row)?);
    }
    Ok(tasks)
}

/// Create a new task
pub async fn create_task(pool: &PgPool, task: Task) -> Result<Task, sqlx::Error> {
    let row = sqlx::query(
        r#"
        INSERT INTO tasks (
            task_id, project_id, parent_task_id, title,
            description, assignee_id, status, priority_order,
            start_date, due_date, actual_start_date, actual_end_date,
            effort, progress, created_by, created_at,
            updated_at, is_deleted
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *
        "#
    )
    .bind(task.task_id)
    .bind(task.project_id)
    .bind(task.parent_task_id)
    .bind(&task.title)
    .bind(&task.description)
    .bind(task.assignee_id)
    .bind(task.status)
    .bind(task.priority_order)
    .bind(task.start_date)
    .bind(task.due_date)
    .bind(task.actual_start_date)
    .bind(task.actual_end_date)
    .bind(task.effort)
    .bind(task.progress)
    .bind(task.created_by)
    .bind(task.created_at)
    .bind(task.updated_at)
    .bind(task.is_deleted)
    .fetch_one(pool)
    .await?;

    row_to_task(row)
}

/// Update an existing task
pub async fn update_task(pool: &PgPool, task: Task) -> Result<Task, sqlx::Error> {
    let row = sqlx::query(
        r#"
        UPDATE tasks SET
            title = $2,
            description = $3,
            assignee_id = $4,
            status = $5,
            priority_order = $6,
            start_date = $7,
            due_date = $8,
            actual_start_date = $9,
            actual_end_date = $10,
            effort = $11,
            progress = $12,
            updated_at = $13
        WHERE task_id = $1
        RETURNING *
        "#
    )
    .bind(task.task_id)
    .bind(&task.title)
    .bind(&task.description)
    .bind(task.assignee_id)
    .bind(task.status)
    .bind(task.priority_order)
    .bind(task.start_date)
    .bind(task.due_date)
    .bind(task.actual_start_date)
    .bind(task.actual_end_date)
    .bind(task.effort)
    .bind(task.progress)
    .bind(task.updated_at)
    .fetch_one(pool)
    .await?;

    row_to_task(row)
}

/// Soft delete a task
pub async fn delete_task(pool: &PgPool, task_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE tasks SET is_deleted = true WHERE task_id = $1"
    )
    .bind(task_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Count tasks in a project
pub async fn count_project_tasks(
    pool: &PgPool, 
    project_id: Uuid,
    parent_task_id: Option<Uuid>
) -> Result<i64, sqlx::Error> {
    let row = sqlx::query(
        r#"
        SELECT COUNT(*) as count 
        FROM tasks 
        WHERE project_id = $1
        AND ($2::uuid IS NULL OR parent_task_id = $2)
        AND NOT is_deleted
        "#)
        .bind(project_id)
        .bind(parent_task_id)
    .fetch_one(pool)
    .await?;

    Ok(row.try_get::<i64, _>(0).unwrap_or(0))
}