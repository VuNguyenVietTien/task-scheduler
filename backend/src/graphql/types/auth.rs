use async_graphql::*;
use serde::{Deserialize, Serialize};
use crate::graphql::types::project::User;

#[derive(Debug, Serialize, Deserialize, InputObject)]
pub struct RegisterInput {
    pub email: String,
    pub password: String,
    pub username: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, InputObject)] 
pub struct LoginInput {
    pub email: String,
    pub password: String,
}

#[derive(Debug, SimpleObject)]
pub struct AuthResponse {
    pub token: String,
    pub expires_in: i64,
    pub user: AuthUserResponse,
}

#[derive(Debug, Clone, SimpleObject)]
pub struct AuthUserResponse {
    pub id: String,
    pub email: String, 
    pub name: String,
    pub role: String,
    pub verified: bool,
}

#[derive(SimpleObject)]
pub struct AuthPayload {
    pub access_token: String,
    pub refresh_token: String,
    pub user: User,
}

impl From<crate::auth::types::User> for AuthUserResponse {
    fn from(user: crate::auth::types::User) -> Self {  
        Self {
            id: user.id.to_string(),
            email: user.email,
            name: user.name,
            role: match user.role {
                crate::auth::types::UserRole::Admin => "admin",
                crate::auth::types::UserRole::User => "user", 
            }.to_string(),
            verified: user.verified,
        }
    }
}

impl AuthUserResponse {
    pub fn from_claims(claims: &crate::auth::types::Claims) -> Self {
        Self {
            id: claims.sub.clone(),
            email: claims.email.clone(),
            name: claims.display_name.clone(),
            role: "user".to_string(),
            verified: true,
        }
    }
}