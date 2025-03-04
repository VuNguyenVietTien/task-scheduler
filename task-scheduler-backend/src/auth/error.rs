use actix_web::{http::StatusCode, HttpResponse, ResponseError};
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AuthError {
    #[error("Invalid credentials")]
    InvalidCredentials,

    #[error("Invalid token: {0}")]
    InvalidToken(String),

    #[error("Token expired")]
    TokenExpired,

    #[error("Token creation failed: {0}")]
    TokenCreation(String),

    #[error("Token verification failed: {0}")]
    TokenVerification(String),

    #[error("Email not verified")]
    EmailNotVerified,

    #[error("Email already exists")]
    EmailAlreadyExists,

    #[error("User not found")]
    UserNotFound,

    #[error("Invalid user ID")]
    InvalidUserId,

    #[error("Invalid verification token")]
    InvalidVerificationToken,

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Password error: {0}")]
    PasswordError(String),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Internal error: {0}")]
    Internal(String),
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
            AuthError::InvalidToken(_) => StatusCode::UNAUTHORIZED,
            AuthError::TokenExpired => StatusCode::UNAUTHORIZED,
            AuthError::TokenCreation(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AuthError::TokenVerification(_) => StatusCode::UNAUTHORIZED,
            AuthError::EmailNotVerified => StatusCode::FORBIDDEN,
            AuthError::EmailAlreadyExists => StatusCode::CONFLICT,
            AuthError::UserNotFound => StatusCode::NOT_FOUND,
            AuthError::InvalidUserId => StatusCode::BAD_REQUEST,
            AuthError::InvalidVerificationToken => StatusCode::BAD_REQUEST,
            AuthError::ValidationError(_) => StatusCode::BAD_REQUEST,
            AuthError::PasswordError(_) => StatusCode::BAD_REQUEST,
            AuthError::Database(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AuthError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_response(&self) -> HttpResponse {
        let code = match self {
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
            AuthError::TokenExpired.status_code(),
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            AuthError::EmailNotVerified.status_code(),
            StatusCode::FORBIDDEN
        );
        assert_eq!(
            AuthError::EmailAlreadyExists.status_code(),
            StatusCode::CONFLICT
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

        let error = AuthError::TokenExpired;
        let response = error.error_response();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

        let error = AuthError::EmailNotVerified;
        let response = error.error_response();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
    }
}
