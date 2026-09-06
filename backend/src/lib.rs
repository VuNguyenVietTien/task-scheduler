use std::error::Error;

pub mod api;
pub mod auth;
pub mod config;
pub mod db;
pub mod domain;
pub mod email;
pub mod entity;
pub mod error;
pub mod firebase;
pub mod graphql;
pub mod imports;
pub mod migration_runner;
pub mod session;
pub mod utils;
pub mod websocket;

// Re-export commonly used modules
pub use self::{
    api::*,
    auth::*,
    config::{
        Config, API_VERSION, DB_CONNECT_TIMEOUT, DB_MAX_CONNECTIONS, DEFAULT_PAGE_SIZE,
        EMAIL_VERIFICATION_TEMPLATE, ERR_EMAIL_EXISTS, ERR_EMAIL_NOT_VERIFIED,
        ERR_INVALID_CREDENTIALS, ERR_INVALID_TOKEN, ERR_TOKEN_EXPIRED, ERR_USER_NOT_FOUND,
        GRAPHIQL_PATH, GRAPHQL_PATH, MAX_PAGE_SIZE, PASSWORD_RESET_TEMPLATE, REDIS_SESSION_PREFIX,
        RESET_TOKEN_EXPIRY, SESSION_DURATION, VERIFICATION_TOKEN_EXPIRY,
    },
    db::*,
    email::*,
    entity::*,
    error::*,
};

// Application result type
pub type Result<T> = std::result::Result<T, Box<dyn Error>>;

// Utility functions
pub fn init() -> Result<()> {
    // Initialize logging
    env_logger::init();
    Ok(())
}
