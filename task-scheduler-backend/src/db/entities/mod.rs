pub mod attachment;
pub mod comment;
pub mod notification;
pub mod project;
pub mod project_member;
pub mod task;
pub mod task_assignment;
pub mod task_dependency;
pub mod user;


// Re-export entities with proper namespacing to avoid name conflicts
pub use attachment::{
    ActiveModel as AttachmentActiveModel,
    Entity as AttachmentEntity,
    Model as AttachmentModel,
    Column as AttachmentColumn,
};

pub use comment::{
    ActiveModel as CommentActiveModel, 
    Entity as CommentEntity,
    Model as CommentModel,
    Column as CommentColumn,
};

pub use notification::{
    ActiveModel as NotificationActiveModel,
    Entity as NotificationEntity,
    Model as NotificationModel,
    Column as NotificationColumn,
};

pub use project::{
    ActiveModel as ProjectActiveModel,
    Entity as ProjectEntity,
    Model as ProjectModel,
    Column as ProjectColumn,
};

pub use project_member::{
    ActiveModel as ProjectMemberActiveModel,
    Entity as ProjectMemberEntity,
    Model as ProjectMemberModel,
    Column as ProjectMemberColumn,
};

pub use task::{
    ActiveModel as TaskActiveModel,
    Entity as TaskEntity,
    Model as TaskModel,
    Column as TaskColumn,
};

pub use task_assignment::{
    ActiveModel as TaskAssignmentActiveModel,
    Entity as TaskAssignmentEntity,
    Model as TaskAssignmentModel,
    Column as TaskAssignmentColumn,
};

pub use task_dependency::{
    ActiveModel as TaskDependencyActiveModel,
    Entity as TaskDependencyEntity,
    Model as TaskDependencyModel,
    Column as TaskDependencyColumn,
};

pub use user::{
    ActiveModel as UserActiveModel,
    Entity as UserEntity,
    Model as UserModel,
    Column as UserColumn,
};
