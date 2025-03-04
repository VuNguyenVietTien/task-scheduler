use serde::Deserialize;
use std::env;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("Environment variable not found: {0}")]
    EnvVarNotFound(String),

    #[error("Failed to parse environment variable: {0}")]
    ParseError(String),
}

// Export JWT constants from Config
lazy_static::lazy_static! {
    pub static ref JWT_SECRET: String = env::var("JWT_SECRET")
        .expect("JWT_SECRET must be set");
    pub static ref JWT_EXPIRY: i64 = env::var("JWT_EXPIRY")
        .unwrap_or_else(|_| "86400".to_string())
        .parse()
        .expect("JWT_EXPIRY must be a valid number");
}

#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    pub database_url: String,
    pub redis_url: String,
    pub server_host: String,
    pub server_port: u16,
    pub auth_secret: String,
    pub jwt_secret: String,
    pub jwt_expiry: i64,
    pub email_from: String,
    pub email_smtp_host: String,
    pub email_smtp_port: u16,
    pub email_smtp_user: String,
    pub email_smtp_pass: String,
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        dotenv::dotenv().ok();

        Ok(Config {
            database_url: env::var("DATABASE_URL")
                .map_err(|_| ConfigError::EnvVarNotFound("DATABASE_URL".to_string()))?,
            redis_url: env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string()),
            server_host: env::var("SERVER_HOST")
                .unwrap_or_else(|_| "127.0.0.1".to_string()),
            server_port: env::var("SERVER_PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .map_err(|_| ConfigError::ParseError("SERVER_PORT".to_string()))?,
            auth_secret: env::var("AUTH_SECRET")
                .map_err(|_| ConfigError::EnvVarNotFound("AUTH_SECRET".to_string()))?,
            jwt_secret: env::var("JWT_SECRET")
                .map_err(|_| ConfigError::EnvVarNotFound("JWT_SECRET".to_string()))?,
            jwt_expiry: env::var("JWT_EXPIRY")
                .unwrap_or_else(|_| "86400".to_string()) // 24 hours in seconds
                .parse()
                .map_err(|_| ConfigError::ParseError("JWT_EXPIRY".to_string()))?,
            email_from: env::var("EMAIL_FROM")
                .map_err(|_| ConfigError::EnvVarNotFound("EMAIL_FROM".to_string()))?,
            email_smtp_host: env::var("EMAIL_SMTP_HOST")
                .map_err(|_| ConfigError::EnvVarNotFound("EMAIL_SMTP_HOST".to_string()))?,
            email_smtp_port: env::var("EMAIL_SMTP_PORT")
                .map_err(|_| ConfigError::EnvVarNotFound("EMAIL_SMTP_PORT".to_string()))?
                .parse()
                .map_err(|_| ConfigError::ParseError("EMAIL_SMTP_PORT".to_string()))?,
            email_smtp_user: env::var("EMAIL_SMTP_USER")
                .map_err(|_| ConfigError::EnvVarNotFound("EMAIL_SMTP_USER".to_string()))?,
            email_smtp_pass: env::var("EMAIL_SMTP_PASS")
                .map_err(|_| ConfigError::EnvVarNotFound("EMAIL_SMTP_PASS".to_string()))?,
        })
    }
}

pub const VERIFICATION_TOKEN_EXPIRY: i64 = 24 * 60 * 60; // 24 hours
pub const RESET_TOKEN_EXPIRY: i64 = 1 * 60 * 60; // 1 hour

// Redis Configuration constants
pub const REDIS_SESSION_PREFIX: &str = "session:";
pub const SESSION_DURATION: i64 = 30 * 24 * 60 * 60; // 30 days in seconds

// Database Configuration constants 
pub const DB_MAX_CONNECTIONS: u32 = 5;
pub const DB_CONNECT_TIMEOUT: u64 = 10; // seconds

// Email Configuration constants
pub const EMAIL_VERIFICATION_TEMPLATE: &str = "email_verification";
pub const PASSWORD_RESET_TEMPLATE: &str = "password_reset";

// API Configuration constants
pub const API_VERSION: &str = "v1";
pub const DEFAULT_PAGE_SIZE: i64 = 10;
pub const MAX_PAGE_SIZE: i64 = 100;

// GraphQL Configuration constants
pub const GRAPHQL_PATH: &str = "/graphql";
pub const GRAPHIQL_PATH: &str = "/graphiql";

// Error message constants
pub const ERR_INVALID_CREDENTIALS: &str = "Invalid credentials";
pub const ERR_USER_NOT_FOUND: &str = "User not found";
pub const ERR_EMAIL_EXISTS: &str = "Email already exists";
pub const ERR_INVALID_TOKEN: &str = "Invalid token";
pub const ERR_TOKEN_EXPIRED: &str = "Token expired";
pub const ERR_EMAIL_NOT_VERIFIED: &str = "Email not verified";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_from_env() {
        std::env::set_var("DATABASE_URL", "postgres://localhost/test");
        std::env::set_var("JWT_SECRET", "test-jwt-secret");
        std::env::set_var("AUTH_SECRET", "test-auth-secret");
        std::env::set_var("EMAIL_FROM", "test@example.com");
        std::env::set_var("EMAIL_SMTP_HOST", "smtp.example.com");
        std::env::set_var("EMAIL_SMTP_PORT", "587");
        std::env::set_var("EMAIL_SMTP_USER", "test-user");
        std::env::set_var("EMAIL_SMTP_PASS", "test-pass");

        let config = Config::from_env().unwrap();
        assert_eq!(config.database_url, "postgres://localhost/test");
        assert_eq!(config.jwt_secret, "test-jwt-secret");
        assert_eq!(config.auth_secret, "test-auth-secret");
        assert_eq!(config.email_from, "test@example.com");
        assert_eq!(config.email_smtp_host, "smtp.example.com");
        assert_eq!(config.email_smtp_port, 587);
        assert_eq!(config.email_smtp_user, "test-user");
        assert_eq!(config.email_smtp_pass, "test-pass");
    }
}
