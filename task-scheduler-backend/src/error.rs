use async_graphql::{Error as GraphQLError, ErrorExtensions};
use sea_orm::DbErr;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Authentication error: {0}")]
    Auth(String),

    #[error("Authorization error: {0}")]
    Authorization(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Database error: {0}")]
    Database(#[from] DbErr),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Internal server error: {0}")]
    Internal(String),
}

impl From<jsonwebtoken::errors::Error> for AppError {
    fn from(err: jsonwebtoken::errors::Error) -> Self {
        AppError::Auth(err.to_string())
    }
}

impl AppError {
    pub fn to_graphql_error(self) -> GraphQLError {
        match self {
            AppError::Auth(msg) => GraphQLError::new(msg)
                .extend_with(|_, e| e.set("code", "AUTHENTICATION_ERROR")),
            
            AppError::Authorization(msg) => GraphQLError::new(msg)
                .extend_with(|_, e| e.set("code", "AUTHORIZATION_ERROR")),
            
            AppError::Validation(msg) => GraphQLError::new(msg)
                .extend_with(|_, e| e.set("code", "VALIDATION_ERROR")),
            
            AppError::Database(err) => GraphQLError::new(format!("Database error: {}", err))
                .extend_with(|_, e| e.set("code", "DATABASE_ERROR")),
            
            AppError::NotFound(msg) => GraphQLError::new(msg)
                .extend_with(|_, e| e.set("code", "NOT_FOUND")),
            
            AppError::Internal(msg) => GraphQLError::new(msg)
                .extend_with(|_, e| e.set("code", "INTERNAL_SERVER_ERROR")),
        }
    }
}
pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_conversion() {
        let auth_error = AppError::Auth("Invalid token".to_string());
        let graphql_error: GraphQLError = auth_error.into();
        assert!(graphql_error.message.contains("Invalid token"));

        let db_error = DbErr::Custom("Connection failed".to_string());
        let app_error: AppError = db_error.into();
        match app_error {
            AppError::Database(_) => assert!(true),
            _ => assert!(false, "Expected Database error"),
        }
    }
}
