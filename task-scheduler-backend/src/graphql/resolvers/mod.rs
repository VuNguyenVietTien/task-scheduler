mod auth;
// mod comment; // Removed old comment module
mod project;
mod project_member;
mod user;
// mod task;
mod tasks;
mod members;
mod media_upload;
mod plans;
mod notifications;
pub mod comments;

pub use auth::AuthMutation;
// pub use comment::{CommentMutation, CommentQuery}; // Removed old comment exports
pub use project::{ProjectMutation, ProjectQuery};
pub use project_member::{ProjectMemberMutation, ProjectMemberQuery};
pub use user::{UserMutation, UserQuery};
pub use tasks::{TaskMutation, TaskQuery};
pub use members::{MemberMutation, MemberQuery};
pub use media_upload::MediaUploadMutation;
pub use plans::{PlanMutation, PlanQuery};
pub use notifications::{NotificationMutation, NotificationQuery};
pub use comments::query::CommentQuery;
pub use comments::mutation::CommentMutation;
