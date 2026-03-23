use sqlx::PgPool;
use uuid::Uuid;
use crate::db::models::module::Module;

pub async fn list_modules(pool: &PgPool, system_id: Uuid) -> Result<Vec<Module>, sqlx::Error> {
    sqlx::query_as::<_, Module>(
        "SELECT * FROM modules WHERE system_id = $1 ORDER BY sort_order, created_at",
    )
    .bind(system_id)
    .fetch_all(pool)
    .await
}

pub async fn get_module(pool: &PgPool, id: Uuid) -> Result<Option<Module>, sqlx::Error> {
    sqlx::query_as::<_, Module>("SELECT * FROM modules WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_module(
    pool: &PgPool,
    system_id: Uuid,
    name: &str,
    description: Option<&str>,
    sort_order: Option<i32>,
) -> Result<Module, sqlx::Error> {
    sqlx::query_as::<_, Module>(
        "INSERT INTO modules (system_id, name, description, sort_order) VALUES ($1, $2, $3, COALESCE($4, 0)) RETURNING *",
    )
    .bind(system_id)
    .bind(name)
    .bind(description)
    .bind(sort_order)
    .fetch_one(pool)
    .await
}

pub async fn update_module(
    pool: &PgPool,
    id: Uuid,
    name: Option<&str>,
    description: Option<&str>,
    sort_order: Option<i32>,
) -> Result<Module, sqlx::Error> {
    sqlx::query_as::<_, Module>(
        "UPDATE modules SET name = COALESCE($2, name), description = COALESCE($3, description), sort_order = COALESCE($4, sort_order), updated_at = NOW() WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(name)
    .bind(description)
    .bind(sort_order)
    .fetch_one(pool)
    .await
}

pub async fn delete_module(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM modules WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}
