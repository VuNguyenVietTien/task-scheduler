use sqlx::PgPool;
use uuid::Uuid;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, sqlx::FromRow, Serialize, Deserialize)]
pub struct ImpactResult {
    pub component_id: Uuid,
    pub component_custom_id: String,
    pub component_name: String,
    pub screen_id: Uuid,
    pub screen_name: String,
    pub document_id: Uuid,
    pub document_name: String,
    pub db_table: String,
    pub db_column: String,
}

/// Find all components that reference a specific db_table.db_column field mapping,
/// optionally scoped to a system.
pub async fn field_impact(
    pool: &PgPool,
    db_table: &str,
    db_column: &str,
    system_id: Option<Uuid>,
) -> Result<Vec<ImpactResult>, sqlx::Error> {
    if let Some(sid) = system_id {
        sqlx::query_as::<_, ImpactResult>(
            r#"SELECT c.id as component_id, c.custom_id as component_custom_id, c.name as component_name,
                s.id as screen_id, s.name as screen_name, d.id as document_id, d.name as document_name,
                fm.db_table, fm.db_column
            FROM field_mappings fm
            JOIN components c ON fm.component_id = c.id
            JOIN screens s ON c.screen_id = s.id
            JOIN design_documents d ON s.document_id = d.id
            JOIN modules m ON d.module_id = m.id
            WHERE fm.db_table = $1 AND fm.db_column = $2 AND m.system_id = $3
            ORDER BY d.name, s.name, c.custom_id"#,
        )
        .bind(db_table)
        .bind(db_column)
        .bind(sid)
        .fetch_all(pool)
        .await
    } else {
        sqlx::query_as::<_, ImpactResult>(
            r#"SELECT c.id as component_id, c.custom_id as component_custom_id, c.name as component_name,
                s.id as screen_id, s.name as screen_name, d.id as document_id, d.name as document_name,
                fm.db_table, fm.db_column
            FROM field_mappings fm
            JOIN components c ON fm.component_id = c.id
            JOIN screens s ON c.screen_id = s.id
            JOIN design_documents d ON s.document_id = d.id
            WHERE fm.db_table = $1 AND fm.db_column = $2
            ORDER BY d.name, s.name, c.custom_id"#,
        )
        .bind(db_table)
        .bind(db_column)
        .fetch_all(pool)
        .await
    }
}

/// Find all components that share the same field mappings (db_table/db_column) as the given component.
pub async fn component_dependencies(
    pool: &PgPool,
    component_id: Uuid,
) -> Result<Vec<ImpactResult>, sqlx::Error> {
    sqlx::query_as::<_, ImpactResult>(
        r#"WITH target_fields AS (
            SELECT db_table, db_column FROM field_mappings WHERE component_id = $1
        )
        SELECT DISTINCT c.id as component_id, c.custom_id as component_custom_id, c.name as component_name,
            s.id as screen_id, s.name as screen_name, d.id as document_id, d.name as document_name,
            fm.db_table, fm.db_column
        FROM target_fields tf
        JOIN field_mappings fm ON fm.db_table = tf.db_table AND fm.db_column = tf.db_column
        JOIN components c ON fm.component_id = c.id
        JOIN screens s ON c.screen_id = s.id
        JOIN design_documents d ON s.document_id = d.id
        WHERE c.id != $1
        ORDER BY d.name, s.name, c.custom_id"#,
    )
    .bind(component_id)
    .fetch_all(pool)
    .await
}
