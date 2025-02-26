pub mod task;
pub mod project;
pub mod comment;
pub mod attachment;
pub mod notification;

use task::{TaskQuery, TaskMutation};
use project::{ProjectQuery, ProjectMutation};
use comment::{CommentQuery, CommentMutation};
use attachment::{AttachmentQuery, AttachmentMutation};
use notification::{NotificationQuery, NotificationMutation};

#[derive(async_graphql::MergedObject, Default)]
pub struct Query(
    TaskQuery,
    ProjectQuery,
    CommentQuery,
    AttachmentQuery,
    NotificationQuery,
);

#[derive(async_graphql::MergedObject, Default)]
pub struct Mutation(
    TaskMutation,
    ProjectMutation,
    CommentMutation,
    AttachmentMutation,
    NotificationMutation,
);
