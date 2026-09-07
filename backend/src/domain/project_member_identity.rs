//! Canonical project-member identity operations shared by member and task APIs.

use sqlx::{Postgres, Transaction};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Field<T> {
    Omitted,
    Null,
    Value(T),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TaskAssignment {
    pub resource_member_id: Uuid,
    pub user_id: Option<Uuid>,
}

#[derive(Debug, thiserror::Error)]
pub enum IdentityError {
    #[error("assignee does not belong to this project or is not a MEMBER")]
    InvalidAssignee,
    #[error("assignee user does not match the canonical member")]
    MismatchedAssignee,
}

/// Resolve the compatible dual-field task input to the one canonical member.
/// `None` means both assignment fields were omitted and callers must preserve
/// their stored values; `Some(None)` is an explicit clear.
pub async fn normalize_task_assignment(
    tx: &mut Transaction<'_, Postgres>,
    project_id: Uuid,
    resource: Field<Uuid>,
    user: Field<Uuid>,
) -> Result<Option<Option<TaskAssignment>>, IdentityError> {
    let resource_id = match resource {
        Field::Omitted => match user {
            Field::Omitted => return Ok(None),
            Field::Null => return Ok(Some(None)),
            Field::Value(user_id) => member_for_user(tx, project_id, user_id).await?,
        },
        Field::Null => match user {
            Field::Value(user_id) => member_for_user(tx, project_id, user_id).await?,
            Field::Null | Field::Omitted => return Ok(Some(None)),
        },
        Field::Value(resource_id) => resource_id,
    };

    let member: Option<(Uuid, Option<Uuid>, String)> = sqlx::query_as(
        "SELECT resource_member_id, user_id, member_kind FROM project_members \
         WHERE project_id = $1 AND resource_member_id = $2 FOR KEY SHARE",
    )
    .bind(project_id)
    .bind(resource_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(|_| IdentityError::InvalidAssignee)?;
    let Some((resource_member_id, linked_user_id, kind)) = member else {
        return Err(IdentityError::InvalidAssignee);
    };
    if kind != "MEMBER" {
        return Err(IdentityError::InvalidAssignee);
    }
    match user {
        Field::Value(user_id) if linked_user_id != Some(user_id) => {
            return Err(IdentityError::MismatchedAssignee)
        }
        Field::Null if linked_user_id.is_some() => return Err(IdentityError::MismatchedAssignee),
        _ => {}
    }
    Ok(Some(Some(TaskAssignment {
        resource_member_id,
        user_id: linked_user_id,
    })))
}

async fn member_for_user(
    tx: &mut Transaction<'_, Postgres>,
    project_id: Uuid,
    user_id: Uuid,
) -> Result<Uuid, IdentityError> {
    sqlx::query_scalar(
        "SELECT resource_member_id FROM project_members \
         WHERE project_id = $1 AND user_id = $2 AND member_kind = 'MEMBER' FOR KEY SHARE",
    )
    .bind(project_id)
    .bind(user_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(|_| IdentityError::InvalidAssignee)?
    .ok_or(IdentityError::InvalidAssignee)
}

pub fn normalized_email(email: &str) -> Option<String> {
    let trimmed = email.trim();
    (!trimmed.is_empty()).then(|| trimmed.to_ascii_lowercase())
}
