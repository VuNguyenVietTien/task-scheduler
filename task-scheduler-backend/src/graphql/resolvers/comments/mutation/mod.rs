use async_graphql::*;
use log::{info, error};

mod create_comment_with_mention;
mod delete_comment;

use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::resolvers::comments::CommentResponse;
use crate::graphql::resolvers::comments::CreateCommentInput;
use create_comment_with_mention::create_comment_with_mentions;
use delete_comment::delete_comment;

#[derive(Default)]
pub struct CommentMutation;

#[Object]
impl CommentMutation {
    async fn create_comment(
        &self,
        ctx: &Context<'_>,
        input: CreateCommentInput,
    ) -> Result<CommentResponse> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = context.get_pool();
        
        // Get authenticated user ID
        let auth = context.get_auth()
            .ok_or_else(|| Error::new("Authentication required"))?;
        
        let user_id = auth.user_id()
            .map_err(|_| Error::new("Invalid user ID"))?;
        
        info!("GraphQL create_comment called by user {} for task {}", user_id, input.task_id);
        
        // Create comment with mention detection and notifications
        let comment = create_comment_with_mentions(pool, user_id, input)
            .await
            .map_err(|e| {
                error!("Failed to create comment: {:?}", e);
                Error::new(format!("Failed to create comment: {:?}", e))
            })?;
        
        info!("Comment created successfully with id: {}", comment.id);
        
        Ok(comment)
    }
    
    async fn delete_comment(
        &self,
        ctx: &Context<'_>,
        comment_id: ID,
    ) -> Result<bool> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = context.get_pool();
        
        // Get authenticated user ID
        let auth = context.get_auth()
            .ok_or_else(|| Error::new("Authentication required"))?;
        
        let user_id = auth.user_id()
            .map_err(|_| Error::new("Invalid user ID"))?;
        
        info!("GraphQL delete_comment called by user {} for comment {:?}", user_id, comment_id);
        
        // Delete the comment
        delete_comment(pool, user_id, &comment_id)
            .await
            .map_err(|e| {
                error!("Failed to delete comment: {:?}", e);
                Error::new(format!("Failed to delete comment: {:?}", e))
            })
    }
} 