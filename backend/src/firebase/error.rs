use std::fmt;
use std::error::Error;
use firebase_admin_sdk::auth::ErrorKind as FirebaseErrorKind;

#[derive(Debug)]
pub enum FirebaseError {
    // Token errors
    InvalidToken(String),
    ExpiredToken,
    RevokedToken,
    
    // Authentication errors
    InvalidCredentials,
    UserNotFound,
    UserDisabled,
    
    // Claims errors
    InvalidClaims(String),
    MissingClaim(String),
    
    // Service errors
    ServiceAccountError(String),
    InitializationError(String),
    
    // Provider errors
    ProviderError(String),
    ProviderLinkError(String),
    
    // Generic errors
    NetworkError(String),
    InternalError(String),
}

impl fmt::Display for FirebaseError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            FirebaseError::InvalidToken(msg) => write!(f, "Invalid Firebase token: {}", msg),
            FirebaseError::ExpiredToken => write!(f, "Firebase token has expired"),
            FirebaseError::RevokedToken => write!(f, "Firebase token has been revoked"),
            FirebaseError::InvalidCredentials => write!(f, "Invalid Firebase credentials"),
            FirebaseError::UserNotFound => write!(f, "Firebase user not found"),
            FirebaseError::UserDisabled => write!(f, "Firebase user account is disabled"),
            FirebaseError::InvalidClaims(msg) => write!(f, "Invalid Firebase claims: {}", msg),
            FirebaseError::MissingClaim(claim) => write!(f, "Missing required claim: {}", claim),
            FirebaseError::ServiceAccountError(msg) => write!(f, "Service account error: {}", msg),
            FirebaseError::InitializationError(msg) => write!(f, "Firebase initialization error: {}", msg),
            FirebaseError::ProviderError(msg) => write!(f, "Provider error: {}", msg),
            FirebaseError::ProviderLinkError(msg) => write!(f, "Provider link error: {}", msg),
            FirebaseError::NetworkError(msg) => write!(f, "Network error: {}", msg),
            FirebaseError::InternalError(msg) => write!(f, "Internal error: {}", msg),
        }
    }
}

impl Error for FirebaseError {}

impl From<firebase_admin_sdk::auth::Error> for FirebaseError {
    fn from(error: firebase_admin_sdk::auth::Error) -> Self {
        match error.kind() {
            FirebaseErrorKind::InvalidIdToken => FirebaseError::InvalidToken(error.to_string()),
            FirebaseErrorKind::ExpiredIdToken => FirebaseError::ExpiredToken,
            FirebaseErrorKind::RevokedIdToken => FirebaseError::RevokedToken,
            FirebaseErrorKind::UserNotFound => FirebaseError::UserNotFound,
            FirebaseErrorKind::UserDisabled => FirebaseError::UserDisabled,
            _ => FirebaseError::InternalError(error.to_string()),
        }
    }
}

// Convert to HTTP response status codes
impl FirebaseError {
    pub fn status_code(&self) -> u16 {
        match self {
            FirebaseError::InvalidToken(_) |
            FirebaseError::ExpiredToken |
            FirebaseError::RevokedToken |
            FirebaseError::InvalidCredentials => 401,

            FirebaseError::UserNotFound => 404,
            FirebaseError::UserDisabled => 403,
            
            FirebaseError::InvalidClaims(_) |
            FirebaseError::MissingClaim(_) => 400,

            FirebaseError::ServiceAccountError(_) |
            FirebaseError::InitializationError(_) |
            FirebaseError::ProviderError(_) |
            FirebaseError::ProviderLinkError(_) |
            FirebaseError::NetworkError(_) |
            FirebaseError::InternalError(_) => 500,
        }
    }

    pub fn error_response(&self) -> (u16, String) {
        (self.status_code(), self.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_status_codes() {
        assert_eq!(FirebaseError::InvalidToken("test".to_string()).status_code(), 401);
        assert_eq!(FirebaseError::UserNotFound.status_code(), 404);
        assert_eq!(FirebaseError::UserDisabled.status_code(), 403);
        assert_eq!(FirebaseError::InternalError("test".to_string()).status_code(), 500);
    }

    #[test]
    fn test_error_messages() {
        let error = FirebaseError::InvalidToken("invalid signature".to_string());
        assert_eq!(
            error.to_string(),
            "Invalid Firebase token: invalid signature"
        );

        let error = FirebaseError::MissingClaim("role".to_string());
        assert_eq!(error.to_string(), "Missing required claim: role");
    }
}