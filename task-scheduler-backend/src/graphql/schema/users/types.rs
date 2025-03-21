use async_graphql::*;

#[derive(SimpleObject)]
pub struct User {
    pub id: String,
    pub username: String,
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(InputObject)]
pub struct CreateUserInput {
    pub username: String,
    pub full_name: Option<String>,
} 