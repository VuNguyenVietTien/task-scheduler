use sea_orm::{DatabaseConnection, DbErr};
use crate::{config::Config, error::AppResult};

pub mod entities;
pub mod migrations;
pub mod enums;

pub async fn init_db(config: &Config) -> AppResult<DatabaseConnection> {
    let db = sea_orm::Database::connect(&config.database_url)
        .await
        .map_err(|e| DbErr::Custom(format!("Could not connect to database: {}", e)))?;

    Ok(db)
}

// Re-exports for convenience
pub use entities::{
    task::{
        ActiveModel as TaskActiveModel,
        Entity as TaskEntity,
        Model as TaskModel,
        Column as TaskColumn,
    },
    project::{
        ActiveModel as ProjectActiveModel,
        Entity as ProjectEntity,
        Model as ProjectModel,
        Column as ProjectColumn,
    },
    comment::{
        ActiveModel as CommentActiveModel,
        Entity as CommentEntity,
        Model as CommentModel,
        Column as CommentColumn,
    },
    attachment::{
        ActiveModel as AttachmentActiveModel,
        Entity as AttachmentEntity,
        Model as AttachmentModel,
        Column as AttachmentColumn,
    },
    notification::{
        ActiveModel as NotificationActiveModel,
        Entity as NotificationEntity,
        Model as NotificationModel,
        Column as NotificationColumn,
    },
    task_assignment::{
        ActiveModel as TaskAssignmentActiveModel,
        Entity as TaskAssignmentEntity,
        Model as TaskAssignmentModel,
        Column as TaskAssignmentColumn,
    },
    task_dependency::{
        ActiveModel as TaskDependencyActiveModel,
        Entity as TaskDependencyEntity,
        Model as TaskDependencyModel,
        Column as TaskDependencyColumn,
    },
    project_member::{
        Entity as ProjectMemberEntity,
        Model as ProjectMemberModel,
        Column as ProjectMemberColumn,
    },
    user::{
        ActiveModel as UserActiveModel,
        Entity as UserEntity,
        Model as UserModel,
        Column as UserColumn,
    }
};
