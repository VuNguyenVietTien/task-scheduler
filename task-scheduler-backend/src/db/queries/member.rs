use sqlx::PgPool;
use uuid::Uuid;
use crate::db::{
    models::ProjectMember,
    helpers::row_to_member,
};

pub async fn get_member_by_id(pool: &PgPool, member_id: Uuid) -> Result<Option<ProjectMember>, sqlx::Error> {
    let row = sqlx::query(
        "SELECT * FROM project_members WHERE member_id = $1"
    )
    .bind(member_id)
    .fetch_optional(pool)
    .await?;

    match row {
        Some(row) => row_to_member(row).map(Some),
        None => Ok(None),
    }
}

pub async fn list_project_members(pool: &PgPool, project_id: Uuid) -> Result<Vec<ProjectMember>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT * 
        FROM project_members 
        WHERE project_id = $1
        ORDER BY joined_at ASC
        "#
    )
    .bind(project_id)
    .fetch_all(pool)
    .await?;

    let mut members = Vec::with_capacity(rows.len());
    for row in rows {
        members.push(row_to_member(row)?);
    }
    Ok(members)
}

pub async fn create_member(pool: &PgPool, member: ProjectMember) -> Result<ProjectMember, sqlx::Error> {
    let row = sqlx::query(
        r#"
        INSERT INTO project_members (
            member_id, project_id, user_id, role,
            joined_at, invited_by
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        "#
    )
    .bind(member.member_id)
    .bind(member.project_id)
    .bind(member.user_id)
    .bind(member.role.as_ref())
    .bind(member.joined_at)
    .bind(member.invited_by)
    .fetch_one(pool)
    .await?;

    row_to_member(row)
}

pub async fn update_member_role(pool: &PgPool, member_id: Uuid, role: &str) -> Result<ProjectMember, sqlx::Error> {
    let row = sqlx::query(
        r#"
        UPDATE project_members 
        SET role = $2
        WHERE member_id = $1
        RETURNING *
        "#
    )
    .bind(member_id)
    .bind(role)
    .fetch_one(pool)
    .await?;

    row_to_member(row)
}

pub async fn remove_member(pool: &PgPool, member_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query(
        "DELETE FROM project_members WHERE member_id = $1"
    )
    .bind(member_id)
    .execute(pool)
    .await?;

    Ok(())
}