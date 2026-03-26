use actix_web::{http::StatusCode, HttpResponse, ResponseError};
use async_graphql::{Error as GraphQLError, ErrorExtensions};
use serde::Serialize;
use sqlx::error::Error as SqlxError;
use thiserror::Error;

use crate::auth::error::AuthError;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Authentication error: {0}")]
    Auth(#[from] AuthError),

    #[error("Database error: {0}")]
    Database(#[from] SqlxError),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

#[derive(Serialize)]
struct ErrorResponse {
    code: &'static str,
    message: String,
}

impl ResponseError for AppError {
    fn status_code(&self) -> StatusCode {
        match self {
            AppError::Auth(auth_err) => auth_err.status_code(),
            AppError::Database(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::Validation(_) => StatusCode::BAD_REQUEST,
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::Forbidden(_) => StatusCode::FORBIDDEN,
            AppError::Conflict(_) => StatusCode::CONFLICT,
            AppError::BadRequest(_) => StatusCode::BAD_REQUEST,
            AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_response(&self) -> HttpResponse {
        let code = self.error_code();
        HttpResponse::build(self.status_code()).json(ErrorResponse {
            code,
            message: self.to_string(),
        })
    }
}

impl AppError {
    fn error_code(&self) -> &'static str {
        match self {
            AppError::Auth(_) => "AUTH_ERROR",
            AppError::Database(_) => "DATABASE_ERROR",
            AppError::Validation(_) => "VALIDATION_ERROR",
            AppError::NotFound(_) => "NOT_FOUND",
            AppError::Forbidden(_) => "FORBIDDEN",
            AppError::Conflict(_) => "CONFLICT",
            AppError::BadRequest(_) => "BAD_REQUEST",
            AppError::Internal(_) => "INTERNAL_ERROR",
        }
    }

    // Helper constructors
    pub fn validation<T: std::fmt::Display>(message: T) -> Self {
        AppError::Validation(message.to_string())
    }

    pub fn not_found<T: std::fmt::Display>(message: T) -> Self {
        AppError::NotFound(message.to_string())
    }

    pub fn forbidden<T: std::fmt::Display>(message: T) -> Self {
        AppError::Forbidden(message.to_string())
    }

    pub fn conflict<T: std::fmt::Display>(message: T) -> Self {
        AppError::Conflict(message.to_string())
    }

    pub fn bad_request<T: std::fmt::Display>(message: T) -> Self {
        AppError::BadRequest(message.to_string())
    }

    pub fn internal<T: std::fmt::Display>(message: T) -> Self {
        AppError::Internal(message.to_string())
    }

    // Convert to GraphQL error with extensions
    pub fn to_graphql_error(&self) -> GraphQLError {
        let mut err = GraphQLError::new(self.to_string());
        let code = self.error_code();

        err = err.extend_with(|_, e| {
            e.set("code", code);
            e.set("detailed_message", self.to_string());
            
            // Thêm thông tin chi tiết dựa vào loại lỗi
            match self {
                AppError::Database(db_err) => {
                    e.set("database_error", db_err.to_string());
                    if let Some(err_code) = db_err.as_database_error().and_then(|dbe| dbe.code()) {
                        e.set("db_error_code", err_code.to_string());
                    }
                },
                AppError::Validation(msg) => {
                    e.set("validation_error", msg.to_string());
                },
                AppError::Auth(auth_err) => {
                    e.set("auth_error_type", format!("{:?}", auth_err));
                    e.set("auth_error_message", auth_err.to_string());
                },
                _ => {
                    e.set("error_type", format!("{:?}", self));
                }
            }
        });

        err
    }
}

pub type AppResult<T> = Result<T, AppError>;

// Helper trait for converting Result to GraphQL Result
pub trait IntoGraphQLResult<T> {
    fn into_graphql_result(self) -> Result<T, GraphQLError>;
}

impl<T> IntoGraphQLResult<T> for Result<T, AppError> {
    fn into_graphql_result(self) -> Result<T, GraphQLError> {
        self.map_err(|e| e.to_graphql_error())
    }
}
