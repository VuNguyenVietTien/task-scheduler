use async_graphql::{Context, Result, ID};
use sqlx::Row;
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::resolvers::members::types::{
    BulkUpdateResponse, MemberRoleUpdate, ProjectMember,
};
use crate::graphql::resolvers::project_authz;

pub async fn update_multiple_members(
    ctx: &Context<'_>,
    project_id: ID,
    updates: Vec<MemberRoleUpdate>,
) -> Result<BulkUpdateResponse> {
    let context = ctx.data::<GraphQLContext>()?;
    let caller = project_authz::require_user(context)?;
    let project_id = Uuid::parse_str(&project_id)?;
    let mut tx = context.db.begin().await.map_err(AuthError::Database)?;
    project_authz::require_project_write_tx(&mut tx, caller, project_id).await?;
    let mut members = Vec::new();
    for update in updates {
        let user_id = Uuid::parse_str(&update.user_id)?;
        project_authz::require_access_target_tx(&mut tx, caller, project_id, user_id).await?;
        let row = sqlx::query(
            "WITH changed AS (UPDATE project_members SET role = $3, updated_at = now() \
             WHERE project_id = $1 AND user_id = $2 RETURNING *) \
             SELECT c.*, u.email, u.username, u.full_name, u.avatar_url FROM changed c JOIN users u ON u.user_id = c.user_id",
        )
        .bind(project_id).bind(user_id).bind(update.role).fetch_optional(&mut *tx).await.map_err(AuthError::Database)?;
        if let Some(row) = row {
            // Old resource-only identities can have no access-join timestamp.
            let joined_at = row
                .get::<Option<chrono::DateTime<chrono::Utc>>, _>("joined_at")
                .unwrap_or_else(chrono::Utc::now);
            let member = ProjectMember {
                member_id: row.get::<Uuid, _>("member_id").to_string(),
                project_id: project_id.to_string(),
                user_id: user_id.to_string(),
                role: update.role,
                joined_at,
                invited_by: row
                    .get::<Option<Uuid>, _>("invited_by")
                    .map(|id| id.to_string()),
                user: crate::graphql::resolvers::members::types::UserResponse {
                    id: user_id.to_string(),
                    email: row.get("email"),
                    username: row.get("username"),
                    full_name: row.get("full_name"),
                    avatar_url: row.get("avatar_url"),
                },
            };
            members.push(member);
        }
    }
    tx.commit().await.map_err(AuthError::Database)?;
    Ok(BulkUpdateResponse {
        success_count: members.len() as i32,
        members,
    })
}
