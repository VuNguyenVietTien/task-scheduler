use sqlx::PgPool;
use uuid::Uuid;
use crate::db::models::system::System;

pub async fn list_systems(pool: &PgPool, project_id: i64) -> Result<Vec<System>, sqlx::Error> {
    sqlx::query_as::<_, System>("SELECT * FROM systems WHERE project_id = $1 ORDER BY created_at DESC")
        .bind(project_id)
        .fetch_all(pool)
        .await
}

pub async fn get_system(pool: &PgPool, id: Uuid) -> Result<Option<System>, sqlx::Error> {
    sqlx::query_as::<_, System>("SELECT * FROM systems WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_system(
    pool: &PgPool,
    project_id: i64,
    name: &str,
    description: Option<&str>,
    created_by: i64,
) -> Result<System, sqlx::Error> {
    sqlx::query_as::<_, System>(
        "INSERT INTO systems (project_id, name, description, created_by) VALUES ($1, $2, $3, $4) RETURNING *",
    )
    .bind(project_id)
    .bind(name)
    .bind(description)
    .bind(created_by)
    .fetch_one(pool)
    .await
}

pub async fn update_system(
    pool: &PgPool,
    id: Uuid,
    name: Option<&str>,
    description: Option<&str>,
) -> Result<System, sqlx::Error> {
    sqlx::query_as::<_, System>(
        "UPDATE systems SET name = COALESCE($2, name), description = COALESCE($3, description), updated_at = NOW() WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(name)
    .bind(description)
    .fetch_one(pool)
    .await
}

pub async fn delete_system(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM systems WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}
