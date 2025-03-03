pub mod context;
pub mod dataloaders;
pub mod resolvers;
pub mod schema;
pub mod types;

pub use context::Context;
pub use schema::create_schema;

use sea_orm::DbErr;
use async_graphql::Error;

pub fn map_db_err(err: DbErr) -> Error {
    Error::new(format!("Database error: {}", err))
}
