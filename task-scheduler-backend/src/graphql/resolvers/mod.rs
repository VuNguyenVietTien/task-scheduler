pub mod project;
pub mod task;
pub mod project_member;
pub mod comment;
pub mod notification;
pub mod attachment;

use chrono::Utc;
use async_graphql::*;

pub mod mutation_utils {
    use chrono::{DateTime, Utc};
    use sea_orm::prelude::DateTimeWithTimeZone;

    pub fn current_time_db() -> DateTimeWithTimeZone {
        Utc::now().into()
    }
}

pub mod query_utils {
    use async_graphql::Guard;
    use std::ops::Deref;

    // Admin role guard
    pub struct AdminGuard;

    #[async_trait::async_trait]
    impl Guard for AdminGuard {
        async fn check(&self, _ctx: &async_graphql::Context<'_>) -> Result<(), async_graphql::Error> {
            Ok(())
        }
    }
}

#[derive(Default)]
pub struct QueryRoot {
    pub project: project::ProjectQuery,
    pub task: task::TaskQuery,
    pub project_member: project_member::ProjectMemberQuery,
}

#[Object]
impl QueryRoot {
    async fn current_time(&self) -> chrono::DateTime<Utc> {
        Utc::now()
    }
}

#[derive(Default)] 
pub struct MutationRoot {
    pub project: project::ProjectMutation,
    pub task: task::TaskMutation,
    pub project_member: project_member::ProjectMemberMutation,
}

#[Object]
impl MutationRoot {
    async fn current_time(&self) -> chrono::DateTime<Utc> {
        Utc::now()
    }
}

pub fn admin() -> query_utils::AdminGuard {
    query_utils::AdminGuard
}
