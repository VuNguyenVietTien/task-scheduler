use sea_orm::prelude::*;

// Re-export all entities
pub mod user;
pub mod project;
pub mod project_member;
pub mod task;
pub mod task_assignment;
pub mod task_dependency;
pub mod comment;
pub mod attachment;
pub mod notification;

// Re-export commonly used types
pub use user::*;
pub use project::*;
pub use project_member::*;
pub use task::*;
pub use task_assignment::*;
pub use task_dependency::*;
pub use comment::*;
pub use attachment::*;
pub use notification::*;

// Common traits and types
pub use sea_orm::{
    ActiveModelTrait,
    ActiveValue,
    ColumnTrait,
    DatabaseConnection,
    DbErr,
    EntityTrait,
    ModelTrait,
    PaginatorTrait,
    QueryFilter,
    QueryOrder,
    Related,
    RelationTrait,
    Set,
    TransactionTrait,
};

#[derive(Debug)]
pub enum EntityError {
    Database(DbErr),
    NotFound,
    InvalidInput(String),
    Unauthorized,
}

impl From<DbErr> for EntityError {
    fn from(err: DbErr) -> Self {
        EntityError::Database(err)
    }
}

pub type EntityResult<T> = Result<T, EntityError>;
