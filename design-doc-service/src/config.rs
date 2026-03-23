use std::env;
use thiserror::Error;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub server_host: String,
    pub server_port: u16,
    pub cors_origin: String,
    pub task_scheduler_url: String,
    pub max_svg_size: usize,
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
            database_url: env::var("DESIGN_DOC_DATABASE_URL")
                .map_err(|_| ConfigError::MissingVar("DESIGN_DOC_DATABASE_URL".into()))?,
            jwt_secret: env::var("JWT_SECRET")
                .map_err(|_| ConfigError::MissingVar("JWT_SECRET".into()))?,
            server_host: env::var("DESIGN_DOC_HOST")
                .unwrap_or_else(|_| "127.0.0.1".to_string()),
            server_port: env::var("DESIGN_DOC_PORT")
                .unwrap_or_else(|_| "8081".to_string())
                .parse()
                .map_err(|_| ConfigError::InvalidVar("DESIGN_DOC_PORT".into()))?,
            cors_origin: env::var("CORS_ORIGIN")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
            task_scheduler_url: env::var("TASK_SCHEDULER_URL")
                .unwrap_or_else(|_| "http://localhost:8080".to_string()),
            max_svg_size: env::var("MAX_SVG_SIZE")
                .unwrap_or_else(|_| "5242880".to_string())
                .parse()
                .unwrap_or(5_242_880),
        })
    }
}
