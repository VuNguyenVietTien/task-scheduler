use async_graphql::{EmptySubscription, MergedObject, Schema};
use sqlx::PgPool;
use crate::config::Config;
use crate::graphql::resolvers;

#[derive(MergedObject, Default)]
pub struct QueryRoot(
    resolvers::system::SystemQuery,
    resolvers::module::ModuleQuery,
    resolvers::document::DocumentQuery,
    resolvers::screen::ScreenQuery,
    resolvers::component::ComponentQuery,
    resolvers::flow::FlowQuery,
    resolvers::tag::TagQuery,
    resolvers::impact::ImpactQuery,
    resolvers::external_link::ExternalLinkQuery,
);

#[derive(MergedObject, Default)]
pub struct MutationRoot(
    resolvers::system::SystemMutation,
    resolvers::module::ModuleMutation,
    resolvers::document::DocumentMutation,
    resolvers::screen::ScreenMutation,
    resolvers::component::ComponentMutation,
    resolvers::flow::FlowMutation,
    resolvers::tag::TagMutation,
    resolvers::external_link::ExternalLinkMutation,
);

pub type AppSchema = Schema<QueryRoot, MutationRoot, EmptySubscription>;

pub fn create_schema(pool: PgPool, config: Config) -> AppSchema {
    Schema::build(QueryRoot::default(), MutationRoot::default(), EmptySubscription)
        .data(pool)
        .data(config)
        .finish()
}
