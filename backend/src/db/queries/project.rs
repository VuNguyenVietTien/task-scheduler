use crate::db::{helpers::row_to_project, models::Project, types::PaginationParams};
use sqlx::{postgres::PgRow, PgPool, Row};
use uuid::Uuid;

pub async fn get_project_by_id(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Option<Project>, sqlx::Error> {
    let row = sqlx::query("SELECT * FROM projects WHERE project_id = $1")
        .bind(project_id)
        .fetch_optional(pool)
        .await?;

    match row {
        Some(row) => row_to_project(row).map(Some),
        None => Ok(None),
    }
}

pub async fn list_user_projects(
    pool: &PgPool,
    user_id: Uuid,
    pagination: &PaginationParams,
) -> Result<Vec<Project>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT p.* 
        FROM projects p
        INNER JOIN project_members pm ON pm.project_id = p.project_id
        WHERE pm.user_id = $1
        ORDER BY p.updated_at DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(user_id)
    .bind(pagination.limit())
    .bind(pagination.offset())
    .fetch_all(pool)
    .await?;

    let mut projects = Vec::with_capacity(rows.len());
    for row in rows {
        projects.push(row_to_project(row)?);
    }
    Ok(projects)
}

pub async fn create_project(pool: &PgPool, project: Project) -> Result<Project, sqlx::Error> {
    let row = sqlx::query(
        r#"
        INSERT INTO projects (
            project_id, name, description, owner_id,
            created_at, updated_at,
            status, priority, visibility,
            tags, progress, category, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
        "#,
    )
    .bind(project.project_id)
    .bind(&project.name)
    .bind(project.description)
    .bind(project.owner_id)
    .bind(project.created_at)
    .bind(project.updated_at)
    .bind(project.status.as_ref())
    .bind(project.priority.as_ref())
    .bind(project.visibility.as_ref())
    .bind(project.tags)
    .bind(project.progress)
    .bind(project.category)
    .bind(project.metadata)
    .fetch_one(pool)
    .await?;

    row_to_project(row)
}

pub async fn update_project(pool: &PgPool, project: Project) -> Result<Project, sqlx::Error> {
    let row = sqlx::query(
        r#"
        UPDATE projects SET
            name = $2,
            description = $3,
            owner_id = $4,
            updated_at = $5,
            status = $6,
            priority = $7,
            visibility = $8,
            tags = $9,
            progress = $10,
            category = $11,
            metadata = $12
        WHERE project_id = $1
        RETURNING *
        "#,
    )
    .bind(project.project_id)
    .bind(&project.name)
    .bind(project.description)
    .bind(project.owner_id)
    .bind(project.updated_at)
    .bind(project.status.as_ref())
    .bind(project.priority.as_ref())
    .bind(project.visibility.as_ref())
    .bind(project.tags)
    .bind(project.progress)
    .bind(project.category)
    .bind(project.metadata)
    .fetch_one(pool)
    .await?;

    row_to_project(row)
}

pub async fn delete_project(pool: &PgPool, project_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM projects WHERE project_id = $1")
        .bind(project_id)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn count_user_projects(pool: &PgPool, user_id: Uuid) -> Result<i64, sqlx::Error> {
    let row = sqlx::query(
        r#"
        SELECT COUNT(DISTINCT p.project_id) as count
        FROM projects p
        INNER JOIN project_members pm ON pm.project_id = p.project_id
        WHERE pm.user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(row.try_get::<i64, _>(0).unwrap_or(0))
}
