use sqlx::PgPool;
use uuid::Uuid;
use crate::db::{
    models::TaskStatus,
    helpers::row_to_task_status,
};

pub async fn get_task_status_by_id(pool: &PgPool, status_id: Uuid) -> Result<Option<TaskStatus>, sqlx::Error> {
    let row = sqlx::query(
        "SELECT * FROM task_statuses WHERE status_id = $1"
    )
    .bind(status_id)
    .fetch_optional(pool)
    .await?;

    match row {
        Some(row) => row_to_task_status(row).map(Some),
        None => Ok(None),
    }
}

pub async fn list_project_statuses(pool: &PgPool, project_id: Uuid) -> Result<Vec<TaskStatus>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT * 
        FROM task_statuses
        WHERE project_id = $1
        ORDER BY display_order ASC
        "#
    )
    .bind(project_id)
    .fetch_all(pool)
    .await?;

    let mut statuses = Vec::with_capacity(rows.len());
    for row in rows {
        statuses.push(row_to_task_status(row)?);
    }
    Ok(statuses)
}

pub async fn create_task_status(pool: &PgPool, status: TaskStatus) -> Result<TaskStatus, sqlx::Error> {
    let row = sqlx::query(
        r#"
        INSERT INTO task_statuses (
            status_id, project_id, name, description,
            color, display_order, is_default, is_done,
            created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        "#
    )
    .bind(status.status_id)
    .bind(status.project_id)
    .bind(&status.name)
    .bind(status.description)
    .bind(&status.color)
    .bind(status.display_order)
    .bind(status.is_default)
    .bind(status.is_done)
    .bind(status.created_at)
    .bind(status.updated_at)
    .fetch_one(pool)
    .await?;

    row_to_task_status(row)
}

pub async fn update_task_status(pool: &PgPool, status: TaskStatus) -> Result<TaskStatus, sqlx::Error> {
    let row = sqlx::query(
        r#"
        UPDATE task_statuses SET
            name = $2,
            description = $3,
            color = $4,
            display_order = $5,
            is_default = $6,
            is_done = $7,
            updated_at = $8
        WHERE status_id = $1
        RETURNING *
        "#
    )
    .bind(status.status_id)
    .bind(&status.name)
    .bind(status.description)
    .bind(&status.color)
    .bind(status.display_order)
    .bind(status.is_default)
    .bind(status.is_done)
    .bind(status.updated_at)
    .fetch_one(pool)
    .await?;

    row_to_task_status(row)
}

pub async fn delete_task_status(pool: &PgPool, status_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query(
        "DELETE FROM task_statuses WHERE status_id = $1"
    )
    .bind(status_id)
    .execute(pool)
    .await?;

    Ok(())
}