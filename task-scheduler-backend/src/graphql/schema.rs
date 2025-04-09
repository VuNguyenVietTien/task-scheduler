use async_graphql::{EmptySubscription, MergedObject, Schema};
use sqlx::PgPool;

use crate::graphql::{
    Context,
    resolvers::{
        AuthMutation,
        CommentMutation, CommentQuery,
        ProjectMutation, ProjectQuery,
        UserMutation, UserQuery,
        ProjectMemberMutation, ProjectMemberQuery,
        TaskMutation, TaskQuery,
        MemberMutation, MemberQuery,
        MediaUploadMutation,
        PlanMutation, PlanQuery,
        NotificationMutation, NotificationQuery,
        comments::CommentResponse,
    },
    dataloaders::{ProjectLoader, UserLoader},
    types::{ProjectPriority, ProjectStatus, ProjectVisibility, MemberRole},
};
use crate::config::Config;

#[derive(MergedObject, Default)]
pub struct Query(ProjectQuery, CommentQuery, UserQuery, ProjectMemberQuery, TaskQuery, MemberQuery, PlanQuery, NotificationQuery);

#[derive(MergedObject, Default)]
pub struct Mutation(AuthMutation, ProjectMutation, CommentMutation, UserMutation, ProjectMemberMutation, TaskMutation, MemberMutation, MediaUploadMutation, PlanMutation, NotificationMutation);

pub type AppSchema = Schema<Query, Mutation, EmptySubscription>;

pub fn create_schema(pool: PgPool, config: Config) -> AppSchema {
    let schema = Schema::build(
        Query::default(),
        Mutation::default(),
        EmptySubscription,
    )
    .data(Context::new(
        pool.clone(),
        None,
        ProjectLoader::new(pool.clone()),
        UserLoader::new(pool.clone()),
        config.clone(),
        None,
    ))
    .finish();

    schema
}
