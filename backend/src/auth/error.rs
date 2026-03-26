use actix_web::{http::StatusCode, HttpResponse, ResponseError};
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AuthError {
    #[error("Invalid credentials")]
    InvalidCredentials,

    #[error("Invalid user ID")]
    InvalidUserId,

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Token creation error: {0}")]
    TokenCreation(String),

    #[error("Token verification error: {0}")]
    TokenVerification(String),

    #[error("Invalid token: {0}")]
    InvalidToken(String),

    #[error("Token expired")]
    TokenExpired,

    #[error("User not found")]
    UserNotFound,

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Internal error: {0}")]
    InternalError(String),

    #[error("Other error: {0}")]
    Other(String),
}

#[derive(Serialize)]
struct ErrorResponse {
    code: &'static str,
    message: String,
}

impl ResponseError for AuthError {
    fn status_code(&self) -> StatusCode {
        match self {
            AuthError::InvalidCredentials => StatusCode::UNAUTHORIZED,
            AuthError::InvalidUserId => StatusCode::BAD_REQUEST,
            AuthError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            AuthError::Forbidden(_) => StatusCode::FORBIDDEN,
            AuthError::Database(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AuthError::TokenCreation(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AuthError::TokenVerification(_) => StatusCode::UNAUTHORIZED,
            AuthError::InvalidToken(_) => StatusCode::UNAUTHORIZED,
            AuthError::TokenExpired => StatusCode::UNAUTHORIZED,
            AuthError::UserNotFound => StatusCode::NOT_FOUND,
            AuthError::ValidationError(_) => StatusCode::BAD_REQUEST,
            AuthError::InternalError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AuthError::Other(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_response(&self) -> HttpResponse {
        let code = match self {
            AuthError::InvalidCredentials => "INVALID_CREDENTIALS",
            AuthError::InvalidUserId => "INVALID_USER_ID",
            AuthError::Unauthorized(_) => "UNAUTHORIZED",
            AuthError::Forbidden(_) => "FORBIDDEN",
            AuthError::Database(_) => "DATABASE_ERROR",
            AuthError::TokenCreation(_) => "TOKEN_CREATION_ERROR", 
            AuthError::TokenVerification(_) => "TOKEN_VERIFICATION_ERROR",
            AuthError::InvalidToken(_) => "INVALID_TOKEN",
            AuthError::TokenExpired => "TOKEN_EXPIRED",
            AuthError::UserNotFound => "USER_NOT_FOUND",
            AuthError::ValidationError(_) => "VALIDATION_ERROR",
            AuthError::InternalError(_) => "INTERNAL_ERROR",
            AuthError::Other(_) => "OTHER_ERROR",
        };

        HttpResponse::build(self.status_code()).json(ErrorResponse {
            code,
            message: self.to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auth_error_status_codes() {
        assert_eq!(
            AuthError::InvalidCredentials.status_code(),
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            AuthError::InvalidUserId.status_code(),
            StatusCode::BAD_REQUEST
        );
        assert_eq!(
            AuthError::Unauthorized("test".into()).status_code(),
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            AuthError::Forbidden("test".into()).status_code(),
            StatusCode::FORBIDDEN
        );
        assert_eq!(
            AuthError::UserNotFound.status_code(),
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            AuthError::ValidationError("test".into()).status_code(),
            StatusCode::BAD_REQUEST
        );
    }

    #[test]
    fn test_auth_error_response() {
        let error = AuthError::InvalidCredentials;
        let response = error.error_response();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

        let error = AuthError::InvalidUserId;
        let response = error.error_response();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let error = AuthError::Unauthorized("test".into());
        let response = error.error_response();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

        let error = AuthError::Forbidden("test".into());
        let response = error.error_response();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);

        let error = AuthError::UserNotFound;
        let response = error.error_response();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);

        let error = AuthError::ValidationError("test".into());
        let response = error.error_response();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }
}
