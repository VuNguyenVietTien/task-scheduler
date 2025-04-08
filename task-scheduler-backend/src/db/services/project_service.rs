use sqlx::PgPool;
use uuid::Uuid;

use crate::db::queries::project::{create_project, get_project_by_id, update_project};
use crate::db::models::{CreateProjectInput, UpdateProjectInput};
use crate::db::services::notification_service::{create_project_assignment_notification, create_project_reassignment_notification};

pub async fn create_project_with_notification(
    pool: &PgPool,
    input: CreateProjectInput,
) -> Result<Uuid, sqlx::Error> {
    // Create the project
    let project_id = create_project(pool, input.clone()).await?;
    
    // If an owner is specified, create a project assignment notification
    if let Some(owner_id) = input.owner_id {
        create_project_assignment_notification(
            pool,
            project_id,
            owner_id,
            input.created_by,
            &input.name,
        ).await?;
    }
    
    Ok(project_id)
}

pub async fn update_project_with_notification(
    pool: &PgPool,
    project_id: Uuid,
    input: UpdateProjectInput,
) -> Result<(), sqlx::Error> {
    // Get the old project to check for owner changes
    let old_project = get_project_by_id(pool, project_id).await?;
    
    // Update the project
    update_project(pool, project_id, input.clone()).await?;
    
    // If the owner has changed, create a project reassignment notification
    if let Some(new_owner_id) = input.owner_id {
        if old_project.owner_id != Some(new_owner_id) {
            create_project_reassignment_notification(
                pool,
                project_id,
                new_owner_id,
                input.updated_by.unwrap_or(old_project.created_by),
                &old_project.name,
            ).await?;
        }
    }
    
    Ok(())
} 