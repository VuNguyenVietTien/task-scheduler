use async_graphql::{Context, Result, ID};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::MemberRole;

pub async fn my_project_role(ctx: &Context<'_>, project_id: ID) -> Result<Option<MemberRole>> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;

    let user_id = crate::graphql::resolvers::project_authz::require_user(context)?;
    let project_id = Uuid::parse_str(&project_id)?;

    // Tìm role của user trong project
    let role = sqlx::query(
        r#"
        SELECT
            pm.role::text AS role
        FROM project_members pm
        WHERE pm.project_id = $1 AND pm.user_id = $2 AND pm.role IS NOT NULL
        "#,
    )
    .bind(project_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AuthError::Database(e))?;

    role.as_ref().map(MemberRole::from_database_row).transpose()
}
