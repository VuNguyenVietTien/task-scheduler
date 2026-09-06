use async_graphql::{Context, Object, Result};
use uuid::Uuid;

use crate::auth::auth_common;
use crate::auth::service::AuthService;
use crate::graphql::types::AuthPayload;
use crate::graphql::types::{LoginInput, RegisterInput};
use crate::graphql::Context as GraphQLContext;

#[derive(Default)]
pub struct AuthMutation;

#[Object(rename_fields = "snake_case", rename_args = "snake_case")]
impl AuthMutation {
    async fn register(&self, ctx: &Context<'_>, input: RegisterInput) -> Result<AuthPayload> {
        let ctx = ctx.data::<GraphQLContext>()?;
        let auth_service = AuthService::new(ctx.db.clone());

        let result = auth_service
            .register(
                input.email.clone(),
                input.password.clone(),
                input.username.clone().unwrap(),
            )
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
            user.user_id,
            user.email.clone(),
            user.username.clone().unwrap(),
            &ctx.config,
        )
        .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        Ok(AuthPayload {
            access_token: token.clone(),
            refresh_token: token,
            user,
        })
    }
}
