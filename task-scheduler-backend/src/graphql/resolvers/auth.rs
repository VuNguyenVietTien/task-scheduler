use async_graphql::{Context, Object, Result};
use uuid::Uuid;

use crate::auth::service::AuthService;
use crate::graphql::types::{RegisterInput, LoginInput, AuthResponse, AuthUserResponse};
use crate::graphql::Context as GraphQLContext;

#[derive(Default)]
pub struct AuthMutation;

#[Object]
impl AuthMutation {
    async fn register(&self, ctx: &Context<'_>, input: RegisterInput) -> Result<AuthResponse> {
        let ctx = ctx.data::<GraphQLContext>()?;
        let auth_service = AuthService::new(ctx.db.clone());

        let user_id = auth_service
            .register(input.email.clone(), input.password.clone(), input.name)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        // Auto login after registration
        let claims = auth_service
            .login(input.email, input.password)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        let (token_str, _) = crate::auth::token::create_token(
            user_id,
            claims.email.clone(),
            claims.display_name.clone(),
        ).map_err(|e| async_graphql::Error::new(e.to_string()))?;

        Ok(AuthResponse {
            token: token_str,
            expires_in: claims.exp - claims.iat,
            user: AuthUserResponse::from_claims(&claims),
        })
    }

    async fn login(
        &self,
        ctx: &Context<'_>,
        input: LoginInput,
    ) -> Result<AuthResponse> {
        let ctx = ctx.data::<GraphQLContext>()?;
        let auth_service = AuthService::new(ctx.db.clone());

        let claims = auth_service
            .login(input.email, input.password)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;
            
        let user_id = Uuid::parse_str(&claims.sub)
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        let (token_str, _) = crate::auth::token::create_token(
            user_id,
            claims.email.clone(),
            claims.display_name.clone(),
        ).map_err(|e| async_graphql::Error::new(e.to_string()))?;

        Ok(AuthResponse {
            token: token_str,
            expires_in: claims.exp - claims.iat,
            user: AuthUserResponse::from_claims(&claims),
        })
    }
}
