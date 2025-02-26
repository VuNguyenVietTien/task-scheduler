use actix_web::{HttpResponse, ResponseError};
use async_graphql::Error as GraphQLError;
use sea_orm::DbErr;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] DbErr),
    
    #[error("Authentication error: {0}")]
    Auth(String),
    
    #[error("Validation error: {0}")]
    Validation(String),
    
    #[error("Not found: {0}")]
    NotFound(String),
    
    #[error("Forbidden: {0}")]
    Forbidden(String),
    
    #[error("Internal server error: {0}")]
    Internal(String),
    
    #[error("Supabase error: {0}")]
    Supabase(String),
}

impl From<AppError> for GraphQLError {
    fn from(error: AppError) -> Self {
        GraphQLError::new(error.to_string())
    }
}

impl ResponseError for AppError {
    fn error_response(&self) -> HttpResponse {
        let status = match self {
            AppError::Database(_) => actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
            AppError::Auth(_) => actix_web::http::StatusCode::UNAUTHORIZED,
            AppError::Validation(_) => actix_web::http::StatusCode::BAD_REQUEST,
            AppError::NotFound(_) => actix_web::http::StatusCode::NOT_FOUND,
            AppError::Forbidden(_) => actix_web::http::StatusCode::FORBIDDEN,
            AppError::Internal(_) => actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
            AppError::Supabase(_) => actix_web::http::StatusCode::BAD_GATEWAY,
        };

        HttpResponse::build(status).json(serde_json::json!({
            "error": self.to_string()
        }))
    }
}

pub type AppResult<T> = Result<T, AppError>;
