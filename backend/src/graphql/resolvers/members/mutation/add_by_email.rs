use async_graphql::{Context, Result, ID};
use chrono::Utc;
use sqlx::Row;
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::resolvers::project_authz;
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

    let caller = project_authz::require_user(context)?;
    let mut tx = pool.begin().await.map_err(AuthError::Database)?;
    project_authz::require_project_write_tx(&mut tx, caller, project_id).await?;

    // Find user by email
    let users = sqlx::query(
        "SELECT user_id, email, username, full_name, avatar_url FROM users WHERE lower(btrim(email)) = lower(btrim($1)) LIMIT 2",
    )
    .bind(&email).fetch_all(&mut *tx).await.map_err(AuthError::Database)?;
    let [user_row] = users.as_slice() else {
        return Err("Email must identify exactly one existing user".into());
    };
    let user_id: Uuid = user_row.get("user_id");
    project_authz::require_access_target_tx(&mut tx, caller, project_id, user_id).await?;

    // Kiểm tra số lượng thành viên hiện tại
    let member_count = sqlx::query(
        "SELECT COUNT(*) as count FROM project_members WHERE project_id = $1 AND role IS NOT NULL",
    )
    .bind(project_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AuthError::Database(e))?;

    let count: i64 = member_count.get("count");

    // Giới hạn số lượng thành viên (có thể thay đổi theo cấu hình)
    let max_members = 20;
    if count >= max_members {
        return Err("Dự án đã đạt giới hạn số lượng thành viên tối đa".into());
    }

    // Create a canonical identity, or reuse an existing linked/no-access row.
    let member_id = Uuid::new_v4();
    let resource_member_id = Uuid::new_v4();
    let now = Utc::now();
    let display_name = [
        user_row.get::<Option<String>, _>("full_name"),
        user_row.get::<Option<String>, _>("username"),
    ]
    .into_iter()
    .flatten()
    .find(|name| !name.trim().is_empty())
    .unwrap_or_else(|| user_row.get("email"));

    let member = sqlx::query(
        r#"
        INSERT INTO project_members
            (member_id, resource_member_id, project_id, display_name, user_id, role, joined_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (project_id, user_id) DO UPDATE
        SET role = EXCLUDED.role, joined_at = COALESCE(project_members.joined_at, EXCLUDED.joined_at), updated_at = now()
        WHERE project_members.role IS NULL
        RETURNING member_id, project_id, user_id, role, joined_at
        "#,
    )
    .bind(member_id)
    .bind(resource_member_id)
    .bind(project_id)
    .bind(display_name)
    .bind(user_id)
    .bind(role)
    .bind(now)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AuthError::Database(e))?
    .ok_or_else(|| async_graphql::Error::new("User is already a member of this project"))?;

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

    tx.commit().await.map_err(AuthError::Database)?;
    Ok(result)
}
