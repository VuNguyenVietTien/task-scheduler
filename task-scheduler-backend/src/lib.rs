pub mod api;
pub mod auth;
pub mod config;
pub mod db;
pub mod email;
pub mod error;
pub mod firebase;
pub mod graphql;
pub mod session;
pub mod utils;

// Re-exports from auth module
pub use auth::{
    error::AuthError,
    service::AuthService,
    types::{Claims, LoginInput, RegisterInput, User, UserResponse, UserRole, UserProvider},
};

// Re-exports from config
pub use config::{
    Config, 
    ConfigError,
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
};

// Re-exports from db module
pub use db::types::{
    MemberRole,
    ProjectStatus, 
    ProjectPriority,
    ProjectVisibility,
    PaginationParams,
    SortDirection
};

// Re-exports from error
pub use error::{
    AppError, 
    AppResult,
};

// Re-exports from graphql
pub use graphql::schema::AppSchema;

// Public re-exports of commonly used external crates
pub use async_graphql;
pub use chrono;
pub use serde_json;
pub use sqlx::{self, postgres::PgRow};
pub use uuid;

// Public re-exports of essential traits
pub use sqlx::{Row, Connection};

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::PgPool;
    use std::env;

    pub async fn create_test_pool() -> PgPool {
        let database_url = env::var("DATABASE_URL")
            .expect("DATABASE_URL must be set for tests");

        PgPool::connect(&database_url)
            .await
            .expect("Failed to create database pool")
    }
}
