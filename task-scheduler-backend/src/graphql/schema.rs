use async_graphql::*;
use crate::graphql::resolvers::{QueryRoot, MutationRoot};

pub type Schema = async_graphql::Schema<QueryRoot, MutationRoot, EmptySubscription>;

pub fn create_schema() -> Schema {
    Schema::build(
        QueryRoot::default(), 
        MutationRoot::default(),
        EmptySubscription
    )
    .enable_federation()
    .finish()
}
