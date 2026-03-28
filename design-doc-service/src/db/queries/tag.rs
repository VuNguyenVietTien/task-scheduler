use sqlx::PgPool;
use uuid::Uuid;
use crate::db::models::tag::{Tag, EntityTag};

pub async fn list_tags(pool: &PgPool) -> Result<Vec<Tag>, sqlx::Error> {
    sqlx::query_as::<_, Tag>("SELECT * FROM design_tags ORDER BY name")
        .fetch_all(pool)
        .await
}

pub async fn create_tag(pool: &PgPool, name: &str, color: Option<&str>) -> Result<Tag, sqlx::Error> {
    sqlx::query_as::<_, Tag>("INSERT INTO design_tags (name, color) VALUES ($1, $2) RETURNING *")
        .bind(name)
        .bind(color)
        .fetch_one(pool)
        .await
}

pub async fn delete_tag(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM design_tags WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn get_entity_tags(
    pool: &PgPool,
    entity_type: &str,
    entity_id: Uuid,
) -> Result<Vec<Tag>, sqlx::Error> {
    sqlx::query_as::<_, Tag>(
        "SELECT t.* FROM design_tags t JOIN entity_tags et ON t.id = et.tag_id WHERE et.entity_type = $1 AND et.entity_id = $2 ORDER BY t.name",
    )
    .bind(entity_type)
    .bind(entity_id)
    .fetch_all(pool)
    .await
}

pub async fn add_entity_tag(
    pool: &PgPool,
    tag_id: Uuid,
    entity_type: &str,
    entity_id: Uuid,
) -> Result<EntityTag, sqlx::Error> {
    // Use ON CONFLICT with DO UPDATE to always return a row (idempotent upsert)
    sqlx::query_as::<_, EntityTag>(
        "INSERT INTO entity_tags (tag_id, entity_type, entity_id) VALUES ($1, $2, $3) ON CONFLICT (tag_id, entity_type, entity_id) DO UPDATE SET tag_id = EXCLUDED.tag_id RETURNING *",
    )
    .bind(tag_id)
    .bind(entity_type)
    .bind(entity_id)
    .fetch_one(pool)
    .await
}

pub async fn remove_entity_tag(
    pool: &PgPool,
    tag_id: Uuid,
    entity_type: &str,
    entity_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        "DELETE FROM entity_tags WHERE tag_id = $1 AND entity_type = $2 AND entity_id = $3",
    )
    .bind(tag_id)
    .bind(entity_type)
    .bind(entity_id)
    .execute(pool)
    .await?;
    Ok(result.rows_affected() > 0)
}
