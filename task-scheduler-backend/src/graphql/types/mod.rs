use async_graphql::*;
use uuid::Uuid;
use serde_json::Value;

// Declare submodules
pub mod project;
pub mod task;
pub mod auth;
pub mod comment;
pub mod user;
pub mod media_upload;

// Re-export project types
pub use self::project::{
    Project, Projects, ProjectMember, ProjectStatus,
    ProjectPriority, ProjectVisibility, MemberRole,
    CreateProjectInput, UpdateProjectInput, ProjectResponse,
    User
};

// Re-export task types
pub use self::task::{
    Task, TaskStatus, TaskPriority, TaskProgressType,
    CreateTaskInput, UpdateTaskInput, UpdateTaskStatusInput,
    ReorderTasksInput, TaskOrderInput,
    Assignee
};

// Re-export auth types
pub use self::auth::{
    LoginInput, RegisterInput,
    AuthResponse, AuthUserResponse, AuthPayload
};

// Re-export comment types
pub use self::comment::{
    CommentResponse,
    CreateCommentInput,
};

// Re-export user types
pub use self::user::{
    UserResponse,
};

// Re-export media upload types
pub use self::media_upload::{
    MediaUploadResponse,
    StorageType,
};

// Common type aliases
pub type ID = async_graphql::ID;
pub type JsonValue = serde_json::Value;
pub type DateTime = chrono::DateTime<chrono::Utc>;