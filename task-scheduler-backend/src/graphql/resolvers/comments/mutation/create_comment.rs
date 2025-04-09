use async_graphql::*;
use uuid::Uuid;
use log::{debug, info};

use crate::db::models::CreateCommentInput;
use crate::db::services::comment_service::create_comment_with_notifications;
use crate::db::services::task_service::get_task_by_id;
use crate::db::Pool;

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