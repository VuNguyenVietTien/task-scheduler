use std::fmt;
use std::error::Error;
use bcrypt::BcryptError;
use jsonwebtoken::errors::Error as JwtError;

#[derive(Debug)]
pub enum AuthError {
    // Password related errors
    HashingError(BcryptError),
    VerificationError(BcryptError),
    InvalidPassword,
    
    // Token related errors
    TokenCreationError(JwtError),
    TokenValidationError(JwtError),
    TokenExpired,
    InvalidToken,
    
    // Email verification errors
    EmailNotVerified,
    EmailVerificationExpired,
    EmailVerificationFailed(String),
    
    // Password reset errors
    PasswordResetExpired,
    PasswordResetFailed(String),
    InvalidResetToken,
    
    // Validation errors
    InvalidEmail,
    EmailAlreadyExists,
    UserNotFound,
    
    // Email service errors
    EmailSendingFailed(String),
    
    // Database errors
    DatabaseError(String),
    
    // Generic errors
    InternalServerError(String),
}

impl fmt::Display for AuthError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            AuthError::HashingError(e) => write!(f, "Password hashing error: {}", e),
            AuthError::VerificationError(e) => write!(f, "Password verification error: {}", e),
            AuthError::InvalidPassword => write!(f, "Invalid password"),
            AuthError::TokenCreationError(e) => write!(f, "Token creation error: {}", e),
            AuthError::TokenValidationError(e) => write!(f, "Token validation error: {}", e),
            AuthError::TokenExpired => write!(f, "Token has expired"),
            AuthError::InvalidToken => write!(f, "Invalid token"),
            AuthError::EmailNotVerified => write!(f, "Email not verified"),
            AuthError::EmailVerificationExpired => write!(f, "Email verification link has expired"),
            AuthError::EmailVerificationFailed(e) => write!(f, "Email verification failed: {}", e),
            AuthError::PasswordResetExpired => write!(f, "Password reset link has expired"),
            AuthError::PasswordResetFailed(e) => write!(f, "Password reset failed: {}", e),
            AuthError::InvalidResetToken => write!(f, "Invalid password reset token"),
            AuthError::InvalidEmail => write!(f, "Invalid email format"),
            AuthError::EmailAlreadyExists => write!(f, "Email already exists"),
            AuthError::UserNotFound => write!(f, "User not found"),
            AuthError::EmailSendingFailed(e) => write!(f, "Failed to send email: {}", e),
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
            AuthError::InvalidToken |
            AuthError::InvalidResetToken => 400,
            
            AuthError::EmailAlreadyExists => 409,
            AuthError::UserNotFound => 404,
            
            AuthError::TokenExpired |
            AuthError::EmailNotVerified |
            AuthError::EmailVerificationExpired |
            AuthError::PasswordResetExpired |
            AuthError::TokenValidationError(_) |
            AuthError::TokenCreationError(_) => 401,
            
            AuthError::HashingError(_) |
            AuthError::VerificationError(_) |
            AuthError::EmailVerificationFailed(_) |
            AuthError::PasswordResetFailed(_) |
            AuthError::EmailSendingFailed(_) |
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
        assert_eq!(AuthError::EmailNotVerified.status_code(), 401);
        assert_eq!(AuthError::InternalServerError("test".to_string()).status_code(), 500);
    }

    #[test]
    fn test_error_messages() {
        assert_eq!(AuthError::InvalidPassword.to_string(), "Invalid password");
        assert_eq!(AuthError::EmailNotVerified.to_string(), "Email not verified");
        assert_eq!(AuthError::EmailAlreadyExists.to_string(), "Email already exists");
    }
}