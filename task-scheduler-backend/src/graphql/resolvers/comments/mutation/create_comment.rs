use async_graphql::*;
use uuid::Uuid;

use crate::db::models::CreateCommentInput;
use crate::db::services::comment_service::create_comment_with_notifications;
use crate::db::services::task_service::get_task_by_id;
use crate::db::Pool;

pub async fn create_comment(
    pool: &Pool,
    input: CreateCommentInput,
) -> Result<Uuid, Error> {
    // Get task title for notification
    let task = get_task_by_id(pool, input.task_id).await?;
    
    // Create comment with notifications
    let comment_id = create_comment_with_notifications(pool, input, &task.title).await?;
    
    Ok(comment_id)
} 