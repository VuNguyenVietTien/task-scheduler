use async_graphql::{Context, Object, Result};
use uuid::Uuid;

use crate::auth::service::AuthService;
use crate::auth::auth_common as auth_common;
use crate::graphql::types::AuthPayload;
use crate::graphql::types::{RegisterInput, LoginInput};
use crate::graphql::Context as GraphQLContext;

#[derive(Default)]
pub struct AuthMutation;

#[Object]
impl AuthMutation {    
    async fn register(&self, ctx: &Context<'_>, input: RegisterInput) -> Result<AuthPayload> {
        let ctx = ctx.data::<GraphQLContext>()?;
        let auth_service = AuthService::new(ctx.db.clone());

        let result = auth_service
            .register(input.email.clone(), input.password.clone(), input.name.clone())
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        let (access_token, refresh_token, user) = result;

        Ok(AuthPayload {
            access_token,
            refresh_token,
            user,
        })
    }

    async fn login(&self, ctx: &Context<'_>, input: LoginInput) -> Result<AuthPayload> {
        let ctx = ctx.data::<GraphQLContext>()?;
        let auth_service = AuthService::new(ctx.db.clone());

        let user = auth_service
            .login(input.email.clone(), input.password)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        let token = crate::auth::auth_common::create_token(
            user.id,
            user.email.clone(),
            user.name.clone(),
            &ctx.config,
        ).map_err(|e| async_graphql::Error::new(e.to_string()))?;

        Ok(AuthPayload {
            access_token: token.clone(),
            refresh_token: token,
            user,
        })
    }
}
