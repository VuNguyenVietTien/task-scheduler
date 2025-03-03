use async_graphql::Context;
use sea_orm::DatabaseConnection;
use std::sync::Arc;

use crate::auth::AuthUser;

#[derive(Clone)]
pub struct GraphQLContext {
    pub db: Arc<DatabaseConnection>,
    pub auth_user: Option<AuthUser>,
}

impl GraphQLContext {
    pub fn new(db: Arc<DatabaseConnection>, auth_user: Option<AuthUser>) -> Self {
        Self { db, auth_user }
    }
}

pub trait ContextExt {
    fn get_db(&self) -> &DatabaseConnection;
    fn get_auth_user(&self) -> Option<&AuthUser>;
    fn require_auth(&self) -> async_graphql::Result<&AuthUser>;
    fn require_admin(&self) -> async_graphql::Result<&AuthUser>;
}

impl ContextExt for Context<'_> {
    fn get_db(&self) -> &DatabaseConnection {
        &*self.data_unchecked::<GraphQLContext>().db
    }

    fn get_auth_user(&self) -> Option<&AuthUser> {
        self.data_unchecked::<GraphQLContext>()
            .auth_user
            .as_ref()
    }

    fn require_auth(&self) -> async_graphql::Result<&AuthUser> {
        self.get_auth_user()
            .ok_or_else(|| async_graphql::Error::new("Not authenticated"))
    }

    fn require_admin(&self) -> async_graphql::Result<&AuthUser> {
        let user = self.require_auth()?;
        if !user.is_admin() {
            return Err(async_graphql::Error::new("Admin access required"));
        }
        Ok(user)
    }
}
