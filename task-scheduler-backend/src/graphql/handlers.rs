use actix_web::{web, HttpRequest, HttpResponse, Result};
use async_graphql::http::{playground_source, GraphQLPlaygroundConfig};
use async_graphql_actix_web::{GraphQLRequest, GraphQLResponse};
use sqlx::PgPool;
use std::sync::Arc;
use std::ops::Deref;

use crate::auth::{error::AuthError, jwt, types};
use crate::config::Config;
use crate::graphql::{
    schema::AppSchema,
    Context,
    dataloaders::{ProjectLoader, UserLoader},
};

pub async fn graphql_handler(
    schema: web::Data<AppSchema>,
    req: HttpRequest,
    gql_req: GraphQLRequest,
    pool: web::Data<Arc<PgPool>>,
    config: web::Data<Config>,
    project_loader: web::Data<ProjectLoader>,
    user_loader: web::Data<UserLoader>,
) -> Result<GraphQLResponse> {
    eprintln!("\n=== GraphQL Handler Start ===");

    // Log dependencies availability
    eprintln!("All dependencies loaded");

    // Convert request to string for logging
    let request = gql_req.into_inner();
    eprintln!("Query: {}", request.query);
    eprintln!("Variables: {:?}", request.variables);
    eprintln!("Operation Name: {:?}", request.operation_name);

    // Extract and validate auth token
    let auth = if let Some(auth_header) = req.headers().get("Authorization") {
        eprintln!("Auth header found: {}", auth_header.to_str().unwrap_or("Invalid header"));
        if let Ok(auth_str) = auth_header.to_str() {
            if auth_str.starts_with("Bearer ") {
                let token_str = auth_str[7..].to_string();
                match jwt::verify_token(&token_str, config.deref()) {
                    Ok(jwt_claims) => {
                        eprintln!("Token validated successfully for user: {}", jwt_claims.sub);
                        // Convert jwt::Claims to auth::types::Claims
                        Some(types::Claims {
                            sub: jwt_claims.sub.clone(),
                            exp: jwt_claims.exp as i64,  // Convert usize to i64
                            iat: jwt_claims.iat as i64,  // Convert usize to i64
                            email: jwt_claims.email,
                            display_name: jwt_claims.sub, // Use sub as display_name since it's not available in jwt::Claims
                        })
                    },
                    Err(e) => {
                        eprintln!("Token validation failed: {:?}", e);
                        None
                    }
                }
            } else {
                eprintln!("Not a Bearer token");
                None
            }
        } else {
            eprintln!("Invalid auth header format");
            None
        }
    } else {
        eprintln!("No Authorization header found");
        None
    };

    // Get inner pool without Arc wrapper
    let pool = pool.as_ref();
    let inner_pool = pool.as_ref().clone();

    // Create new context with auth
    let context = Context::new(
        inner_pool,
        auth,
        project_loader.get_ref().clone(),
        user_loader.get_ref().clone(),
        config.get_ref().clone(),
    );

    let schema = schema.get_ref();
    let mut request = request;
    request = request.data(context);
    let response = schema.execute(request).await;

    eprintln!("\n=== GraphQL Response ===");
    eprintln!("{:#?}", response);
    eprintln!("======================\n");

    Ok(response.into())
}

pub async fn graphql_playground() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(playground_source(
            GraphQLPlaygroundConfig::new("/graphql")
                .subscription_endpoint("/graphql"),
        )))
}

pub async fn graphql_ws_handler(
    schema: web::Data<AppSchema>,
    req: GraphQLRequest,
) -> Result<GraphQLResponse, actix_web::Error> {
    let schema = schema.get_ref();
    let request = req.into_inner();
    let response = schema.execute(request).await;
    Ok(response.into())
}

pub trait IntoGraphQLError {
    fn to_graphql_error(self) -> async_graphql::Error;
}

impl IntoGraphQLError for AuthError {
    fn to_graphql_error(self) -> async_graphql::Error {
        use async_graphql::ErrorExtensions;
        
        let code = match &self {
            AuthError::InvalidCredentials => "INVALID_CREDENTIALS",
            AuthError::InvalidToken(_) => "INVALID_TOKEN",
            AuthError::TokenExpired => "TOKEN_EXPIRED",
            AuthError::TokenCreation(_) => "TOKEN_CREATION_ERROR",
            AuthError::TokenVerification(_) => "TOKEN_VERIFICATION_ERROR", 
            AuthError::EmailNotVerified => "EMAIL_NOT_VERIFIED",
            AuthError::EmailAlreadyExists => "EMAIL_EXISTS",
            AuthError::UserNotFound => "USER_NOT_FOUND",
            AuthError::InvalidUserId => "INVALID_USER_ID",
            AuthError::InvalidVerificationToken => "INVALID_VERIFICATION_TOKEN",
            AuthError::ValidationError(_) => "VALIDATION_ERROR",
            AuthError::PasswordError(_) => "PASSWORD_ERROR",
            AuthError::Database(_) => "DATABASE_ERROR",
            AuthError::Internal(_) => "INTERNAL_ERROR",
            AuthError::Other(_) => "OTHER_ERROR",
        };

        async_graphql::Error::new(self.to_string()).extend_with(|_, e| {
            e.set("code", code)
        })
    }
}

#[async_trait::async_trait]
pub trait GraphQLErrorExt {
    async fn error(&self, err: impl IntoGraphQLError + Send) -> async_graphql::Error;
}

#[async_trait::async_trait]
impl<T> GraphQLErrorExt for T
where
    T: Send + Sync,
{
    async fn error(&self, err: impl IntoGraphQLError + Send) -> async_graphql::Error {
        err.to_graphql_error()
    }
}