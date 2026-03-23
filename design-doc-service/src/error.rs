use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Unauthorized: {0}")]
    Unauthorized(String),
    #[error("Forbidden: {0}")]
    Forbidden(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("SVG too large: max {max} bytes, got {actual}")]
    SvgTooLarge { max: usize, actual: usize },
    #[error("Internal error: {0}")]
    Internal(String),
}

const VALID_ENTITY_TYPES: &[&str] = &["system", "module", "document", "screen", "component", "flow"];

/// Validate entity_type is one of the allowed values
pub fn validate_entity_type(entity_type: &str) -> Result<(), AppError> {
    if VALID_ENTITY_TYPES.contains(&entity_type) {
        Ok(())
    } else {
        Err(AppError::Validation(format!(
            "Invalid entity_type '{}'. Must be one of: {}",
            entity_type,
            VALID_ENTITY_TYPES.join(", ")
        )))
    }
}

impl AppError {
    /// Convert to an async_graphql::Error with a machine-readable `code` extension.
    pub fn into_graphql_error(self) -> async_graphql::Error {
        use async_graphql::ErrorExtensions;
        let code = match &self {
            AppError::Database(_) => "DATABASE_ERROR",
            AppError::Unauthorized(_) => "UNAUTHORIZED",
            AppError::Forbidden(_) => "FORBIDDEN",
            AppError::NotFound(_) => "NOT_FOUND",
            AppError::Validation(_) => "VALIDATION_ERROR",
            AppError::SvgTooLarge { .. } => "SVG_TOO_LARGE",
            AppError::Internal(_) => "INTERNAL_ERROR",
        };
        async_graphql::Error::new(self.to_string()).extend_with(|_, e| e.set("code", code))
    }
}
