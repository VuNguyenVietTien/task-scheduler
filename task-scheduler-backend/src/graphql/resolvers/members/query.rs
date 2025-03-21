use async_graphql::*;
use uuid::Uuid;
use sqlx::PgPool;

use crate::graphql::resolvers::members::types::{ProjectMember, MemberRole};

#[derive(Default)]
pub struct MemberQuery;

#[Object]
impl MemberQuery {
    pub async fn project_members(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
    ) -> Result<Vec<ProjectMember>> {
        let db = ctx.data::<PgPool>().unwrap();
        let project_id = Uuid::parse_str(&project_id)
            .map_err(|_| async_graphql::Error::new("Invalid project ID"))?;

        let records = sqlx::query(
            "SELECT pm.member_id, pm.project_id, pm.user_id, pm.role, pm.joined_at, pm.invited_by,
                    u.email, u.username, u.full_name, u.avatar_url
             FROM project_members pm
             JOIN users u ON pm.user_id = u.user_id
             WHERE pm.project_id = $1
             ORDER BY pm.joined_at DESC"
        )
        .bind(project_id)
        .map(|row: sqlx::postgres::PgRow| ProjectMember::try_from(row))
        .fetch_all(db)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?
        .into_iter()
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| async_graphql::Error::new(format!("Row mapping error: {}", e)))?;

        Ok(records)
    }

    pub async fn my_project_role(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
    ) -> Result<Option<MemberRole>> {
        let db = ctx.data::<PgPool>().unwrap();
        let user_id = ctx.data::<String>().unwrap();
        let user_id = Uuid::parse_str(user_id)
            .map_err(|_| async_graphql::Error::new("Invalid user ID"))?;
        let project_id = Uuid::parse_str(&project_id)
            .map_err(|_| async_graphql::Error::new("Invalid project ID"))?;

        let role = sqlx::query(
            "SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2"
        )
        .bind(project_id)
        .bind(user_id)
        .map(|row: sqlx::postgres::PgRow| row.get("role"))
        .fetch_optional(db)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

        Ok(role)
    }
} 