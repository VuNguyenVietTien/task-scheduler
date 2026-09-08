use async_graphql::{Context, Result, ID};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::resolvers::project_authz;

pub async fn remove_member(ctx: &Context<'_>, project_id: ID, user_id: ID) -> Result<bool> {
    let context = ctx.data::<GraphQLContext>()?;
    let (project_id, user_id) = (Uuid::parse_str(&project_id)?, Uuid::parse_str(&user_id)?);
    let caller = project_authz::require_user(context)?;
    let mut tx = context.db.begin().await.map_err(AuthError::Database)?;
    project_authz::require_project_write_tx(&mut tx, caller, project_id).await?;
    project_authz::require_member_removal_tx(&mut tx, caller, project_id, Some(user_id)).await?;
    // Revoke only access; retain identity, link, task assignment and configuration.
    let result = sqlx::query(
        "UPDATE project_members SET role = NULL, updated_at = now() \
         WHERE project_id = $1 AND user_id = $2 AND role IS NOT NULL",
    )
    .bind(project_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await
    .map_err(AuthError::Database)?;
    tx.commit().await.map_err(AuthError::Database)?;
    Ok(result.rows_affected() > 0)
}
