use async_graphql::{Context, Result, ID};
use chrono::Utc;
use sqlx::Row;
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::{MemberRole, ProjectMember, User};

pub async fn add_member_by_email(
    ctx: &Context<'_>,
    project_id: ID,
    email: String,
    role: MemberRole,
) -> Result<ProjectMember> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;
    let project_id = Uuid::parse_str(&project_id)?;

    // Verify project exists
    let project = sqlx::query("SELECT project_id FROM projects WHERE project_id = $1")
        .bind(project_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

    if project.is_none() {
        return Err("Dự án không tồn tại".into());
    }

    // Find user by email
    let user = sqlx::query(
        "SELECT user_id, email, username, full_name, avatar_url FROM users WHERE email = $1",
    )
    .bind(&email)
    .fetch_optional(pool)
    .await
    .map_err(|e| AuthError::Database(e))?;

    let user_row = match user {
        Some(row) => row,
        None => return Err("User with this email not found".into()),
    };

    let user_id: Uuid = user_row.get("user_id");

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

    // Kiểm tra số lượng thành viên hiện tại
    let member_count =
        sqlx::query("SELECT COUNT(*) as count FROM project_members WHERE project_id = $1")
            .bind(project_id)
            .fetch_one(pool)
            .await
            .map_err(|e| AuthError::Database(e))?;

    let count: i64 = member_count.get("count");

    // Giới hạn số lượng thành viên (có thể thay đổi theo cấu hình)
    let max_members = 20;
    if count >= max_members {
        return Err("Dự án đã đạt giới hạn số lượng thành viên tối đa".into());
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
    .bind(role)
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

    Ok(result)
}
