#[macro_use]
extern crate async_graphql;

use std::sync::Arc;
pub mod auth;
pub mod config;
pub mod db;
pub mod error;
pub mod graphql;
pub mod utils;
pub mod websocket;

// Re-export primary types
pub use auth::authorize_user;
pub use config::Config;
pub use error::{AppError, AppResult};
pub use graphql::{
    create_schema,
    GraphQLContext,
    Schema,
};

// Convenience macro for current time
#[macro_export]
macro_rules! now {
    () => {
        chrono::Utc::now()
    };
}

// Module initialization functions
pub async fn init(config: &Config) -> AppResult<Schema> {
    let db = db::init_db(config).await?;
    Ok(create_schema(Arc::new(db)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, Utc};

    #[test]
    fn test_now_macro() {
        let before = Utc::now();
        let now = now!();
        let after = Utc::now();

        assert!(now >= before && now <= after);
        assert!(now - before < Duration::seconds(1));
    }
}