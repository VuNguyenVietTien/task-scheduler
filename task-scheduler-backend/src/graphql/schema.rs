use async_graphql::*;
use sea_orm::DatabaseConnection;
use std::sync::Arc;
use crate::error::AppError;

use crate::graphql::{
    resolvers::{Query, Mutation},
    context::GraphQLContext, 
    dataloaders::Loaders,
};

pub type Schema = async_graphql::Schema<Query, Mutation, EmptySubscription>;

/// Create a new GraphQL schema builder with proper configuration
pub fn create_schema(db: Arc<DatabaseConnection>) -> Schema {
    let loaders = Loaders::new(db.clone());
    let context = GraphQLContext::new(db.clone(), None);

    Schema::build(Query::default(), Mutation::default(), EmptySubscription)
        .data(db)
        .data(loaders)
        .data(context)
        .enable_subscription_in_federation()
        .limit_depth(15)
        .limit_complexity(250)
        .finish()
}

// Helpers

/// Map database errors to GraphQL errors
pub fn map_db_err(err: sea_orm::DbErr) -> Error {
    AppError::Database(err).to_graphql_error()
}
