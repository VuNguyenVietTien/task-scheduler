use async_graphql::{Context, Result, ID};
use uuid::Uuid;
use std::str::FromStr;

use crate::error::AppError;
use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::resolvers::members::types::{BulkUpdateResponse, MemberRole, MemberRoleUpdate, ProjectMember, UserResponse};

/// Cập nhật vai trò cho nhiều thành viên trong dự án
pub async fn update_multiple_members(
    ctx: &Context<'_>,
    project_id: ID,
    updates: Vec<MemberRoleUpdate>,
) -> Result<BulkUpdateResponse> {
    let context = ctx.data::<GraphQLContext>()?;
    let db = &context.db;
    let auth = context.auth.as_ref().ok_or_else(|| AuthError::InvalidCredentials)?;
    let current_user_id = Uuid::parse_str(&auth.sub)
        .map_err(|_| AppError::validation("Invalid user ID").to_graphql_error())?;
    
    // Parse project_id
    let project_uuid = Uuid::from_str(&project_id)
        .map_err(|_| AppError::validation("Invalid project ID format").to_graphql_error())?;
    
    // Kiểm tra quyền admin trong dự án - đảm bảo kiểm tra với role = 'admin' (lowercase)
    let is_admin = sqlx::query!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM project_members 
            WHERE project_id = $1 AND user_id = $2 AND role = 'admin'
        ) as "is_admin!: bool"
        "#,
        project_uuid,
        current_user_id
    )
    .fetch_one(db)
    .await
    .map_err(|e| {
        eprintln!("Database error checking admin privileges: {}", e);
        AppError::internal("Failed to verify permissions").to_graphql_error()
    })?
    .is_admin;

    if !is_admin {
        eprintln!("User {} is not an admin of project {}", current_user_id, project_uuid);
        return Err(AppError::forbidden("You must be an admin to update member roles").to_graphql_error());
    }
    
    // Debug log
    eprintln!("Starting bulk update for {} members in project {:?}", updates.len(), project_id);
    
    // Thực hiện các cập nhật
    let mut updated_members = Vec::new();
    let mut success_count = 0;
    let updates_count = updates.len();
    
    for update in updates {
        // Debug log cho mỗi update
        eprintln!("Processing update: user_id={:?}, role={:?}", update.user_id, update.role);
        
        let user_uuid = Uuid::from_str(&update.user_id)
            .map_err(|_| AppError::validation("Invalid user ID format").to_graphql_error())?;
        
        // Không cho phép thay đổi vai trò của chính mình để tránh mất quyền admin
        if user_uuid == current_user_id {
            eprintln!("Skipping update for current user (self)");
            continue;
        }
        
        // Cập nhật vai trò trong database - đảm bảo luôn chuyển về lowercase
        let role_string = match update.role {
            MemberRole::Admin => "admin",
            MemberRole::Member => "member",
            MemberRole::Viewer => "viewer",
        };
        
        eprintln!("Updating member role to: {}", role_string);
        
        let result = sqlx::query!(
            r#"
            UPDATE project_members 
            SET role = $1::text::member_role
            WHERE project_id = $2 AND user_id = $3
            RETURNING member_id, user_id, joined_at, invited_by
            "#,
            role_string,
            project_uuid,
            user_uuid
        )
        .fetch_optional(db)
        .await
        .map_err(|e| {
            eprintln!("Error updating member role: {}", e);
            AppError::internal("Failed to update member role").to_graphql_error()
        })?;
        
        if let Some(member) = result {
            eprintln!("Successfully updated member: {:?}", member.user_id);
            
            // Lấy thông tin người dùng và vai trò được cập nhật
            let user_with_role = sqlx::query!(
                r#"
                SELECT u.user_id, u.email, u.username, u.full_name, u.avatar_url, pm.role as "role: MemberRole"
                FROM users u
                JOIN project_members pm ON u.user_id = pm.user_id
                WHERE u.user_id = $1 AND pm.project_id = $2
                "#,
                user_uuid,
                project_uuid
            )
            .fetch_one(db)
            .await
            .map_err(|e| {
                eprintln!("Error fetching user details: {}", e);
                AppError::internal("Failed to fetch user details").to_graphql_error()
            })?;
            
            // Cung cấp giá trị mặc định nếu joined_at là None
            let joined_at = member.joined_at.unwrap_or_else(|| chrono::Utc::now());
            
            let project_member = ProjectMember {
                member_id: member.member_id.to_string(),
                project_id: project_uuid.to_string(),
                user_id: member.user_id.to_string(),
                role: user_with_role.role,
                joined_at,
                invited_by: member.invited_by.map(|id| id.to_string()),
                user: UserResponse {
                    id: user_with_role.user_id.to_string(),
                    email: user_with_role.email,
                    username: user_with_role.username,
                    full_name: user_with_role.full_name,
                    avatar_url: user_with_role.avatar_url,
                },
            };
            
            updated_members.push(project_member);
            success_count += 1;
        } else {
            eprintln!("No member found with user_id={} in project={}", user_uuid, project_uuid);
        }
    }
    
    eprintln!("Bulk update completed: updated {} out of {} members", success_count, updates_count);
    
    // Log kết quả chi tiết
    eprintln!("Updated member roles:");
    for member in &updated_members {
        eprintln!("  User: {}, Role: {:?}", member.user_id, member.role);
    }
    
    Ok(BulkUpdateResponse {
        success_count,
        members: updated_members,
    })
} 