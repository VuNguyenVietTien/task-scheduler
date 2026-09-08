use async_graphql::{Context, ErrorExtensions, ID};
use chrono::{DateTime, Utc};
use serde_json::{json, Value as JsonValue};
use sqlx::{FromRow, Row};
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

use crate::domain::project_member_identity::{self, Field, TaskAssignment};
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::resolvers::project_authz;
use crate::graphql::types::{
    CloneTaskSubtreeInput, CloneTaskSubtreePayload, TaskPriority, TaskProgressType, TaskStatus,
};

#[derive(Debug, FromRow)]
struct SourceTask {
    task_id: Uuid,
    project_id: Uuid,
    parent_task_id: Option<Uuid>,
    title: String,
    description: Option<String>,
    assignee_id: Option<Uuid>,
    assignee_resource_member_id: Option<Uuid>,
    priority_order: i32,
    created_at: Option<DateTime<Utc>>,
    due_date: Option<DateTime<Utc>>,
    effort: Option<f64>,
    priority: TaskPriority,
    task_type: Option<String>,
    category: Option<String>,
    progress_type: Option<TaskProgressType>,
    progress_catalog_item_id: Option<Uuid>,
    category_catalog_item_id: Option<Uuid>,
    task_type_catalog_item_id: Option<Uuid>,
    tags: Option<JsonValue>,
}

fn clone_error(code: &'static str, message: &'static str) -> async_graphql::Error {
    async_graphql::Error::new(message).extend_with(|_, extensions| extensions.set("code", code))
}

fn parse_ids(input: &CloneTaskSubtreeInput) -> Result<Vec<Uuid>, async_graphql::Error> {
    let mut ids = Vec::with_capacity(input.selected_descendant_ids.len());
    let mut seen = HashSet::with_capacity(input.selected_descendant_ids.len());
    let source_id = Uuid::parse_str(&input.source_task_id.to_string())
        .map_err(|_| clone_error("BAD_USER_INPUT", "invalid source_task_id"))?;
    for raw in &input.selected_descendant_ids {
        let id = Uuid::parse_str(&raw.to_string())
            .map_err(|_| clone_error("BAD_USER_INPUT", "invalid selected descendant id"))?;
        if id == source_id || !seen.insert(id) {
            return Err(clone_error(
                "BAD_USER_INPUT",
                "invalid descendant selection",
            ));
        }
        ids.push(id);
    }
    Ok(ids)
}

fn assignment_fields(source: &SourceTask) -> (Field<Uuid>, Field<Uuid>) {
    match (source.assignee_resource_member_id, source.assignee_id) {
        (Some(resource_id), _) => (Field::Value(resource_id), Field::Omitted),
        (None, Some(user_id)) => (Field::Omitted, Field::Value(user_id)),
        (None, None) => (Field::Omitted, Field::Omitted),
    }
}

/// Atomically clone one selected active source tree `quantity` times.
/// Validation, assignment normalization, every insert, and result reconciliation
/// share this transaction, so a failed copy can never leave a partial tree.
pub async fn clone_task_subtree(
    ctx: &Context<'_>,
    input: CloneTaskSubtreeInput,
) -> Result<CloneTaskSubtreePayload, async_graphql::Error> {
    if input.quantity < 1 {
        return Err(clone_error("BAD_USER_INPUT", "quantity must be at least 1"));
    }

    let context = ctx.data::<GraphQLContext>()?;
    let caller_id = project_authz::require_user(context)
        .map_err(|_| clone_error("UNAUTHENTICATED", "authentication required"))?;
    let source_id = Uuid::parse_str(&input.source_task_id.to_string())
        .map_err(|_| clone_error("BAD_USER_INPUT", "invalid source_task_id"))?;
    let selected_descendants = parse_ids(&input)?;
    let clone_without_parent = input.clone_without_parent.unwrap_or(false);
    if clone_without_parent && input.destination_parent_task_id.is_some() {
        return Err(clone_error(
            "BAD_USER_INPUT",
            "choose exactly one clone destination",
        ));
    }
    let destination_parent_id = input
        .destination_parent_task_id
        .as_ref()
        .map(|id| Uuid::parse_str(&id.to_string()))
        .transpose()
        .map_err(|_| clone_error("BAD_USER_INPUT", "invalid destination_parent_task_id"))?;
    let orphan_mode = clone_without_parent || destination_parent_id.is_some();
    if orphan_mode && selected_descendants.is_empty() {
        return Err(clone_error(
            "BAD_USER_INPUT",
            "select at least one child task",
        ));
    }
    let mut tx = context
        .db
        .begin()
        .await
        .map_err(|_| clone_error("INTERNAL_SERVER_ERROR", "could not start clone"))?;

    // Discover scope without row locks; project authorization/lock precedes
    // hierarchy and task locks. Revalidate the root after waiting below.
    let root_project: Option<(Uuid, Option<Uuid>)> = sqlx::query_as(
        "SELECT project_id, parent_task_id FROM tasks \
         WHERE task_id = $1 AND NOT COALESCE(is_deleted, false)",
    )
    .bind(source_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| clone_error("INTERNAL_SERVER_ERROR", "could not load source task"))?;
    let Some((project_id, root_parent_id)) = root_project else {
        return Err(clone_error("NOT_FOUND", "source task not found"));
    };
    project_authz::require_project_write_tx(&mut tx, caller_id, project_id)
        .await
        .map_err(|_| clone_error("FORBIDDEN", "project write access is required"))?;
    crate::domain::taxonomy::lock_project_hierarchy(&mut *tx, project_id)
        .await
        .map_err(|_| clone_error("INTERNAL_SERVER_ERROR", "could not lock task hierarchy"))?;

    // UNION (not UNION ALL) makes corrupt cycles finite; locking resolved task
    // rows prevents a selected node from moving during validation/insertion.
    let source_rows: Vec<SourceTask> = sqlx::query_as(
        r#"
        WITH RECURSIVE source_tree(task_id) AS (
            SELECT task_id
            FROM tasks
            WHERE task_id = $1 AND NOT COALESCE(is_deleted, false)
            UNION
            SELECT child.task_id
            FROM tasks child
            JOIN source_tree parent ON child.parent_task_id = parent.task_id
            WHERE NOT COALESCE(child.is_deleted, false)
        )
        SELECT t.task_id, t.project_id, t.parent_task_id, t.title, t.description,
               t.assignee_id, t.assignee_resource_member_id, t.priority_order,
               t.created_at, t.due_date, t.effort, t.priority, t.type AS task_type,
               t.category, t.progress_type, t.progress_catalog_item_id,
               t.category_catalog_item_id, t.task_type_catalog_item_id, t.tags
        FROM tasks t
        JOIN source_tree st ON st.task_id = t.task_id
        FOR UPDATE OF t
        "#,
    )
    .bind(source_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|_| clone_error("INTERNAL_SERVER_ERROR", "could not lock source tree"))?;
    if source_rows.is_empty() {
        return Err(clone_error("NOT_FOUND", "source task not found"));
    }

    let source_by_id: HashMap<Uuid, &SourceTask> =
        source_rows.iter().map(|row| (row.task_id, row)).collect();
    let root = source_by_id
        .get(&source_id)
        .ok_or_else(|| clone_error("CONFLICT", "source hierarchy changed"))?;
    if root.project_id != project_id || root.parent_task_id != root_parent_id {
        return Err(clone_error("CONFLICT", "source hierarchy changed"));
    }
    if source_rows.iter().any(|row| row.project_id != project_id) {
        return Err(clone_error("CONFLICT", "source hierarchy is invalid"));
    }
    if let Some(parent_id) = destination_parent_id {
        if source_by_id.contains_key(&parent_id) {
            return Err(clone_error(
                "BAD_USER_INPUT",
                "destination parent would create a cycle",
            ));
        }
        let destination_project: Option<Uuid> = sqlx::query_scalar(
            "SELECT project_id FROM tasks WHERE task_id = $1 \
             AND NOT COALESCE(is_deleted, false) FOR KEY SHARE",
        )
        .bind(parent_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|_| {
            clone_error(
                "INTERNAL_SERVER_ERROR",
                "could not validate destination parent",
            )
        })?;
        if destination_project != Some(project_id) {
            return Err(clone_error(
                "BAD_USER_INPUT",
                "destination parent must be an active task in the same project",
            ));
        }
    }
    if let Some(parent_id) = root.parent_task_id {
        if source_by_id.contains_key(&parent_id) {
            return Err(clone_error("CONFLICT", "source hierarchy contains a cycle"));
        }
        let parent_project: Option<Uuid> = sqlx::query_scalar(
            "SELECT project_id FROM tasks \
             WHERE task_id = $1 AND NOT COALESCE(is_deleted, false) FOR KEY SHARE",
        )
        .bind(parent_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|_| clone_error("INTERNAL_SERVER_ERROR", "could not validate source parent"))?;
        if parent_project != Some(project_id) {
            return Err(clone_error("CONFLICT", "source parent is unavailable"));
        }
    }

    // Every subtree row must trace back to this root. A broken/cyclic path is
    // a conflict rather than a chance to promote nodes into a new tree.
    for row in &source_rows {
        if row.task_id == source_id {
            continue;
        }
        let mut cursor = row.task_id;
        for _ in 0..source_rows.len() {
            let parent_id = source_by_id
                .get(&cursor)
                .and_then(|task| task.parent_task_id)
                .ok_or_else(|| clone_error("CONFLICT", "source hierarchy is invalid"))?;
            if parent_id == source_id {
                break;
            }
            if !source_by_id.contains_key(&parent_id) {
                return Err(clone_error("CONFLICT", "source hierarchy is invalid"));
            }
            cursor = parent_id;
        }
        if cursor != source_id
            && source_by_id
                .get(&cursor)
                .and_then(|task| task.parent_task_id)
                != Some(source_id)
        {
            return Err(clone_error("CONFLICT", "source hierarchy contains a cycle"));
        }
    }

    let mut selected: HashSet<Uuid> = selected_descendants.iter().copied().collect();
    if !orphan_mode {
        selected.insert(source_id);
    }
    for descendant_id in &selected_descendants {
        if !source_by_id.contains_key(descendant_id) {
            return Err(clone_error(
                "BAD_USER_INPUT",
                "selected task is not a source descendant",
            ));
        }
        let mut cursor = *descendant_id;
        for _ in 0..source_rows.len() {
            let parent_id = source_by_id
                .get(&cursor)
                .and_then(|task| task.parent_task_id)
                .ok_or_else(|| clone_error("CONFLICT", "source hierarchy is invalid"))?;
            if parent_id == source_id {
                break;
            }
            if !selected.contains(&parent_id) {
                return Err(clone_error(
                    "BAD_USER_INPUT",
                    "selected descendants must include ancestors",
                ));
            }
            cursor = parent_id;
        }
        if cursor != source_id
            && source_by_id
                .get(&cursor)
                .and_then(|task| task.parent_task_id)
                != Some(source_id)
        {
            return Err(clone_error("CONFLICT", "source hierarchy contains a cycle"));
        }
    }

    let mut children_of: HashMap<Uuid, Vec<Uuid>> = HashMap::new();
    let mut selected_roots = Vec::new();
    for task_id in &selected {
        if *task_id == source_id {
            continue;
        }
        let parent_id = source_by_id[task_id]
            .parent_task_id
            .ok_or_else(|| clone_error("CONFLICT", "source hierarchy is invalid"))?;
        if orphan_mode && parent_id == source_id {
            selected_roots.push(*task_id);
            continue;
        }
        if !selected.contains(&parent_id) {
            return Err(clone_error(
                "BAD_USER_INPUT",
                "selected descendants must include ancestors",
            ));
        }
        children_of.entry(parent_id).or_default().push(*task_id);
    }
    for children in children_of.values_mut() {
        children.sort_by_key(|id| {
            let source = source_by_id[id];
            (source.priority_order, source.created_at, source.task_id)
        });
    }
    selected_roots.sort_by_key(|id| {
        let source = source_by_id[id];
        (source.priority_order, source.created_at, source.task_id)
    });
    if orphan_mode && selected_roots.is_empty() {
        return Err(clone_error(
            "BAD_USER_INPUT",
            "selected child roots must include their ancestors",
        ));
    }
    let mut source_order = if orphan_mode {
        selected_roots.clone()
    } else {
        vec![source_id]
    };
    let mut next = 0;
    while next < source_order.len() {
        if let Some(children) = children_of.get(&source_order[next]) {
            source_order.extend(children.iter().copied());
        }
        next += 1;
    }
    if source_order.len() != selected.len() {
        return Err(clone_error("CONFLICT", "source hierarchy contains a cycle"));
    }

    // Normalize every copied source assignment once before the first insert.
    let mut assignments: HashMap<Uuid, Option<TaskAssignment>> = HashMap::new();
    for task_id in &source_order {
        let source = source_by_id[task_id];
        let (resource, user) = assignment_fields(source);
        let assignment = match project_member_identity::normalize_task_assignment(
            &mut tx, project_id, resource, user,
        )
        .await
        .map_err(|_| clone_error("CONFLICT", "source assignment is no longer valid"))?
        {
            Some(Some(value)) => Some(value),
            Some(None) | None => None,
        };
        assignments.insert(*task_id, assignment);
    }

    let expected_count = (input.quantity as usize)
        .checked_mul(source_order.len())
        .ok_or_else(|| clone_error("INTERNAL_SERVER_ERROR", "clone result is too large"))?;
    let root_count = if orphan_mode { selected_roots.len() } else { 1 };
    let expected_root_count = (input.quantity as usize)
        .checked_mul(root_count)
        .ok_or_else(|| clone_error("INTERNAL_SERVER_ERROR", "clone result is too large"))?;
    let selected_root_set: HashSet<Uuid> = selected_roots.into_iter().collect();
    let mut root_task_ids = Vec::with_capacity(expected_root_count);
    let mut created_task_ids = Vec::with_capacity(expected_count);
    for _ in 0..input.quantity {
        let mut id_map = HashMap::with_capacity(source_order.len());
        for task_id in &source_order {
            let source = source_by_id[task_id];
            let cloned_id = Uuid::new_v4();
            let is_copy_root = if orphan_mode {
                selected_root_set.contains(task_id)
            } else {
                *task_id == source_id
            };
            let parent_task_id = if is_copy_root {
                if orphan_mode {
                    destination_parent_id
                } else {
                    source.parent_task_id
                }
            } else {
                let parent = source
                    .parent_task_id
                    .and_then(|parent_id| id_map.get(&parent_id).copied())
                    .ok_or_else(|| clone_error("CONFLICT", "source hierarchy changed"))?;
                Some(parent)
            };
            let assignment = assignments[task_id];
            let now = Utc::now();
            let insert = sqlx::query(
                r#"
                INSERT INTO tasks (
                    task_id, project_id, parent_task_id, title, description,
                    assignee_id, assignee_resource_member_id, priority_order,
                    start_date, due_date, actual_start_date, actual_end_date,
                    effort, progress, created_by, created_at, updated_at,
                    is_deleted, status, priority, type, category, tags,
                    progress_type, phase_id, category_id,
                    source_system, external_id, source_metadata, wbs_group_id,
                    progress_catalog_item_id, category_catalog_item_id, task_type_catalog_item_id
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                    $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
                    $24, $25, $26, $27, $28, $29, $30, $31, $32, $33
                )
                "#,
            )
            .bind(cloned_id)
            .bind(project_id)
            .bind(parent_task_id)
            .bind(format!("{} (copy)", source.title))
            .bind(&source.description)
            .bind(assignment.and_then(|value| value.user_id))
            .bind(assignment.map(|value| value.resource_member_id))
            .bind(source.priority_order)
            .bind(None::<DateTime<Utc>>)
            .bind(source.due_date)
            .bind(None::<DateTime<Utc>>)
            .bind(None::<DateTime<Utc>>)
            .bind(source.effort.unwrap_or(0.0))
            .bind(0.0_f64)
            .bind(caller_id)
            .bind(now)
            .bind(now)
            .bind(false)
            .bind(TaskStatus::Todo)
            .bind(source.priority)
            .bind(&source.task_type)
            .bind(&source.category)
            .bind(source.tags.clone().unwrap_or_else(|| json!([])))
            .bind(source.progress_type)
            .bind(None::<Uuid>)
            .bind(None::<Uuid>)
            .bind(None::<String>)
            .bind(None::<String>)
            .bind(None::<JsonValue>)
            .bind(None::<Uuid>)
            .bind(source.progress_catalog_item_id)
            .bind(source.category_catalog_item_id)
            .bind(source.task_type_catalog_item_id)
            .execute(&mut *tx)
            .await
            .map_err(|_| clone_error("INTERNAL_SERVER_ERROR", "could not clone task tree"))?;
            if insert.rows_affected() != 1 {
                return Err(clone_error(
                    "INTERNAL_SERVER_ERROR",
                    "could not clone task tree",
                ));
            }
            id_map.insert(*task_id, cloned_id);
            created_task_ids.push(ID::from(cloned_id));
            if is_copy_root {
                root_task_ids.push(ID::from(cloned_id));
            }
        }
    }
    if root_task_ids.len() != expected_root_count || created_task_ids.len() != expected_count {
        return Err(clone_error(
            "INTERNAL_SERVER_ERROR",
            "clone result mismatch",
        ));
    }
    tx.commit()
        .await
        .map_err(|_| clone_error("INTERNAL_SERVER_ERROR", "could not complete clone"))?;

    Ok(CloneTaskSubtreePayload {
        root_task_ids,
        created_task_ids,
    })
}
