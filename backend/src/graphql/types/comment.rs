use async_graphql::{InputObject, SimpleObject, ID};
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(SimpleObject)]
pub struct CommentResponse {
    pub id: ID,
    pub task_id: ID,
    pub user_id: ID,
    pub content: String,
    pub parent_comment_id: Option<ID>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_deleted: bool,
}

#[derive(InputObject)]
pub struct CreateCommentInput {
    pub task_id: ID,
    pub content: String,
    pub parent_comment_id: Option<ID>,
}

impl From<crate::db::models::Comment> for CommentResponse {
    fn from(comment: crate::db::models::Comment) -> Self {
        Self {
            id: comment.comment_id.to_string().into(),
            task_id: comment.task_id.to_string().into(),
            user_id: comment.user_id.to_string().into(),
            content: comment.content,
            parent_comment_id: comment.parent_comment_id.map(|id| id.to_string().into()),
            created_at: comment.created_at,
            updated_at: comment.updated_at,
            is_deleted: comment.is_deleted,
        }
    }
}

impl From<CreateCommentInput> for crate::db::models::Comment {
    fn from(input: CreateCommentInput) -> Self {
        Self {
            comment_id: Uuid::new_v4(),
            task_id: Uuid::parse_str(&input.task_id.to_string())
                .expect("Invalid task ID format"),
            user_id: Uuid::new_v4(), // Will be set in resolver
            content: input.content,
            parent_comment_id: input.parent_comment_id
                .map(|id| Uuid::parse_str(&id.to_string())
                    .expect("Invalid parent comment ID format")),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            is_deleted: false,
        }
    }
}
