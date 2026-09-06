use async_graphql::{Context, Object, Result, ID};
use chrono::Utc;
use serde_json::json;
use sqlx::{postgres::PgRow, Row};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::{MemberRole, ProjectMember, User};

#[derive(Default)]
pub struct ProjectMemberQuery;

#[Object(rename_fields = "snake_case", rename_args = "snake_case")]
impl ProjectMemberQuery {
    /// Get project members with optional filters
    async fn project_members(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
    ) -> Result<Vec<ProjectMember>> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        let project_id = Uuid::parse_str(&project_id)?;

        let members = sqlx::query(
            r#"
            SELECT
                pm.role,
                pm.joined_at,
                u.user_id,
                u.username,
                u.email,
                u.full_name,
                u.avatar_url
            FROM project_members pm
            INNER JOIN users u ON pm.user_id = u.user_id
            WHERE project_id = $1
            "#,
        )
        .bind(project_id)
        .fetch_all(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

        Ok(members
            .into_iter()
            .map(|row: PgRow| ProjectMember {
                role: row.get("role"),
                joined_at: row.get("joined_at"),
                user: User {
                    user_id: row.get("user_id"),
                    email: row.get("email"),
                    username: row.get("username"),
                    full_name: row.get("full_name"),
                    avatar_url: row.get::<Option<String>, _>("avatar_url"),
                },
            })
            .collect())
    }

    /// Get specific project member
    async fn project_member(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
        user_id: ID,
    ) -> Result<Option<ProjectMember>> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        let (project_id, user_id) = (Uuid::parse_str(&project_id)?, Uuid::parse_str(&user_id)?);

        let member = sqlx::query(
            r#"
            SELECT
                pm.role,
                pm.joined_at,
                u.user_id,
                u.username,
                u.email,
                u.full_name,
                u.avatar_url
            FROM project_members pm
            INNER JOIN users u ON pm.user_id = u.user_id
            WHERE project_id = $1 AND u.user_id = $2
            "#,
        )
        .bind(project_id)
        .bind(user_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

        Ok(member.map(|row: PgRow| ProjectMember {
            role: row.get("role"),
            joined_at: row.get("joined_at"),
            user: User {
                user_id: row.get("user_id"),
                email: row.get("email"),
                username: row.get("username"),
                full_name: row.get("full_name"),
                avatar_url: row.get::<Option<String>, _>("avatar_url"),
            },
        }))
    }
}

#[derive(Default)]
pub struct ProjectMemberMutation;

#[Object(rename_fields = "snake_case", rename_args = "snake_case")]
impl ProjectMemberMutation {
    /// Add member to project
    async fn add_project_member(
        &self,
        ctx: &Context<'_>,
        input: AddProjectMemberInput,
    ) -> Result<ProjectMember> {
        eprintln!("\n=== Add Project Member Request ===");
        eprintln!(
            "Input Data: {}",
            json!({
                "projectId": &input.project_id,
                "userId": &input.user_id,
                "role": &input.role
            })
        );
        eprintln!("==============================\n");

        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        let project_id = Uuid::parse_str(&input.project_id)?;
        let user_id = Uuid::parse_str(&input.user_id)?;

        // Verify project exists
        let project = sqlx::query("SELECT project_id FROM projects WHERE project_id = $1")
            .bind(project_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| AuthError::Database(e))?;

        if project.is_none() {
            return Err("Project not found".into());
        }

        // Verify user exists
        let user = sqlx::query(
            "SELECT user_id, email, username, full_name, avatar_url FROM users WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

        let user_row = match user {
            Some(row) => row,
            None => return Err("User not found".into()),
        };

        // Check if member already exists
        let existing = sqlx::query(
            r#"
            SELECT member_id FROM project_members 
            WHERE project_id = $1 AND user_id = $2
            "#,
        )
        .bind(project_id)
        .bind(user_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

        if existing.is_some() {
            return Err("User is already a member of this project".into());
        }

        // Add member
        let member_id = Uuid::new_v4();
        let now = Utc::now();

        let member = sqlx::query(
            r#"
            INSERT INTO project_members (
                member_id, project_id, user_id, role,
                joined_at
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING 
                member_id, project_id, user_id, role, joined_at
            "#,
        )
        .bind(member_id)
        .bind(project_id)
        .bind(user_id)
        .bind(input.role)
        .bind(now)
        .fetch_one(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

        let result = ProjectMember {
            role: member.get("role"),
            joined_at: member.get("joined_at"),
            user: User {
                user_id: user_row.get("user_id"),
                email: user_row.get("email"),
                username: user_row.get("username"),
                full_name: user_row.get("full_name"),
                avatar_url: user_row.get("avatar_url"),
            },
        };

        eprintln!("\n=== Add Project Member Response ===");
        eprintln!("{:#?}", result);
        eprintln!("================================\n");

        Ok(result)
    }

    /// Update project member role
    async fn update_project_member(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
        user_id: ID,
        role: MemberRole,
    ) -> Result<ProjectMember> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        let (project_id, user_id) = (Uuid::parse_str(&project_id)?, Uuid::parse_str(&user_id)?);

        // Get user info
        let user_info = sqlx::query(
            r#"
            SELECT user_id, email, username, full_name, avatar_url 
            FROM users 
            WHERE user_id = $1
            "#,
        )
        .bind(user_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

        let user_row = match user_info {
            Some(row) => row,
            None => return Err("User not found".into()),
        };

        let member = sqlx::query(
            r#"
            UPDATE project_members 
            SET role = $3
            WHERE project_id = $1 AND user_id = $2
            RETURNING 
                member_id, project_id, user_id, role, joined_at
            "#,
        )
        .bind(project_id)
        .bind(user_id)
        .bind(role)
        .fetch_optional(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

        match member {
            Some(row) => Ok(ProjectMember {
                role: row.get("role"),
                joined_at: row.get("joined_at"),
                user: User {
                    user_id: user_row.get("user_id"),
                    email: user_row.get("email"),
                    username: user_row.get("username"),
                    full_name: user_row.get("full_name"),
                    avatar_url: user_row.get("avatar_url"),
                },
            }),
            None => Err("Project member not found".into()),
        }
    }

    /// Remove member from project
    async fn remove_project_member(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
        user_id: ID,
    ) -> Result<bool> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        let (project_id, user_id) = (Uuid::parse_str(&project_id)?, Uuid::parse_str(&user_id)?);

        let result = sqlx::query(
            r#"
            DELETE FROM project_members 
            WHERE project_id = $1 AND user_id = $2
            "#,
        )
        .bind(project_id)
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

        Ok(result.rows_affected() > 0)
    }
}

#[derive(async_graphql::InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct AddProjectMemberInput {
    pub project_id: ID,
    pub user_id: ID,
    pub role: MemberRole,
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_graphql::Context;

    #[tokio::test]
    async fn test_add_project_member() {
        // TODO: Implement test with proper mocking
        // let ctx = Context::new();
        // let mutation = ProjectMemberMutation::default();
        // let result = mutation.add_project_member(...).await;
        // assert!(result.is_ok());
    }
}
