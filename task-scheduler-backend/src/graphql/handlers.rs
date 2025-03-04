use actix_web::{web, HttpResponse, Result};
use async_graphql::http::{playground_source, GraphQLPlaygroundConfig};
use async_graphql_actix_web::{GraphQLRequest, GraphQLResponse};
use sqlx::PgPool;

use crate::auth::error::AuthError;
use crate::graphql::{
    dataloaders::{ProjectLoader, UserLoader},
    schema::AppSchema,
    Context,
};

pub async fn graphql_handler(
    pool: web::Data<PgPool>,
    schema: web::Data<AppSchema>,
    req: GraphQLRequest,
) -> Result<GraphQLResponse> {
    let db = pool.get_ref().clone();
    
    let context = Context::new(
        db.clone(),
        None, // user_id will be set by auth middleware if present
        ProjectLoader::new(db.clone()),
        UserLoader::new(db),
    );

    let schema = schema.get_ref();
    let request = req.into_inner().data(context);
    
    // Execute query with context
    Ok(schema
        .execute(request)
        .await 
        .into())
}

pub async fn graphql_playground() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(playground_source(
            GraphQLPlaygroundConfig::new("/graphql").subscription_endpoint("/graphql"),
        )))
}

pub async fn graphql_ws_handler(
    pool: web::Data<PgPool>,
    schema: web::Data<AppSchema>,
    req: GraphQLRequest,
) -> Result<GraphQLResponse, actix_web::Error> {
    let db = pool.get_ref().clone();
    
    let context = Context::new(
        db.clone(),
        None,
        ProjectLoader::new(db.clone()),
        UserLoader::new(db),
    );

    let schema = schema.get_ref();
    let request = req.into_inner().data(context);
    
    // Execute query with context
    Ok(schema
        .execute(request)
        .await 
        .into())
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