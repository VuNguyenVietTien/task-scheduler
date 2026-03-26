use async_graphql::{Context, Result, ID};
use uuid::Uuid;
use std::str::FromStr;

use crate::error::AppError;
use crate::graphql::resolvers::members::types::BulkRemoveResponse;

/// Xóa nhiều thành viên khỏi dự án
pub async fn remove_multiple_members(
    ctx: &Context<'_>,
    project_id: ID,
    member_ids: Vec<ID>,
) -> Result<BulkRemoveResponse> {
    let db = ctx.data::<sqlx::PgPool>()?;
    let auth = ctx.data::<crate::auth::types::Claims>()
        .or_else(|_| Err(AppError::forbidden("Unauthorized").to_graphql_error()))?;
    
    // Parse user_id từ token
    let current_user_id = Uuid::parse_str(&auth.sub)
        .map_err(|_| AppError::validation("Invalid user ID").to_graphql_error())?;
    
    // Parse project_id
    let project_uuid = Uuid::from_str(&project_id)
        .map_err(|_| AppError::validation("Invalid project ID format").to_graphql_error())?;
    
    // Kiểm tra quyền admin trong dự án
    let is_admin = sqlx::query!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM project_members 
            WHERE project_id = $1 AND user_id = $2 AND role::text IN ('manager', 'leader', 'admin')
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
        return Err(AppError::forbidden("You must be an admin to remove members").to_graphql_error());
    }
    
    // Thực hiện xóa các thành viên
    let mut success_count = 0;
    let mut failed_count = 0;
    
    for member_id in member_ids {
        let member_uuid = Uuid::from_str(&member_id)
            .map_err(|_| AppError::validation("Invalid member ID format").to_graphql_error())?;
            
        // Kiểm tra xem member_id có thuộc về current_user_id hay không
        let member_user_id = sqlx::query!(
            r#"SELECT user_id FROM project_members WHERE member_id = $1"#,
            member_uuid
        )
        .fetch_optional(db)
        .await
        .map_err(|e| {
            eprintln!("Error fetching member user_id: {}", e);
            AppError::internal("Failed to fetch member details").to_graphql_error()
        })?;
        
        // Nếu không tìm thấy hoặc đang cố xóa chính mình => bỏ qua
        if let Some(record) = member_user_id {
            if record.user_id == current_user_id {
                failed_count += 1;
                continue;
            }
            
            // Xóa thành viên
            let result = sqlx::query!("DELETE FROM project_members WHERE member_id = $1", member_uuid)
                .execute(db)
                .await;
                
            match result {
                Ok(res) if res.rows_affected() > 0 => {
                    success_count += 1;
                },
                _ => {
                    failed_count += 1;
                }
            }
        } else {
            failed_count += 1;
        }
    }
    
    Ok(BulkRemoveResponse {
        success_count,
        failed_count,
    })
} 