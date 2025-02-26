pub mod entities;
pub mod migrations;

use sea_orm::{Database, DatabaseConnection};
use crate::error::AppResult;
use crate::config::Config;

pub async fn init_database(config: &Config) -> AppResult<DatabaseConnection> {
    let connection = Database::connect(&config.database_url)
        .await
        .map_err(|e| crate::error::AppError::Database(e))?;

    // Run migrations if needed
    // migrations::Migrator::up(&connection, None).await?;

    Ok(connection)
}

// Database connection pool middleware for Actix-web
pub struct DatabasePool(pub DatabaseConnection);
