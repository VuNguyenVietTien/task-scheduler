use async_graphql::*;
use crate::graphql::Context;
use super::types::User;

#[derive(Default)]
pub struct UserQuery;

#[Object]
impl UserQuery {
    async fn user(&self, ctx: &Context<'_>, user_id: ID) -> Result<User> {
        // TODO: Implement user query
        Ok(User {
            id: user_id.to_string(),
            username: "test_user".to_string(),
            full_name: "Test User".to_string(),
            avatar_url: None,
        })
    }
} 