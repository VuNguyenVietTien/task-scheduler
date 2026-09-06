use async_graphql::*;
use log::{error, info};

mod create_comment_with_mention;
mod delete_comment;

use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::resolvers::comments::CommentResponse;
use crate::graphql::resolvers::comments::CreateCommentInput;
use create_comment_with_mention::create_comment_with_mentions;
use delete_comment::delete_comment;

#[derive(Default)]
pub struct CommentMutation;

#[Object(rename_fields = "snake_case", rename_args = "snake_case")]
impl CommentMutation {
    async fn create_comment(
        &self,
        ctx: &Context<'_>,
        input: CreateCommentInput,
    ) -> Result<CommentResponse> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = context.get_pool();

        // Get authenticated user ID
        let auth = context
            .get_auth()
            .ok_or_else(|| Error::new("Authentication required"))?;

        let user_id = auth.user_id().map_err(|_| Error::new("Invalid user ID"))?;

        info!(
            "GraphQL create_comment called by user {} for task {}",
            user_id, input.task_id
        );

        // Get firebase service if available from data context
        let firebase_service = ctx.data::<crate::firebase::FirebaseService>().ok();

        // Create comment with mention detection and notifications
        let comment = create_comment_with_mentions(pool, user_id, input, firebase_service)
            .await
            .map_err(|e| {
                error!("Failed to create comment: {:?}", e);
                Error::new(format!("Failed to create comment: {:?}", e))
            })?;

        info!("Comment created successfully with id: {}", comment.id);

        Ok(comment)
    }

    async fn delete_comment(&self, ctx: &Context<'_>, id: ID) -> Result<bool> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = context.get_pool();

        // Get authenticated user ID
        let auth = context
            .get_auth()
            .ok_or_else(|| Error::new("Authentication required"))?;

        let user_id = auth.user_id().map_err(|_| Error::new("Invalid user ID"))?;

        info!(
            "GraphQL delete_comment called by user {} for comment {:?}",
            user_id, id
        );

        // Delete the comment
        delete_comment(pool, user_id, &id).await.map_err(|e| {
            error!("Failed to delete comment: {:?}", e);
            Error::new(format!("Failed to delete comment: {:?}", e))
        })
    }
}
