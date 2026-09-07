use async_graphql::{Context, Result, ID};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::resolvers::{members::types::BulkRemoveResponse, project_authz};

pub async fn remove_multiple_members(
    ctx: &Context<'_>,
    project_id: ID,
    member_ids: Vec<ID>,
) -> Result<BulkRemoveResponse> {
    let context = ctx.data::<GraphQLContext>()?;
    let caller = project_authz::require_user(context)?;
    let project_id = Uuid::parse_str(&project_id)?;
    let mut tx = context.db.begin().await.map_err(AuthError::Database)?;
    project_authz::require_project_write_tx(&mut tx, caller, project_id).await?;
    let mut success_count = 0;
    let mut failed_count = 0;
    for member_id in member_ids {
        let member_id = Uuid::parse_str(&member_id)?;
        let user: Option<Option<Uuid>> = sqlx::query_scalar(
            "SELECT user_id FROM project_members WHERE member_id = $1 AND project_id = $2",
        )
        .bind(member_id)
        .bind(project_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
        if let Some(Some(user_id)) = user {
            project_authz::require_access_target_tx(&mut tx, caller, project_id, user_id).await?;
            let result = sqlx::query("UPDATE project_members SET role = NULL, updated_at = now() WHERE member_id = $1 AND project_id = $2 AND role IS NOT NULL")
                .bind(member_id).bind(project_id).execute(&mut *tx).await.map_err(AuthError::Database)?;
            if result.rows_affected() > 0 {
                success_count += 1;
            } else {
                failed_count += 1;
            }
        } else {
            failed_count += 1;
        }
    }
    tx.commit().await.map_err(AuthError::Database)?;
    Ok(BulkRemoveResponse {
        success_count,
        failed_count,
    })
}
