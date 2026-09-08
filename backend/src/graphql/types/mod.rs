use async_graphql::*;
use serde_json::Value;
use uuid::Uuid;

// Declare submodules
pub mod auth;
pub mod comment;
pub mod media_upload;
pub mod notification;
pub mod project;
pub mod task;
pub mod user;

// Re-export project types
pub use self::project::{
    CreateProjectInput, MemberRole, Project, ProjectMember, ProjectPriority, ProjectResponse,
    ProjectStatus, ProjectVisibility, Projects, UpdateProjectInput, User,
};

// Re-export task types
pub use self::task::{
    Assignee, CloneTaskSubtreeInput, CloneTaskSubtreePayload, CreateTaskInput, DeleteTaskPayload,
    ReorderTasksInput, Task, TaskOrderInput, TaskPriority, TaskProgressType, TaskStatus, UpdateTaskInput,
    UpdateTaskStatusInput,
};

// Re-export auth types
pub use self::auth::{AuthPayload, AuthResponse, AuthUserResponse, LoginInput, RegisterInput};

// Re-export comment types
pub use self::comment::{CommentResponse, CreateCommentInput};

// Re-export user types
pub use self::user::UserResponse;

// Re-export media upload types
pub use self::media_upload::{MediaUploadResponse, StorageType};

// Re-export notification types
pub use self::notification::{CreateNotificationInput, Notification, NotificationCount};

// Common type aliases
pub type ID = async_graphql::ID;
pub type JsonValue = serde_json::Value;
pub type DateTime = chrono::DateTime<chrono::Utc>;
