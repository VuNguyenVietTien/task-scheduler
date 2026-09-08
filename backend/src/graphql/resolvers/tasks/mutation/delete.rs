use async_graphql::{Context, ID};
use sqlx::Row;
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::resolvers::project_authz;
use crate::graphql::types::DeleteTaskPayload;

pub async fn delete_task(
    ctx: &Context<'_>,
    task_id: ID,
) -> Result<DeleteTaskPayload, async_graphql::Error> {
    let context = ctx.data::<GraphQLContext>()?;
    let caller_id = project_authz::require_user(context)?;
    let task_id = Uuid::parse_str(&task_id.to_string())?;
    let mut tx = context.db.begin().await.map_err(AuthError::Database)?;

    let target = sqlx::query(
        "SELECT project_id FROM tasks \
         WHERE task_id = $1 AND NOT COALESCE(is_deleted, false)",
    )
    .bind(task_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(AuthError::Database)?
    .ok_or_else(|| async_graphql::Error::new("Task not found"))?;
    let project_id: Uuid = target.get("project_id");

    project_authz::require_project_write_tx(&mut tx, caller_id, project_id).await?;
    crate::domain::taxonomy::lock_project_hierarchy(&mut *tx, project_id).await?;

    sqlx::query(
        "SELECT task_id FROM tasks \
         WHERE task_id = $1 AND project_id = $2 AND NOT COALESCE(is_deleted, false) FOR UPDATE",
    )
    .bind(task_id)
    .bind(project_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(AuthError::Database)?
    .ok_or_else(|| async_graphql::Error::new("Task not found"))?;

    // Lock the full same-project subtree. Deleted descendants must be included
    // too: the self-FK still prevents removing their parent.
    let deleted_task_ids: Vec<Uuid> = sqlx::query_scalar(
        r#"
        WITH RECURSIVE task_tree(task_id) AS (
            SELECT task_id FROM tasks WHERE task_id = $1 AND project_id = $2
            UNION
            SELECT child.task_id
            FROM tasks child
            JOIN task_tree parent ON child.parent_task_id = parent.task_id
            WHERE child.project_id = $2
        )
        SELECT task.task_id
        FROM tasks task
        JOIN task_tree tree ON tree.task_id = task.task_id
        ORDER BY task.task_id
        FOR UPDATE OF task
        "#,
    )
    .bind(task_id)
    .bind(project_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(AuthError::Database)?;

    let has_cross_project_child: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM tasks WHERE parent_task_id = ANY($1) AND project_id <> $2)",
    )
    .bind(&deleted_task_ids)
    .bind(project_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(AuthError::Database)?;
    if has_cross_project_child {
        return Err(async_graphql::Error::new(
            "Task hierarchy contains a cross-project descendant",
        ));
    }

    // These links either do not cascade or are polymorphic. Preserve bugs and
    // activity history where the schema supports a NULL task reference.
    sqlx::query("DELETE FROM report_tasks WHERE task_id = ANY($1)")
        .bind(&deleted_task_ids)
        .execute(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
    sqlx::query("UPDATE bugs SET task_id = NULL WHERE task_id = ANY($1)")
        .bind(&deleted_task_ids)
        .execute(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
    sqlx::query("DELETE FROM attachments WHERE owner_id = ANY($1) AND lower(owner_type) = 'task'")
        .bind(&deleted_task_ids)
        .execute(&mut *tx)
        .await
        .map_err(AuthError::Database)?;
    sqlx::query(
        "DELETE FROM notifications WHERE reference_id = ANY($1) AND lower(reference_type) = 'task'",
    )
    .bind(&deleted_task_ids)
    .execute(&mut *tx)
    .await
    .map_err(AuthError::Database)?;

    let actually_deleted: Vec<Uuid> = sqlx::query_scalar(
        "DELETE FROM tasks WHERE task_id = ANY($1) AND project_id = $2 RETURNING task_id",
    )
    .bind(&deleted_task_ids)
    .bind(project_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(AuthError::Database)?;
    if actually_deleted.len() != deleted_task_ids.len() {
        return Err(async_graphql::Error::new(
            "Task hierarchy changed; retry deletion",
        ));
    }

    tx.commit().await.map_err(AuthError::Database)?;
    Ok(DeleteTaskPayload {
        project_id,
        deleted_task_ids,
    })
}
