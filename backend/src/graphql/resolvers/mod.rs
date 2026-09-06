mod auth;
// mod comment; // Removed old comment module
mod project;
mod project_member;
mod user;
// mod task;
pub mod comments;
mod media_upload;
mod members;
mod notifications;
mod plans;
pub mod resource_members;
pub mod schedule_projection;
pub mod scheduling;
pub mod taxonomies;
pub mod timesheet;

/// Shared project-scoped authorization guards for the Increment 1 scheduling
/// resolvers (taxonomies, resource_members, schedule_projection).
/// Reuses the established project-role model verbatim — writes: project
/// owner OR `project_members` role in ('manager','leader','admin') (same
/// predicate as the member admin mutations); reads: project owner OR any
/// `project_members` row (same predicate as the `project` query resolver).
/// No bypasses: every guard runs before any project-scoped read/write.
pub mod project_authz {
    use async_graphql::Result;
    use sqlx::PgPool;
    use uuid::Uuid;

    use crate::auth::error::AuthError;
    use crate::graphql::context::Context as GraphQLContext;

    /// Write gate predicate: owner OR manager/leader/admin member.
    pub const PROJECT_WRITE_ROLE_SQL: &str = "\
        SELECT EXISTS (\
            SELECT 1 FROM projects p \
            WHERE p.project_id = $1 \
              AND (p.owner_id = $2 \
                   OR EXISTS (\
                       SELECT 1 FROM project_members pm \
                       WHERE pm.project_id = p.project_id \
                         AND pm.user_id = $2 \
                         AND pm.role::text IN ('manager', 'leader', 'admin')\
                   )))";

    /// Read gate predicate: owner OR any project member.
    pub const PROJECT_READ_MEMBER_SQL: &str = "\
        SELECT EXISTS (\
            SELECT 1 FROM projects p \
            WHERE p.project_id = $1 \
              AND (p.owner_id = $2 \
                   OR EXISTS (\
                       SELECT 1 FROM project_members pm \
                       WHERE pm.project_id = p.project_id AND pm.user_id = $2\
                   )))";

    /// Authenticated caller id — the login gate for every mounted op.
    pub fn require_user(context: &GraphQLContext) -> Result<Uuid> {
        context
            .auth
            .as_ref()
            .and_then(|claims| claims.user_id().ok())
            .ok_or_else(|| AuthError::Unauthorized("You must be logged in".into()).into())
    }

    /// Write authorization: caller must own or manage the project. Runs
    /// BEFORE any project-scoped write.
    pub async fn require_project_write(
        pool: &PgPool,
        user_id: Uuid,
        project_id: Uuid,
    ) -> Result<()> {
        let allowed: bool = sqlx::query_scalar(PROJECT_WRITE_ROLE_SQL)
            .bind(project_id)
            .bind(user_id)
            .fetch_one(pool)
            .await
            .map_err(AuthError::Database)?;
        if !allowed {
            return Err(AuthError::Forbidden(
                "You must be a manager of this project".into(),
            )
            .into());
        }
        Ok(())
    }

    /// Read authorization: caller must be owner or member of the project.
    /// Runs BEFORE any project-scoped read.
    pub async fn require_project_read(
        pool: &PgPool,
        user_id: Uuid,
        project_id: Uuid,
    ) -> Result<()> {
        let allowed: bool = sqlx::query_scalar(PROJECT_READ_MEMBER_SQL)
            .bind(project_id)
            .bind(user_id)
            .fetch_one(pool)
            .await
            .map_err(AuthError::Database)?;
        if !allowed {
            return Err(AuthError::Forbidden(
                "You don't have access to this project".into(),
            )
            .into());
        }
        Ok(())
    }
}
mod plan_lifecycle;
mod tasks;

pub use auth::AuthMutation;
// pub use comment::{CommentMutation, CommentQuery}; // Removed old comment exports
pub use comments::mutation::CommentMutation;
pub use comments::query::CommentQuery;
pub use media_upload::MediaUploadMutation;
pub use members::{MemberMutation, MemberQuery};
pub use notifications::{NotificationMutation, NotificationQuery};
pub use plan_lifecycle::{PlanLifecycleMutation, PlanLifecycleQuery};
pub use plans::{PlanMutation, PlanQuery};
pub use project::{ProjectMutation, ProjectQuery};
pub use project_member::{ProjectMemberMutation, ProjectMemberQuery};
pub use scheduling::{SchedulingMutation, SchedulingQuery};
pub use timesheet::{TimesheetMutation, TimesheetQuery};
pub use tasks::{TaskMutation, TaskQuery};
pub use user::{UserMutation, UserQuery};
