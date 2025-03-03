use async_graphql::*;

mod task;
mod project;
mod comment;
mod attachment;
mod notification;

pub use task::{TaskQuery, TaskMutation};
pub use project::{ProjectQuery, ProjectMutation};
pub use comment::{CommentQuery, CommentMutation}; 
pub use attachment::{AttachmentQuery, AttachmentMutation};
pub use notification::{NotificationQuery, NotificationMutation};

// Convenience re-exports for mutations
pub mod mutation_utils {
    use chrono::{DateTime, FixedOffset, Utc};

    pub fn current_time() -> DateTime<Utc> {
        Utc::now()
    }

    pub fn current_time_db() -> DateTime<FixedOffset> {
        Utc::now().into()
    }
}

pub mod guards {
    use async_graphql::*;
    use crate::auth::AuthUser;

    #[derive(Debug)]
    pub struct Auth;

    #[async_trait::async_trait]
    impl Guard for Auth {
        async fn check(&self, ctx: &Context<'_>) -> Result<()> {
            if ctx.data_opt::<AuthUser>().is_none() {
                return Err("Unauthorized".into());
            }
            Ok(())
        }
    }

    pub fn auth() -> Auth {
        Auth
    }

    #[derive(Debug)]
    pub struct AdminGuard;

    #[async_trait::async_trait]
    impl Guard for AdminGuard {
        async fn check(&self, ctx: &Context<'_>) -> Result<()> {
            let auth_user = ctx.data_opt::<AuthUser>()
                .ok_or_else(|| Error::new("Unauthorized"))?;

            if !auth_user.is_admin() {
                return Err("Admin access required".into());
            }
            Ok(())
        }
    }

    pub fn admin() -> AdminGuard {
        AdminGuard
    }
}

#[derive(MergedObject, Default)]
pub struct Query(
    TaskQuery,
    ProjectQuery,
    CommentQuery,
    AttachmentQuery,
    NotificationQuery,
);

#[derive(MergedObject, Default)]
pub struct Mutation(
    TaskMutation,
    ProjectMutation,
    CommentMutation,
    AttachmentMutation,
    NotificationMutation,
);
