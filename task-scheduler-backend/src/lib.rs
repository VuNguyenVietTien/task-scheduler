use std::error::Error;

pub mod api;
pub mod auth;
pub mod config;
pub mod db;
pub mod email;
pub mod entity;
pub mod error;
pub mod firebase;
pub mod graphql;
pub mod session;
pub mod utils;
pub mod websocket;

// Re-export commonly used modules
pub use self::{
    api::*,
    auth::*,
    config::{
        Config,
        VERIFICATION_TOKEN_EXPIRY,
        RESET_TOKEN_EXPIRY,
        REDIS_SESSION_PREFIX,
        SESSION_DURATION,
        DB_MAX_CONNECTIONS,
        DB_CONNECT_TIMEOUT,
        EMAIL_VERIFICATION_TEMPLATE,
        PASSWORD_RESET_TEMPLATE,
        API_VERSION,
        DEFAULT_PAGE_SIZE,
        MAX_PAGE_SIZE,
        GRAPHQL_PATH,
        GRAPHIQL_PATH,
        ERR_INVALID_CREDENTIALS,
        ERR_USER_NOT_FOUND,
        ERR_EMAIL_EXISTS,
        ERR_INVALID_TOKEN,
        ERR_TOKEN_EXPIRED,
        ERR_EMAIL_NOT_VERIFIED,
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
