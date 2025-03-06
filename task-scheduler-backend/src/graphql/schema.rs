use async_graphql::{EmptySubscription, MergedObject, Schema};
use sqlx::PgPool;

use crate::graphql::{
    resolvers::{
        AuthMutation,
        CommentMutation, CommentQuery,
        ProjectMutation, ProjectQuery,
        UserMutation, UserQuery,
        ProjectMemberMutation, ProjectMemberQuery,
    },
    Context,
    dataloaders::{ProjectLoader, UserLoader},
};
use crate::config::Config;

#[derive(MergedObject, Default)]
pub struct Query(ProjectQuery, CommentQuery, UserQuery, ProjectMemberQuery);

#[derive(MergedObject, Default)]
pub struct Mutation(AuthMutation, ProjectMutation, CommentMutation, UserMutation, ProjectMemberMutation);

pub type AppSchema = Schema<Query, Mutation, EmptySubscription>;

pub fn create_schema(pool: PgPool, config: Config) -> AppSchema {
    let context = Context::new(
        pool.clone(),
        None,
        ProjectLoader::new(pool.clone()),
        UserLoader::new(pool),
        config,
    );

    Schema::build(Query::default(), Mutation::default(), EmptySubscription)
        .data(context)
        .finish()
}
