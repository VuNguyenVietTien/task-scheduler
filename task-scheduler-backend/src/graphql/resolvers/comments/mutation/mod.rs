use async_graphql::*;
use uuid::Uuid;

use crate::db::models::CreateCommentInput;
use crate::db::services::comment_service::create_comment_with_notifications;
use crate::graphql::context::Context;

pub struct CommentMutation;

#[Object]
impl CommentMutation {
    async fn create_comment(
        &self,
        ctx: &Context<'_>,
        input: CreateCommentInput,
    ) -> Result<Uuid> {
        let pool = ctx.get_pool();
        create_comment_with_notifications(pool, input).await.map_err(|e| Error::new(e.to_string()))
    }
} 