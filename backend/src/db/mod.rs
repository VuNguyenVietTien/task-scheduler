// Re-export all modules
pub mod enums;
pub mod helpers;
pub mod models;
pub mod plans;
pub mod queries;
pub mod types;

// Re-export commonly used items
pub use enums::*;
pub use helpers::*;
pub use models::*;
pub use plans::*;
pub use queries::*;
pub use types::*;

use chrono::{DateTime, Utc};
use sqlx::postgres::PgPoolOptions;
use std::time::Duration;

/// Postgres connection pool type alias
pub type Pool = sqlx::PgPool;

/// Postgres transaction type alias
pub type Transaction<'t> = sqlx::Transaction<'t, sqlx::Postgres>;

/// Creates a new database connection pool with the specified configuration
pub async fn create_pool(database_url: &str) -> Result<Pool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(3))
        .connect(database_url)
        .await
}

/// Helper function to get current UTC timestamp
pub fn now() -> DateTime<Utc> {
    Utc::now()
}
