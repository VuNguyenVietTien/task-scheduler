pub mod comment;
pub mod project;
pub mod user;

// Re-export commonly used types
pub use comment::{CommentQuery, CommentMutation, CommentResponse};
pub use project::{ProjectQuery, ProjectMutation, ProjectResponse};
pub use user::{UserQuery, UserMutation, UserResponse};
