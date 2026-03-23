use sqlx::PgPool;
use uuid::Uuid;
use crate::db::models::field_mapping::FieldMapping;

pub async fn list_field_mappings(
    pool: &PgPool,
    component_id: Uuid,
) -> Result<Vec<FieldMapping>, sqlx::Error> {
    sqlx::query_as::<_, FieldMapping>(
        "SELECT * FROM field_mappings WHERE component_id = $1 ORDER BY db_table, db_column",
    )
    .bind(component_id)
    .fetch_all(pool)
    .await
}

pub async fn create_field_mapping(
    pool: &PgPool,
    component_id: Uuid,
    db_table: &str,
    db_column: &str,
    description: Option<&str>,
) -> Result<FieldMapping, sqlx::Error> {
    sqlx::query_as::<_, FieldMapping>(
        "INSERT INTO field_mappings (component_id, db_table, db_column, description) \
         VALUES ($1, $2, $3, $4) RETURNING *",
    )
    .bind(component_id)
    .bind(db_table)
    .bind(db_column)
    .bind(description)
    .fetch_one(pool)
    .await
}

pub async fn delete_field_mapping(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM field_mappings WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}
