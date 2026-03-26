use async_graphql::*;
use log::{info, error};

mod comment;
mod task_comments;

use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::resolvers::comments::CommentResponse;
use comment::get_comment;
use task_comments::get_task_comments;

#[derive(Default)]
pub struct CommentQuery;

#[Object]
impl CommentQuery {
    pub async fn comment(&self, ctx: &Context<'_>, id: ID) -> Result<Option<CommentResponse>> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = context.get_pool();
        
        info!("GraphQL query comment for id: {:?}", id);
        
        get_comment(pool, &id)
            .await
            .map_err(|e| {
                error!("Error fetching comment: {:?}", e);
                Error::new(format!("Database error: {:?}", e))
            })
    }

    pub async fn task_comments(
        &self,
        ctx: &Context<'_>,
        task_id: ID,
    ) -> Result<Vec<CommentResponse>> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = context.get_pool();
        
        info!("GraphQL query task_comments for task_id: {:?}", task_id);
        
        get_task_comments(pool, &task_id)
            .await
            .map_err(|e| {
                error!("Error fetching task comments: {:?}", e);
                Error::new(format!("Database error: {:?}", e))
            })
    }
} 