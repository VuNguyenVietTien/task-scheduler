use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{types::Json as SqlxJson, Error, PgPool};
use uuid::Uuid;
// Sử dụng std::result::Result để tránh xung đột với sqlx::Result
use std::result::Result;

// Define the Plan struct based on the database schema
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Plan {
    pub id: Uuid,
    pub project_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub created_by: Uuid,
    pub plan_data: SqlxJson<PlanData>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// Define PlanData struct for the JSONB field
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PlanData {
    #[serde(default)]
    pub tasks: Vec<PlanTask>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanTask {
    #[serde(rename = "taskId")]
    pub task_id: Uuid,
    #[serde(rename = "priorityOrder")]
    pub priority_order: i32,
    #[serde(rename = "startDate")]
    pub start_date: Option<DateTime<Utc>>,
    #[serde(rename = "dueDate")]
    pub due_date: Option<DateTime<Utc>>,
}

// Define input struct for creating a plan
#[derive(Debug, Clone)]
pub struct CreatePlanDbInput {
    pub project_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub plan_data: SqlxJson<PlanData>,
    // created_by will be added in the function
}

// Define input struct for updating a plan
#[derive(Debug, Clone)]
pub struct UpdatePlanDbInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub plan_data: Option<SqlxJson<PlanData>>,
    pub is_active: Option<bool>,
}

// --- Database Operations ---

pub async fn create(pool: &PgPool, user_id: Uuid, input: CreatePlanDbInput) -> Result<Plan, Error> {
    // Corrected: Concatenate SQL string
    sqlx::query_as::<_, Plan>(
        r#"
        INSERT INTO plans (project_id, name, description, created_by, plan_data, is_active)
        VALUES ($1, $2, $3, $4, $5, false)
        RETURNING *
        "#,
    )
    .bind(input.project_id)
    .bind(input.name)
    .bind(input.description)
    .bind(user_id) // Use the provided user_id
    .bind(input.plan_data)
    .fetch_one(pool)
    .await
}

pub async fn update(
    pool: &PgPool,
    plan_id: Uuid,
    input: UpdatePlanDbInput,
) -> Result<Option<Plan>, Error> {
    // Corrected: Concatenate SQL string
    sqlx::query_as::<_, Plan>(
        r#"
        UPDATE plans SET
          name = COALESCE($1, name),
          description = COALESCE($2, description),
          plan_data = COALESCE($3, plan_data),
          is_active = COALESCE($4, is_active),
          updated_at = NOW()
        WHERE id = $5
        RETURNING *
        "#,
    )
    .bind(&input.name)
    .bind(&input.description)
    .bind(&input.plan_data)
    .bind(&input.is_active)
    .bind(plan_id)
    .fetch_optional(pool)
    .await
}

pub async fn find_by_id(pool: &PgPool, plan_id: Uuid) -> Result<Option<Plan>, Error> {
    sqlx::query_as::<_, Plan>("SELECT * FROM plans WHERE id = $1")
        .bind(plan_id)
        .fetch_optional(pool)
        .await
}

pub async fn find_by_project_id(pool: &PgPool, project_id: Uuid) -> Result<Vec<Plan>, Error> {
    sqlx::query_as::<_, Plan>("SELECT * FROM plans WHERE project_id = $1 ORDER BY created_at DESC")
        .bind(project_id)
        .fetch_all(pool)
        .await
}

pub async fn find_latest_by_project_id(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Option<Plan>, Error> {
    sqlx::query_as::<_, Plan>(
        "SELECT * FROM plans WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1",
    )
    .bind(project_id)
    .fetch_optional(pool)
    .await
}

pub async fn delete(pool: &PgPool, plan_id: Uuid) -> Result<u64, Error> {
    sqlx::query("DELETE FROM plans WHERE id = $1")
        .bind(plan_id)
        .execute(pool)
        .await
        .map(|result| result.rows_affected())
}

/// Set a specific plan as active for its project, deactivating others.
/// Uses a transaction to ensure atomicity.
pub async fn set_active(pool: &PgPool, plan_id: Uuid) -> Result<Plan, Error> {
    let mut tx = pool.begin().await?;

    // Find the project_id for the given plan_id
    let project_id: Option<Uuid> =
        sqlx::query_scalar("SELECT project_id FROM plans WHERE plan_id = $1")
            .bind(plan_id)
            .fetch_optional(&mut *tx)
            .await?;

    let project_id = project_id.ok_or_else(|| sqlx::Error::RowNotFound)?; // Return error if plan not found

    // Deactivate all other plans for this project
    sqlx::query("UPDATE plans SET is_active = false WHERE project_id = $1 AND plan_id != $2")
        .bind(project_id)
        .bind(plan_id)
        .execute(&mut *tx)
        .await?;

    // Activate the specified plan and return it
    let updated_plan = sqlx::query_as::<_, Plan>(
        "UPDATE plans SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE plan_id = $1 RETURNING *"
    )
    .bind(plan_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(updated_plan)
}
