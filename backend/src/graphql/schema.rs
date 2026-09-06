use async_graphql::{EmptySubscription, MergedObject, Schema};
use sqlx::PgPool;

use crate::config::Config;
use crate::firebase::FirebaseService;
use crate::graphql::{
    dataloaders::{ProjectLoader, UserLoader},
    resolvers::{
        comments::CommentResponse, schedule_projection::ImportDryRunQuery,
        schedule_projection::ScheduleProjectionQuery, taxonomies::TaxonomyMutation,
        taxonomies::TaxonomyQuery, AuthMutation, CommentMutation, CommentQuery,
        MediaUploadMutation, MemberMutation, MemberQuery, NotificationMutation, NotificationQuery,
        PlanLifecycleMutation, PlanLifecycleQuery, PlanMutation, PlanQuery,
        ProjectMemberMutation, ProjectMemberQuery, ProjectMutation,
        ProjectQuery, resource_members::ResourceMemberMutation,
        resource_members::ResourceMemberQuery, SchedulingMutation, SchedulingQuery,
        TaskMutation, TaskQuery, TimesheetMutation, TimesheetQuery, UserMutation, UserQuery,
    },
    types::{MemberRole, ProjectPriority, ProjectStatus, ProjectVisibility},
};

#[derive(MergedObject, Default)]
pub struct Query(
    ProjectQuery,
    CommentQuery,
    UserQuery,
    ProjectMemberQuery,
    TaskQuery,
    MemberQuery,
    PlanQuery,
    NotificationQuery,
    TaxonomyQuery,
    ResourceMemberQuery,
    ScheduleProjectionQuery,
    ImportDryRunQuery,
    SchedulingQuery,
    TimesheetQuery,
    PlanLifecycleQuery,
);

#[derive(MergedObject, Default)]
pub struct Mutation(
    AuthMutation,
    ProjectMutation,
    CommentMutation,
    UserMutation,
    ProjectMemberMutation,
    TaskMutation,
    MemberMutation,
    MediaUploadMutation,
    PlanMutation,
    NotificationMutation,
    TaxonomyMutation,
    ResourceMemberMutation,
    SchedulingMutation,
    TimesheetMutation,
    PlanLifecycleMutation,
);

pub type AppSchema = Schema<Query, Mutation, EmptySubscription>;

pub fn create_schema(pool: PgPool, config: Config) -> AppSchema {
    let pool_ref = &pool;

    // Initialize Firebase service
    let firebase_service = FirebaseService::new("config/firebase-service-account.json".to_string())
        .expect("Failed to initialize Firebase service in GraphQL schema");

    Schema::build(Query::default(), Mutation::default(), EmptySubscription)
        .data(pool_ref.clone())
        .data(ProjectLoader::new(pool_ref.clone()))
        .data(UserLoader::new(pool_ref.clone()))
        .data(config)
        .data(firebase_service)
        .enable_federation()
        .finish()
}
