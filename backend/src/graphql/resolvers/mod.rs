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

/// Stable GraphQL codes at the existing project/member error boundary.
pub(crate) fn coded_error(message: impl Into<String>, code: &str) -> async_graphql::Error {
    use async_graphql::ErrorExtensions;
    async_graphql::Error::new(message).extend_with(|_, extensions| extensions.set("code", code))
}

/// Shared project-scoped authorization guards for the Increment 1 scheduling
/// resolvers (taxonomies, resource_members, schedule_projection).
/// Reuses the established project-role model verbatim — writes: project
/// owner OR `project_members` role in ('manager','leader','admin') (same
/// predicate as the member admin mutations); reads: project owner OR any
/// `project_members` row (same predicate as the `project` query resolver).
/// No bypasses: every guard runs before any project-scoped read/write.
pub mod project_authz {
    use super::coded_error;
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
                       WHERE pm.project_id = p.project_id AND pm.user_id = $2 \
                         AND pm.role IS NOT NULL\
                   )))";

    /// Authenticated caller id — the login gate for every mounted op.
    pub fn require_user(context: &GraphQLContext) -> Result<Uuid> {
        context
            .auth
            .as_ref()
            .and_then(|claims| claims.user_id().ok())
            .ok_or_else(|| {
                coded_error(
                    AuthError::Unauthorized("You must be logged in".into()).to_string(),
                    "UNAUTHENTICATED",
                )
            })
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
            return Err(coded_error(
                AuthError::Forbidden("You must be a manager of this project".into()).to_string(),
                "FORBIDDEN",
            ));
        }
        Ok(())
    }

    /// Touched writes lock the project BEFORE hierarchy/member/task rows.
    /// Recheck in a separate statement after waiting (READ COMMITTED snapshot),
    /// so a committed revocation cannot leave stale authorization behind.
    pub async fn require_project_write_tx(
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        user_id: Uuid,
        project_id: Uuid,
    ) -> Result<()> {
        sqlx::query("SELECT project_id FROM projects WHERE project_id = $1 FOR UPDATE")
            .bind(project_id)
            .fetch_optional(&mut **tx)
            .await
            .map_err(AuthError::Database)?;
        let allowed: bool = sqlx::query_scalar(PROJECT_WRITE_ROLE_SQL)
            .bind(project_id)
            .bind(user_id)
            .fetch_one(&mut **tx)
            .await
            .map_err(AuthError::Database)?;
        if !allowed {
            return Err(coded_error(
                AuthError::Forbidden("You must be a manager of this project".into()).to_string(),
                "FORBIDDEN",
            ));
        }
        Ok(())
    }

    /// Accepted access policy, shared by canonical and retained single/bulk
    /// mutations. Caller has already acquired the project write gate above.
    pub async fn require_access_target_tx(
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        caller: Uuid,
        project_id: Uuid,
        target: Uuid,
    ) -> Result<()> {
        let protected: bool = sqlx::query_scalar(
            "SELECT p.owner_id = $2 OR $2 = $3 OR EXISTS (\
             SELECT 1 FROM project_members pm WHERE pm.project_id = p.project_id \
             AND pm.user_id = $2 AND pm.role::text IN ('manager','leader','admin')) \
             FROM projects p WHERE p.project_id = $1",
        )
        .bind(project_id)
        .bind(target)
        .bind(caller)
        .fetch_one(&mut **tx)
        .await
        .map_err(AuthError::Database)?;
        if protected {
            return Err(coded_error(
                AuthError::Forbidden("Cannot change own, owner or privileged member access".into())
                    .to_string(),
                "FORBIDDEN",
            ));
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
            return Err(coded_error(
                AuthError::Forbidden("You don't have access to this project".into()).to_string(),
                "FORBIDDEN",
            ));
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
pub use tasks::{TaskMutation, TaskQuery};
pub use timesheet::{TimesheetMutation, TimesheetQuery};
pub use user::{UserMutation, UserQuery};
