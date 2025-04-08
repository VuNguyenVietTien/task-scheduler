use sqlx::PgPool;
use uuid::Uuid;

use crate::db::queries::task::{create_task, get_task_by_id, update_task};
use crate::db::models::{CreateTaskInput, UpdateTaskInput};
use crate::db::services::notification_service::{
    create_task_assignment_notification,
    create_task_reassignment_notification,
};

pub async fn create_task_with_notification(
    pool: &PgPool,
    input: CreateTaskInput,
) -> Result<Uuid, sqlx::Error> {
    // Create the task
    let task_id = create_task(pool, input.clone()).await?;
    
    // If an assignee is specified, create a task assignment notification
    if let Some(assignee_id) = input.assignee_id {
        create_task_assignment_notification(
            pool,
            task_id,
            input.project_id,
            assignee_id,
            input.created_by,
            &input.title,
        ).await?;
    }
    
    Ok(task_id)
}

pub async fn update_task_with_notification(
    pool: &PgPool,
    task_id: Uuid,
    input: UpdateTaskInput,
) -> Result<(), sqlx::Error> {
    // Get the old task to check for assignee changes
    let old_task = get_task_by_id(pool, task_id).await?;
    
    // Update the task
    update_task(pool, task_id, input.clone()).await?;
    
    // If the assignee has changed, create a task reassignment notification
    if let Some(new_assignee_id) = input.assignee_id {
        if old_task.assignee_id != Some(new_assignee_id) {
            create_task_reassignment_notification(
                pool,
                task_id,
                old_task.project_id,
                new_assignee_id,
                input.updated_by.unwrap_or(old_task.created_by),
                &old_task.title,
            ).await?;
        }
    }
    
    Ok(())
} 