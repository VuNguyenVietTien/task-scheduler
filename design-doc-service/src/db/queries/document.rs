use sqlx::PgPool;
use uuid::Uuid;
use crate::db::models::document::DesignDocument;
use crate::db::models::audit::DocumentAudit;

pub async fn list_documents(pool: &PgPool, module_id: Uuid) -> Result<Vec<DesignDocument>, sqlx::Error> {
    sqlx::query_as::<_, DesignDocument>(
        "SELECT * FROM design_documents WHERE module_id = $1 ORDER BY created_at DESC",
    )
    .bind(module_id)
    .fetch_all(pool)
    .await
}

pub async fn get_document(pool: &PgPool, id: Uuid) -> Result<Option<DesignDocument>, sqlx::Error> {
    sqlx::query_as::<_, DesignDocument>("SELECT * FROM design_documents WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_document(
    pool: &PgPool,
    module_id: Uuid,
    name: &str,
    description: Option<&str>,
    created_by: &str,
) -> Result<DesignDocument, sqlx::Error> {
    sqlx::query_as::<_, DesignDocument>(
        "INSERT INTO design_documents (module_id, name, description, created_by) VALUES ($1, $2, $3, $4) RETURNING *",
    )
    .bind(module_id)
    .bind(name)
    .bind(description)
    .bind(created_by)
    .fetch_one(pool)
    .await
}

pub async fn update_document(
    pool: &PgPool,
    id: Uuid,
    name: Option<&str>,
    description: Option<&str>,
    status: Option<&str>,
) -> Result<DesignDocument, sqlx::Error> {
    sqlx::query_as::<_, DesignDocument>(
        "UPDATE design_documents SET name = COALESCE($2, name), description = COALESCE($3, description), status = COALESCE($4, status), updated_at = NOW() WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(name)
    .bind(description)
    .bind(status)
    .fetch_one(pool)
    .await
}

pub async fn delete_document(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM design_documents WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn list_document_audit(pool: &PgPool, document_id: Uuid) -> Result<Vec<DocumentAudit>, sqlx::Error> {
    sqlx::query_as::<_, DocumentAudit>(
        "SELECT * FROM document_audit WHERE entity_id = $1 ORDER BY changed_at DESC",
    )
    .bind(document_id)
    .fetch_all(pool)
    .await
}
