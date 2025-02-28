use std::error::Error;
use std::fmt;
use actix_web::{HttpResponse, ResponseError};
use serde_json::json;

#[derive(Debug)]
pub enum AuthError {
    DatabaseError(String),
    EmailAlreadyExists,
    UserNotFound,
    InvalidPassword,
    EmailNotVerified,
    TokenCreationError(jsonwebtoken::errors::Error),
    TokenVerificationError(jsonwebtoken::errors::Error),
    HashingError(bcrypt::BcryptError),
    EmailSendingFailed(String),
    InvalidToken,
    TokenExpired,
    ResetTokenExpired,
    ResetTokenInvalid,
    PasswordResetFailed(String),
    InvalidCredentials,
    NotAuthenticated,
    NotAuthorized,
}

impl fmt::Display for AuthError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AuthError::DatabaseError(e) => write!(f, "Lỗi cơ sở dữ liệu: {}", e),
            AuthError::EmailAlreadyExists => write!(f, "Email đã tồn tại"),
            AuthError::UserNotFound => write!(f, "Không tìm thấy người dùng"),
            AuthError::InvalidPassword => write!(f, "Mật khẩu không đúng"),
            AuthError::EmailNotVerified => write!(f, "Email chưa được xác thực"),
            AuthError::TokenCreationError(e) => write!(f, "Lỗi tạo token: {}", e),
            AuthError::TokenVerificationError(e) => write!(f, "Lỗi xác thực token: {}", e),
            AuthError::HashingError(e) => write!(f, "Lỗi mã hóa: {}", e),
            AuthError::EmailSendingFailed(e) => write!(f, "Lỗi gửi email: {}", e),
            AuthError::InvalidToken => write!(f, "Token không hợp lệ"),
            AuthError::TokenExpired => write!(f, "Token đã hết hạn"),
            AuthError::ResetTokenExpired => write!(f, "Token đặt lại mật khẩu đã hết hạn"),
            AuthError::ResetTokenInvalid => write!(f, "Token đặt lại mật khẩu không hợp lệ"),
            AuthError::PasswordResetFailed(e) => write!(f, "Lỗi đặt lại mật khẩu: {}", e),
            AuthError::InvalidCredentials => write!(f, "Thông tin đăng nhập không hợp lệ"),
            AuthError::NotAuthenticated => write!(f, "Chưa xác thực"),
            AuthError::NotAuthorized => write!(f, "Không có quyền truy cập"),
        }
    }
}

impl Error for AuthError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            AuthError::TokenCreationError(e) => Some(e),
            AuthError::TokenVerificationError(e) => Some(e),
            AuthError::HashingError(e) => Some(e),
            _ => None,
        }
    }
}

impl From<sea_orm::DbErr> for AuthError {
    fn from(err: sea_orm::DbErr) -> Self {
        AuthError::DatabaseError(err.to_string())
    }
}

impl From<jsonwebtoken::errors::Error> for AuthError {
    fn from(err: jsonwebtoken::errors::Error) -> Self {
        AuthError::TokenVerificationError(err)
    }
}

impl From<bcrypt::BcryptError> for AuthError {
    fn from(err: bcrypt::BcryptError) -> Self {
        AuthError::HashingError(err)
    }
}

impl ResponseError for AuthError {
    fn error_response(&self) -> HttpResponse {
        let (status_code, error_message) = match self {
            AuthError::EmailAlreadyExists => (
                actix_web::http::StatusCode::BAD_REQUEST,
                "Email already exists",
            ),
            AuthError::UserNotFound => (
                actix_web::http::StatusCode::NOT_FOUND,
                "User not found",
            ),
            AuthError::InvalidPassword => (
                actix_web::http::StatusCode::UNAUTHORIZED,
                "Invalid password",
            ),
            AuthError::EmailNotVerified => (
                actix_web::http::StatusCode::UNAUTHORIZED,
                "Email not verified",
            ),
            AuthError::InvalidToken | AuthError::TokenVerificationError(_) => (
                actix_web::http::StatusCode::UNAUTHORIZED,
                "Invalid token",
            ),
            AuthError::TokenExpired => (
                actix_web::http::StatusCode::UNAUTHORIZED,
                "Token expired",
            ),
            AuthError::NotAuthenticated => (
                actix_web::http::StatusCode::UNAUTHORIZED,
                "Not authenticated",
            ),
            AuthError::NotAuthorized => (
                actix_web::http::StatusCode::FORBIDDEN,
                "Not authorized",
            ),
            _ => (
                actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
                "Internal server error",
            ),
        };

        HttpResponse::build(status_code).json(json!({
            "error": error_message,
            "message": self.to_string(),
        }))
    }
}
