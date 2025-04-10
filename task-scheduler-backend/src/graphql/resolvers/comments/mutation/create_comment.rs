use async_graphql::{Context, Object, Result};
use uuid::Uuid;
use log::{debug, info};

use crate::{db::{models::CreateCommentInput, services::comment_service::create_comment_with_notifications, services::task_service::get_task_by_id}, error_handling::ErrorMessage, graphql::{error_handling::GraphQLError, extractors::get_current_user}};
use crate::db::Pool;

#[derive(Default)]
pub struct CreateCommentMutation;

#[Object]
impl CreateCommentMutation {
    async fn create_comment(&self, ctx: &Context<'_>, input: CreateCommentInput) -> Result<String, GraphQLError> {
        let pool = ctx.data::<sqlx::PgPool>().unwrap();
        let firebase_service = ctx.data::<crate::firebase::FirebaseService>().ok();
        
        // Lấy current user từ context
        let current_user = get_current_user(ctx)
            .map_err(|err| GraphQLError::new(&err.message))?;
            
        // Sử dụng current_user.id thay vì input.user_id
        let user_input = CreateCommentInput {
            user_id: current_user.id,
            ..input
        };
        
        // Lấy thông tin task
        let task = get_task_by_id(pool, user_input.task_id)
            .await
            .map_err(|e| GraphQLError::new(&format!("Không thể lấy thông tin task: {}", e)))?;
            
        // Tạo comment và gửi thông báo
        let comment_id = create_comment_with_notifications(pool, user_input, &task.title, firebase_service)
            .await
            .map_err(|e| GraphQLError::new(&format!("Không thể tạo comment: {}", e)))?;
            
        Ok(comment_id.to_string())
    }
}

pub async fn create_comment(
    pool: &Pool,
    input: CreateCommentInput,
) -> Result<Uuid, Error> {
    info!("Creating comment for task {}", input.task_id);
    
    // Get task title for notification
    let task = get_task_by_id(pool, input.task_id).await?;
    info!("Retrieved task: {}", task.title);
    
    // Create comment with notifications
    let comment_id = create_comment_with_notifications(pool, input, &task.title).await?;
    info!("Comment created successfully with id: {}", comment_id);
    
    Ok(comment_id)
} 