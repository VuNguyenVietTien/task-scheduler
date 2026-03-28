use sqlx::PgPool;
use uuid::Uuid;
use crate::db::models::screen::Screen;

pub async fn list_screens(pool: &PgPool, document_id: Uuid) -> Result<Vec<Screen>, sqlx::Error> {
    sqlx::query_as::<_, Screen>(
        "SELECT * FROM screens WHERE document_id = $1 ORDER BY sort_order, created_at",
    )
    .bind(document_id)
    .fetch_all(pool)
    .await
}

pub async fn get_screen(pool: &PgPool, id: Uuid) -> Result<Option<Screen>, sqlx::Error> {
    sqlx::query_as::<_, Screen>("SELECT * FROM screens WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_screen(
    pool: &PgPool,
    document_id: Uuid,
    name: &str,
    breakpoint: &str,
    sort_order: Option<i32>,
) -> Result<Screen, sqlx::Error> {
    sqlx::query_as::<_, Screen>(
        "INSERT INTO screens (document_id, name, breakpoint, sort_order) VALUES ($1, $2, $3, COALESCE($4, 0)) RETURNING *",
    )
    .bind(document_id)
    .bind(name)
    .bind(breakpoint)
    .bind(sort_order)
    .fetch_one(pool)
    .await
}

pub async fn update_screen(
    pool: &PgPool,
    id: Uuid,
    name: Option<&str>,
    svg_content: Option<&str>,
    svg_layers: Option<&serde_json::Value>,
    frame_width: Option<i32>,
    frame_height: Option<i32>,
    content_type: Option<&str>,
) -> Result<Screen, sqlx::Error> {
    sqlx::query_as::<_, Screen>(
        "UPDATE screens SET name = COALESCE($2, name), svg_content = COALESCE($3, svg_content), svg_layers = COALESCE($4, svg_layers), frame_width = COALESCE($5, frame_width), frame_height = COALESCE($6, frame_height), content_type = COALESCE($7, content_type), updated_at = NOW() WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(name)
    .bind(svg_content)
    .bind(svg_layers)
    .bind(frame_width)
    .bind(frame_height)
    .bind(content_type)
    .fetch_one(pool)
    .await
}

pub async fn clear_screen_design(pool: &PgPool, id: Uuid) -> Result<Screen, sqlx::Error> {
    // Delete associated components so user starts fresh
    sqlx::query("DELETE FROM components WHERE screen_id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    sqlx::query_as::<_, Screen>(
        "UPDATE screens SET svg_content = NULL, svg_layers = NULL, frame_width = NULL, frame_height = NULL, content_type = 'svg', updated_at = NOW() WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .fetch_one(pool)
    .await
}

pub async fn delete_screen(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM screens WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}
