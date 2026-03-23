use sqlx::PgPool;
use uuid::Uuid;
use crate::db::models::external_link::ExternalLink;

pub async fn list_entity_links(pool: &PgPool, entity_type: &str, entity_id: Uuid) -> Result<Vec<ExternalLink>, sqlx::Error> {
    sqlx::query_as::<_, ExternalLink>(
        "SELECT * FROM external_links WHERE entity_type = $1 AND entity_id = $2 ORDER BY provider, created_at"
    )
    .bind(entity_type)
    .bind(entity_id)
    .fetch_all(pool)
    .await
}

pub async fn create_external_link(
    pool: &PgPool,
    entity_type: &str,
    entity_id: Uuid,
    provider: &str,
    external_id: &str,
    external_url: Option<&str>,
) -> Result<ExternalLink, sqlx::Error> {
    sqlx::query_as::<_, ExternalLink>(
        r#"INSERT INTO external_links (entity_type, entity_id, provider, external_id, external_url)
        VALUES ($1, $2, $3, $4, $5) RETURNING *"#,
    )
    .bind(entity_type)
    .bind(entity_id)
    .bind(provider)
    .bind(external_id)
    .bind(external_url)
    .fetch_one(pool)
    .await
}

pub async fn delete_external_link(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM external_links WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn update_sync_status(pool: &PgPool, id: Uuid, sync_status: &str) -> Result<ExternalLink, sqlx::Error> {
    sqlx::query_as::<_, ExternalLink>(
        "UPDATE external_links SET sync_status = $2, last_synced_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(sync_status)
    .fetch_one(pool)
    .await
}
