use std::fmt;
use std::error::Error;
use bcrypt::BcryptError;
use jsonwebtoken::errors::Error as JwtError;

#[derive(Debug)]
pub enum AuthError {
    // Password related errors
    HashingError(BcryptError),
    VerificationError(BcryptError),
    
    // Token related errors
    TokenCreationError(JwtError),
    TokenValidationError(JwtError),
    TokenExpired,
    InvalidToken,
    
    // Validation errors
    InvalidPassword,
    InvalidEmail,
    EmailAlreadyExists,
    UserNotFound,
    
    // Generic errors
    DatabaseError(String),
    InternalServerError(String),
}

impl fmt::Display for AuthError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            AuthError::HashingError(e) => write!(f, "Password hashing error: {}", e),
            AuthError::VerificationError(e) => write!(f, "Password verification error: {}", e),
            AuthError::TokenCreationError(e) => write!(f, "Token creation error: {}", e),
            AuthError::TokenValidationError(e) => write!(f, "Token validation error: {}", e),
            AuthError::TokenExpired => write!(f, "Token has expired"),
            AuthError::InvalidToken => write!(f, "Invalid token"),
            AuthError::InvalidPassword => write!(f, "Invalid password format"),
            AuthError::InvalidEmail => write!(f, "Invalid email format"),
            AuthError::EmailAlreadyExists => write!(f, "Email already exists"),
            AuthError::UserNotFound => write!(f, "User not found"),
            AuthError::DatabaseError(e) => write!(f, "Database error: {}", e),
            AuthError::InternalServerError(e) => write!(f, "Internal server error: {}", e),
        }
    }
}

impl Error for AuthError {}

// Implement conversions from specific error types
impl From<BcryptError> for AuthError {
    fn from(err: BcryptError) -> AuthError {
        AuthError::HashingError(err)
    }
}

impl From<JwtError> for AuthError {
    fn from(err: JwtError) -> AuthError {
        AuthError::TokenValidationError(err)
    }
}

// Convert to HTTP response
impl AuthError {
    pub fn status_code(&self) -> u16 {
        match self {
            AuthError::InvalidPassword | 
            AuthError::InvalidEmail |
            AuthError::InvalidToken => 400,
            
            AuthError::EmailAlreadyExists => 409,
            AuthError::UserNotFound => 404,
            
            AuthError::TokenExpired => 401,
            AuthError::TokenValidationError(_) |
            AuthError::TokenCreationError(_) => 401,
            
            AuthError::HashingError(_) |
            AuthError::VerificationError(_) |
            AuthError::DatabaseError(_) |
            AuthError::InternalServerError(_) => 500,
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
        assert_eq!(AuthError::InvalidPassword.status_code(), 400);
        assert_eq!(AuthError::EmailAlreadyExists.status_code(), 409);
        assert_eq!(AuthError::UserNotFound.status_code(), 404);
        assert_eq!(AuthError::TokenExpired.status_code(), 401);
        assert_eq!(AuthError::InternalServerError("test".to_string()).status_code(), 500);
    }

    #[test]
    fn test_error_messages() {
        let error = AuthError::InvalidPassword;
        assert_eq!(error.to_string(), "Invalid password format");
        
        let error = AuthError::EmailAlreadyExists;
        assert_eq!(error.to_string(), "Email already exists");
    }
}