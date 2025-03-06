use actix_web::{web, HttpResponse, Result};
use async_graphql::http::{playground_source, GraphQLPlaygroundConfig};
use async_graphql_actix_web::{GraphQLRequest, GraphQLResponse};
use sqlx::PgPool;

use crate::auth::error::AuthError;
use crate::config::Config;
use crate::graphql::{
    schema::AppSchema,
    Context,
};

pub async fn graphql_handler(
    schema: web::Data<AppSchema>,
    req: GraphQLRequest,
) -> Result<GraphQLResponse> {
    // Convert request to string for logging
    let request = req.into_inner();
    eprintln!("\n=== Incoming GraphQL Request ===");
    eprintln!("Query: {}", request.query);
    eprintln!("Variables: {:?}", request.variables);
    eprintln!("Operation Name: {:?}", request.operation_name);
    eprintln!("==============================\n");

    let schema = schema.get_ref();
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