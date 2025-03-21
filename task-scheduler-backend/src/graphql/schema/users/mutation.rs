use async_graphql::*;
use crate::graphql::Context;
use super::types::{User, CreateUserInput};

#[derive(Default)]
pub struct UserMutation;

#[Object]
impl UserMutation {
    async fn create_user(&self, ctx: &Context<'_>, input: CreateUserInput) -> Result<User> {
        // TODO: Implement user creation
        Ok(User {
            id: "1".to_string(),
            username: input.username,
            full_name: input.full_name,
            avatar_url: None,
        })
    }
} 