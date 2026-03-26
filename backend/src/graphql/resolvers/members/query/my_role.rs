use async_graphql::{Context, Result, ID};
use sqlx::Row;
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::MemberRole;

pub async fn my_project_role(ctx: &Context<'_>, project_id: ID) -> Result<Option<MemberRole>> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;
    
    // Lấy thông tin user hiện tại
    let current_user = context.auth.as_ref()
        .ok_or_else(|| AuthError::Unauthorized("You must be logged in".into()))?;
    
    let project_id = Uuid::parse_str(&project_id)?;
    let user_id = current_user.user_id()?;
    
    // Tìm role của user trong project
    let role = sqlx::query(
        r#"
        SELECT
            pm.role
        FROM project_members pm
        WHERE pm.project_id = $1 AND pm.user_id = $2
        "#
    )
    .bind(project_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AuthError::Database(e))?;
    
    // In ra log để debug
    println!("===== MY PROJECT ROLE =====");
    println!("Project ID: {}", project_id);
    println!("User ID: {}", user_id);
    if let Some(ref row) = role {
        println!("Role: {:?}", row.get::<MemberRole, _>("role"));
    } else {
        println!("Role: None");
    }

    match role {
        Some(row) => Ok(Some(row.get("role"))),
        None => Ok(None)
    }
} 