use sqlx::PgPool;
use uuid::Uuid;
use crate::db::models::component::Component;

pub async fn list_components(pool: &PgPool, screen_id: Uuid) -> Result<Vec<Component>, sqlx::Error> {
    sqlx::query_as::<_, Component>(
        "SELECT * FROM components WHERE screen_id = $1 ORDER BY sort_order, custom_id",
    )
    .bind(screen_id)
    .fetch_all(pool)
    .await
}

pub async fn get_component(pool: &PgPool, id: Uuid) -> Result<Option<Component>, sqlx::Error> {
    sqlx::query_as::<_, Component>("SELECT * FROM components WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_component(
    pool: &PgPool,
    screen_id: Uuid,
    custom_id: &str,
    name: &str,
    component_type: Option<&str>,
    data_type: Option<&str>,
    display_logic: Option<&str>,
    position: &serde_json::Value,
    svg_element_id: Option<&str>,
    descriptions: Option<&serde_json::Value>,
    sort_order: Option<i32>,
) -> Result<Component, sqlx::Error> {
    sqlx::query_as::<_, Component>(
        r#"INSERT INTO components
            (screen_id, custom_id, name, component_type, data_type, display_logic,
             position, svg_element_id, descriptions, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, '{}'), COALESCE($10, 0))
        RETURNING *"#,
    )
    .bind(screen_id)
    .bind(custom_id)
    .bind(name)
    .bind(component_type)
    .bind(data_type)
    .bind(display_logic)
    .bind(position)
    .bind(svg_element_id)
    .bind(descriptions)
    .bind(sort_order)
    .fetch_one(pool)
    .await
}

pub async fn update_component(
    pool: &PgPool,
    id: Uuid,
    custom_id: Option<&str>,
    name: Option<&str>,
    component_type: Option<&str>,
    data_type: Option<&str>,
    display_logic: Option<&str>,
    position: Option<&serde_json::Value>,
    svg_element_id: Option<&str>,
    descriptions: Option<&serde_json::Value>,
) -> Result<Component, sqlx::Error> {
    sqlx::query_as::<_, Component>(
        r#"UPDATE components SET
            custom_id = COALESCE($2, custom_id),
            name = COALESCE($3, name),
            component_type = COALESCE($4, component_type),
            data_type = COALESCE($5, data_type),
            display_logic = COALESCE($6, display_logic),
            position = COALESCE($7, position),
            svg_element_id = COALESCE($8, svg_element_id),
            descriptions = COALESCE($9, descriptions),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *"#,
    )
    .bind(id)
    .bind(custom_id)
    .bind(name)
    .bind(component_type)
    .bind(data_type)
    .bind(display_logic)
    .bind(position)
    .bind(svg_element_id)
    .bind(descriptions)
    .fetch_one(pool)
    .await
}

pub async fn delete_component(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM components WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn find_by_svg_element_ids(
    pool: &PgPool,
    screen_id: Uuid,
    svg_element_ids: &[String],
) -> Result<Vec<Component>, sqlx::Error> {
    sqlx::query_as::<_, Component>(
        "SELECT * FROM components WHERE screen_id = $1 AND svg_element_id = ANY($2)",
    )
    .bind(screen_id)
    .bind(svg_element_ids)
    .fetch_all(pool)
    .await
}
