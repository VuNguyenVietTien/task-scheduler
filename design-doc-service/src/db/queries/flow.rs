use sqlx::PgPool;
use uuid::Uuid;
use crate::db::models::flow::{Flow, FlowStep};

/// List all flows for a given document, ordered by creation time.
pub async fn list_flows(pool: &PgPool, document_id: Uuid) -> Result<Vec<Flow>, sqlx::Error> {
    sqlx::query_as::<_, Flow>(
        "SELECT * FROM flows WHERE document_id = $1 ORDER BY created_at",
    )
    .bind(document_id)
    .fetch_all(pool)
    .await
}

/// Get a single flow by id.
pub async fn get_flow(pool: &PgPool, id: Uuid) -> Result<Option<Flow>, sqlx::Error> {
    sqlx::query_as::<_, Flow>("SELECT * FROM flows WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await
}

/// Create a new flow for a document.
pub async fn create_flow(
    pool: &PgPool,
    document_id: Uuid,
    name: &str,
    description: Option<&str>,
    mermaid_definition: Option<&str>,
    flow_type: &str,
) -> Result<Flow, sqlx::Error> {
    sqlx::query_as::<_, Flow>(
        "INSERT INTO flows (document_id, name, description, mermaid_definition, flow_type) \
         VALUES ($1, $2, $3, $4, $5) RETURNING *",
    )
    .bind(document_id)
    .bind(name)
    .bind(description)
    .bind(mermaid_definition)
    .bind(flow_type)
    .fetch_one(pool)
    .await
}

/// Update mutable fields of a flow; NULL inputs leave the current value unchanged.
pub async fn update_flow(
    pool: &PgPool,
    id: Uuid,
    name: Option<&str>,
    description: Option<&str>,
    mermaid_definition: Option<&str>,
) -> Result<Flow, sqlx::Error> {
    sqlx::query_as::<_, Flow>(
        "UPDATE flows SET \
         name = COALESCE($2, name), \
         description = COALESCE($3, description), \
         mermaid_definition = COALESCE($4, mermaid_definition), \
         updated_at = NOW() \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(name)
    .bind(description)
    .bind(mermaid_definition)
    .fetch_one(pool)
    .await
}

/// Delete a flow by id; returns true if a row was removed.
pub async fn delete_flow(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM flows WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

/// List all steps for a flow, ordered by step_order.
pub async fn list_flow_steps(pool: &PgPool, flow_id: Uuid) -> Result<Vec<FlowStep>, sqlx::Error> {
    sqlx::query_as::<_, FlowStep>(
        "SELECT * FROM flow_steps WHERE flow_id = $1 ORDER BY step_order",
    )
    .bind(flow_id)
    .fetch_all(pool)
    .await
}

/// Add a step to a flow.
pub async fn create_flow_step(
    pool: &PgPool,
    flow_id: Uuid,
    screen_id: Option<Uuid>,
    component_id: Option<Uuid>,
    step_order: i32,
    label: Option<&str>,
    description: Option<&str>,
) -> Result<FlowStep, sqlx::Error> {
    sqlx::query_as::<_, FlowStep>(
        "INSERT INTO flow_steps (flow_id, screen_id, component_id, step_order, label, description) \
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    )
    .bind(flow_id)
    .bind(screen_id)
    .bind(component_id)
    .bind(step_order)
    .bind(label)
    .bind(description)
    .fetch_one(pool)
    .await
}

/// Delete a flow step by id; returns true if a row was removed.
pub async fn delete_flow_step(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM flow_steps WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}
