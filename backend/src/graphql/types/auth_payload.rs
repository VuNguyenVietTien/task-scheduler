use async_graphql::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(SimpleObject, Debug, Serialize, Deserialize)]
#[graphql(rename_fields = "snake_case")]
pub struct AuthPayload {
    pub user_id: Uuid,
    pub email: String,
    pub username: Option<String>,
    pub access_token: String,
    pub refresh_token: Option<String>,
}

#[derive(InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct LoginInput {
    pub email: String,
    pub password: String,
}

#[derive(InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct RegisterInput {
    pub email: String,
    pub password: String,
    pub username: Option<String>,
}
