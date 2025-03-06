use async_graphql::{Context, Object, Result, ID};
use chrono::Utc;
use sqlx::{Row, postgres::PgRow};
use uuid::Uuid;
use serde_json::json;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::{
    CreateProjectInput, Project, ProjectMember, ProjectResponse, ProjectStatus, MemberRole,
};

#[derive(Default)]
pub struct ProjectQuery;

#[Object]
impl ProjectQuery {
    async fn projects(&self, ctx: &Context<'_>) -> Result<Vec<Project>> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;

        // Get all projects
        let projects = sqlx::query(
            r#"
            SELECT 
                project_id, name, description, 
                start_date, end_date, status, 
                created_at, updated_at 
            FROM projects
            "#
        )
        .fetch_all(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

        let mut result = Vec::new();

        for project_row in projects {
            let project_id: Uuid = project_row.get("project_id");

            // Get members for this project
            let members = sqlx::query(
                r#"
                SELECT 
                    member_id, project_id, user_id, role
                FROM project_members 
                WHERE project_id = $1
                "#
            )
            .bind(project_id)
            .fetch_all(pool)
            .await
            .map_err(|e| AuthError::Database(e))?;

            let members = members
                .into_iter()
                .map(|row: PgRow| ProjectMember {
                    id: row.get("member_id"),
                    project_id: row.get("project_id"),
                    user_id: row.get("user_id"),
                    role: row.get("role"),
                    user: None,
                })
                .collect();

            result.push(Project {
                id: project_id,
                name: project_row.get("name"),
                description: project_row.get("description"),
                start_date: project_row.get("start_date"),
                end_date: project_row.get("end_date"),
                status: project_row.get("status"),
                created_at: project_row.get("created_at"),
                updated_at: project_row.get("updated_at"),
                members,
            });
        }

        Ok(result)
    }
}

#[derive(Default)]
pub struct ProjectMutation;

#[Object]
impl ProjectMutation {
    async fn create_project(
        &self,
        ctx: &Context<'_>,
        input: CreateProjectInput,
    ) -> Result<ProjectResponse> {
        eprintln!("\n=== Create Project Request ===");
        eprintln!("Input Data: {}", json!({
            "name": &input.name,
            "description": &input.description,
            "ownerId": &input.ownerId,
            "startDate": &input.start_date,
            "endDate": &input.end_date,
            "members": &input.members
        }));
        eprintln!("===========================\n");

        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;

        // Start transaction
        let mut tx = pool.begin().await.map_err(|e| AuthError::Database(e))?;

        // Create project
        let project_id = Uuid::new_v4();
        let now = Utc::now();
        let project_row = sqlx::query(
            r#"
            INSERT INTO projects (
                project_id, name, description, owner_id,
                start_date, end_date,
                created_at, updated_at, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING 
                project_id, name, description, 
                start_date, end_date, status
            "#
        )
        .bind(project_id)
        .bind(&input.name)
        .bind(&input.description)
        .bind(input.ownerId)
        .bind(input.start_date)
        .bind(input.end_date)
        .bind(now)
        .bind(now)
        .bind(ProjectStatus::active)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AuthError::Database(e))?;

        // Add members
        let mut members = Vec::new();
        for member in input.members {
            let member_id = Uuid::new_v4();
            let member_row = sqlx::query(
                r#"
                INSERT INTO project_members (
                    member_id, project_id, user_id, role
                )
                VALUES ($1, $2, $3, $4)
                RETURNING member_id, project_id, user_id, role
                "#
            )
            .bind(member_id)
            .bind(project_id)
            .bind(member.user_id)
            .bind(member.role)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| AuthError::Database(e))?;

            members.push(ProjectMember {
                id: member_row.get("member_id"),
                project_id: member_row.get("project_id"),
                user_id: member_row.get("user_id"),
                role: member_row.get("role"),
                user: None,
            });
        }

        // Commit transaction
        tx.commit().await.map_err(|e| AuthError::Database(e))?;

        let result = ProjectResponse {
            id: project_row.get("project_id"),
            name: project_row.get("name"),
            description: project_row.get("description"),
            start_date: project_row.get("start_date"),
            end_date: project_row.get("end_date"),
            status: project_row.get("status"),
            members,
        };

        eprintln!("\n=== Create Project Response ===");
        eprintln!("{:#?}", result);
        eprintln!("============================\n");

        Ok(result)
    }
}
