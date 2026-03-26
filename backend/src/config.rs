use std::env;
use thiserror::Error;

// Constants
pub const JWT_SECRET: &str = "JWT_SECRET";
pub const JWT_EXPIRY: i64 = 86400; // 24 hours
pub const VERIFICATION_TOKEN_EXPIRY: i64 = 86400; // 24 hours
pub const RESET_TOKEN_EXPIRY: i64 = 3600; // 1 hour
pub const REDIS_SESSION_PREFIX: &str = "session:";
pub const SESSION_DURATION: i64 = 86400; // 24 hours
pub const DB_MAX_CONNECTIONS: u32 = 5;
pub const DB_CONNECT_TIMEOUT: u64 = 30; // seconds
pub const EMAIL_VERIFICATION_TEMPLATE: &str = "verification";
pub const PASSWORD_RESET_TEMPLATE: &str = "reset";
pub const API_VERSION: &str = "v1";
pub const DEFAULT_PAGE_SIZE: i64 = 10;
pub const MAX_PAGE_SIZE: i64 = 100;
pub const GRAPHQL_PATH: &str = "/graphql";
pub const GRAPHIQL_PATH: &str = "/graphiql";

// Error Messages
pub const ERR_INVALID_CREDENTIALS: &str = "Invalid email or password";
pub const ERR_USER_NOT_FOUND: &str = "User not found";
pub const ERR_EMAIL_EXISTS: &str = "Email already exists";
pub const ERR_INVALID_TOKEN: &str = "Invalid token";
pub const ERR_TOKEN_EXPIRED: &str = "Token has expired";
pub const ERR_EMAIL_NOT_VERIFIED: &str = "Email not verified";

#[derive(Debug, Clone)]
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

#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("Missing environment variable: {0}")]
    MissingVar(String),
    
    #[error("Invalid environment variable: {0}")]
    InvalidVar(String),
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        Ok(Self {
            database_url: env::var("DATABASE_URL")
                .map_err(|_| ConfigError::MissingVar("DATABASE_URL".into()))?,
                
            redis_url: env::var("REDIS_URL")
                .map_err(|_| ConfigError::MissingVar("REDIS_URL".into()))?,
                
            server_host: env::var("SERVER_HOST")
                .unwrap_or_else(|_| "127.0.0.1".to_string()),
                
            server_port: env::var("SERVER_PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .map_err(|_| ConfigError::InvalidVar("SERVER_PORT".into()))?,
                
            auth_secret: env::var("AUTH_SECRET")
                .map_err(|_| ConfigError::MissingVar("AUTH_SECRET".into()))?,
                
            jwt_secret: env::var(JWT_SECRET)
                .map_err(|_| ConfigError::MissingVar(JWT_SECRET.into()))?,
                
            jwt_expiry: env::var("JWT_EXPIRY")
                .unwrap_or_else(|_| JWT_EXPIRY.to_string())
                .parse()
                .map_err(|_| ConfigError::InvalidVar("JWT_EXPIRY".into()))?,
                
            email_from: env::var("EMAIL_FROM")
                .map_err(|_| ConfigError::MissingVar("EMAIL_FROM".into()))?,
                
            email_smtp_host: env::var("EMAIL_SMTP_HOST")
                .map_err(|_| ConfigError::MissingVar("EMAIL_SMTP_HOST".into()))?,
                
            email_smtp_port: env::var("EMAIL_SMTP_PORT")
                .unwrap_or_else(|_| "587".to_string())
                .parse()
                .map_err(|_| ConfigError::InvalidVar("EMAIL_SMTP_PORT".into()))?,
                
            email_smtp_user: env::var("EMAIL_SMTP_USER")
                .map_err(|_| ConfigError::MissingVar("EMAIL_SMTP_USER".into()))?,
                
            email_smtp_pass: env::var("EMAIL_SMTP_PASS")
                .map_err(|_| ConfigError::MissingVar("EMAIL_SMTP_PASS".into()))?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_from_env() {
        std::env::set_var("DATABASE_URL", "postgres://localhost/test");
        std::env::set_var("REDIS_URL", "redis://localhost");
        std::env::set_var("AUTH_SECRET", "test-auth-secret");
        std::env::set_var(JWT_SECRET, "test-jwt-secret");
        std::env::set_var("EMAIL_FROM", "test@example.com");
        std::env::set_var("EMAIL_SMTP_HOST", "smtp.example.com");
        std::env::set_var("EMAIL_SMTP_USER", "test-user");
        std::env::set_var("EMAIL_SMTP_PASS", "test-pass");

        let config = Config::from_env().unwrap();

        assert_eq!(config.database_url, "postgres://localhost/test");
        assert_eq!(config.redis_url, "redis://localhost"); 
        assert_eq!(config.server_host, "127.0.0.1");
        assert_eq!(config.server_port, 8080);
        assert_eq!(config.auth_secret, "test-auth-secret");
        assert_eq!(config.jwt_secret, "test-jwt-secret");
        assert_eq!(config.jwt_expiry, JWT_EXPIRY);
        assert_eq!(config.email_from, "test@example.com");
        assert_eq!(config.email_smtp_host, "smtp.example.com");
        assert_eq!(config.email_smtp_port, 587);
        assert_eq!(config.email_smtp_user, "test-user");
        assert_eq!(config.email_smtp_pass, "test-pass");
    }
}
