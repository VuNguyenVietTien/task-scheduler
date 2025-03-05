use async_graphql::{EmptySubscription, MergedObject, Schema};

use crate::graphql::resolvers::{
    AuthMutation,
    CommentMutation, CommentQuery,
    ProjectMutation, ProjectQuery,
    UserMutation, UserQuery,
};

#[derive(MergedObject, Default)]
pub struct Query(ProjectQuery, CommentQuery, UserQuery);

#[derive(MergedObject, Default)]
pub struct Mutation(AuthMutation, ProjectMutation, CommentMutation, UserMutation);

pub type AppSchema = Schema<Query, Mutation, EmptySubscription>;

pub fn create_schema() -> AppSchema {
    Schema::build(Query::default(), Mutation::default(), EmptySubscription)
        .finish()
}
