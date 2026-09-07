use async_graphql::{Context, ErrorExtensions, Result, ID};
use serde_json::Value as JsonValue;
use sqlx::Row;
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::{Assignee, Task};

pub async fn tasks(
    ctx: &Context<'_>,
    project_id: Option<ID>,
    status: Option<String>,
    assignee_id: Option<ID>,
) -> Result<Vec<Task>> {
    let context = ctx.data::<GraphQLContext>()?;
    let pool = &context.db;

    let project_id = project_id
        .map(|id| Uuid::parse_str(&id.to_string()))
        .transpose()?;
    let assignee_id = assignee_id
        .map(|id| Uuid::parse_str(&id.to_string()))
        .transpose()?;

    let tasks = sqlx::query(
        r#"
        WITH RECURSIVE task_tree AS (
            SELECT t.*, 
                au.user_id as assignee_user_id,
                au.username as assignee_username,
                au.avatar_url as assignee_avatar_url,
                au.role::text as assignee_role,
                cu.user_id as creator_user_id,
                cu.username as creator_username,
                cu.avatar_url as creator_avatar_url,
                cu.role::text as creator_role
            FROM tasks t
            LEFT JOIN users au ON t.assignee_id = au.user_id
            LEFT JOIN users cu ON t.created_by = cu.user_id
            WHERE NOT t.is_deleted
            AND t.parent_task_id IS NULL
            AND ($1::uuid IS NULL OR t.project_id = $1)
            AND ($2::text IS NULL OR t.status::text = $2)
            AND ($3::uuid IS NULL OR t.assignee_id = $3)
            
            UNION ALL
            
            SELECT t.*, 
                au.user_id as assignee_user_id,
                au.username as assignee_username,
                au.avatar_url as assignee_avatar_url,
                au.role::text as assignee_role,
                cu.user_id as creator_user_id,
                cu.username as creator_username,
                cu.avatar_url as creator_avatar_url,
                cu.role::text as creator_role
            FROM tasks t
            LEFT JOIN users au ON t.assignee_id = au.user_id
            LEFT JOIN users cu ON t.created_by = cu.user_id
            INNER JOIN task_tree tt ON t.parent_task_id = tt.task_id
            WHERE NOT t.is_deleted
        )
        SELECT * FROM task_tree
        ORDER BY priority_order ASC
        "#,
    )
    .bind(project_id)
    .bind(status)
    .bind(assignee_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AuthError::Database(e))?;

    // Build the hierarchy from flat rows via the shared pure assembler
    // (domain::taxonomy::assemble_forest) so arbitrary depth materializes
    // correctly regardless of row order AND corrupt data (legacy parent
    // cycles, self-parents, orphans) can never panic the query: every row
    // surfaces exactly once, corrupt rows fall back to root (review P3).
    let mut rows: Vec<crate::domain::taxonomy::ForestRow<Task>> =
        Vec::with_capacity(tasks.len());
    for row in &tasks {
        let task = Task {
            task_id: row.get("task_id"),
            project_id: row.get("project_id"),
            assignee_resource_member_id: row.get("assignee_resource_member_id"),
            parent_task_id: row.get("parent_task_id"),
            phase_id: row.get("phase_id"),
            category_id: row.get("category_id"),
            title: row.get("title"),
            description: row.get("description"),
            assignee: row
                .get::<Option<Uuid>, _>("assignee_user_id")
                .map(|_| Assignee {
                    user_id: row.get("assignee_user_id"),
                    full_name: None,
                    username: row.get("assignee_username"),
                    avatar_url: row.get("assignee_avatar_url"),
                    role: row.get("assignee_role"),
                }),
            priority_order: row.get("priority_order"),
            start_date: row.get("start_date"),
            due_date: row.get("due_date"),
            actual_start_date: row.get("actual_start_date"),
            actual_end_date: row.get("actual_end_date"),
            effort: row.get("effort"),
            progress: row.get("progress"),
            created_by: row.get("created_by"),
            creator: row
                .get::<Option<Uuid>, _>("creator_user_id")
                .map(|_| Assignee {
                    user_id: row.get("creator_user_id"),
                    full_name: None,
                    username: row.get("creator_username"),
                    avatar_url: row.get("creator_avatar_url"),
                    role: row.get("creator_role"),
                }),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            is_deleted: row.get("is_deleted"),
            status: row.get("status"),
            priority: row.get("priority"),
            type_: row.get("type"),
            category: row.get("category"),
            progress_type: row.get("progress_type"),
            tags: row.get::<Option<JsonValue>, _>("tags"),
            child_tasks: Some(Vec::new()),
        };

        rows.push(crate::domain::taxonomy::ForestRow {
            task_id: row.get("task_id"),
            parent_task_id: row.get("parent_task_id"),
            payload: task,
        });
    }

    let forest = crate::domain::taxonomy::assemble_forest(rows);

    // Re-attach materialized children onto each GraphQL Task node.
    fn flatten(mut task: Task, children: Vec<Task>) -> Task {
        task.child_tasks = Some(children);
        task
    }
    fn attach(node: crate::domain::taxonomy::ForestTree<Task>) -> Task {
        let children = node.children.into_iter().map(attach).collect();
        flatten(node.payload, children)
    }

    // Roots only, in unchanged healthy order. Healthy fetched sets are
    // closed under parent (recursive CTE), so ordering is identical to the
    // previous assembler; corrupt rows surface as extra roots instead of
    // dropping/crashing.
    Ok(forest.into_iter().map(attach).collect())
}

fn tree_error(code: &'static str, message: &'static str) -> async_graphql::Error {
    async_graphql::Error::new(message).extend_with(|_, extensions| extensions.set("code", code))
}

/// Flat, authorized, active project tasks in stable parent-before-child order.
/// Corrupt parent links cannot duplicate or hide a row: orphan/cyclic groups
/// are appended deterministically after healthy roots.
pub async fn task_tree_rows(ctx: &Context<'_>, project_id: ID) -> Result<Vec<Task>> {
    let context = ctx.data::<GraphQLContext>()?;
    let project_id = Uuid::parse_str(&project_id.to_string())
        .map_err(|_| tree_error("BAD_USER_INPUT", "invalid project_id"))?;
    let caller_id = crate::graphql::resolvers::project_authz::require_user(context)
        .map_err(|_| tree_error("UNAUTHENTICATED", "authentication required"))?;
    crate::graphql::resolvers::project_authz::require_project_read(
        &context.db,
        caller_id,
        project_id,
    )
    .await
    .map_err(|_| tree_error("FORBIDDEN", "project access is required"))?;

    let rows = sqlx::query(
        r#"
        SELECT t.*,
               au.user_id AS assignee_user_id,
               au.username AS assignee_username,
               au.avatar_url AS assignee_avatar_url,
               au.role::text AS assignee_role,
               cu.user_id AS creator_user_id,
               cu.username AS creator_username,
               cu.avatar_url AS creator_avatar_url,
               cu.role::text AS creator_role
        FROM tasks t
        LEFT JOIN users au ON t.assignee_id = au.user_id
        LEFT JOIN users cu ON t.created_by = cu.user_id
        WHERE t.project_id = $1 AND NOT COALESCE(t.is_deleted, false)
        ORDER BY t.priority_order, t.created_at, t.task_id
        "#,
    )
    .bind(project_id)
    .fetch_all(&context.db)
    .await
    .map_err(|_| tree_error("INTERNAL_SERVER_ERROR", "could not load task tree"))?;

    let mut by_id = HashMap::with_capacity(rows.len());
    let mut ids = Vec::with_capacity(rows.len());
    let mut parents = HashMap::with_capacity(rows.len());
    for row in rows {
        let task_id: Uuid = row.get("task_id");
        if by_id.contains_key(&task_id) {
            continue;
        }
        let parent_task_id: Option<Uuid> = row.get("parent_task_id");
        let task = Task {
            task_id,
            project_id: row.get("project_id"),
            parent_task_id,
            title: row.get("title"),
            description: row.get("description"),
            assignee_resource_member_id: row.get("assignee_resource_member_id"),
            assignee: row.get::<Option<Uuid>, _>("assignee_user_id").map(|_| Assignee {
                user_id: row.get("assignee_user_id"),
                full_name: None,
                username: row.get("assignee_username"),
                avatar_url: row.get("assignee_avatar_url"),
                role: row.get("assignee_role"),
            }),
            priority_order: row.get("priority_order"),
            start_date: row.get("start_date"),
            due_date: row.get("due_date"),
            actual_start_date: row.get("actual_start_date"),
            actual_end_date: row.get("actual_end_date"),
            effort: row.get("effort"),
            progress: row.get("progress"),
            created_by: row.get("created_by"),
            creator: row.get::<Option<Uuid>, _>("creator_user_id").map(|_| Assignee {
                user_id: row.get("creator_user_id"),
                full_name: None,
                username: row.get("creator_username"),
                avatar_url: row.get("creator_avatar_url"),
                role: row.get("creator_role"),
            }),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            is_deleted: row.get("is_deleted"),
            status: row.get("status"),
            priority: row.get("priority"),
            type_: row.get("type"),
            category: row.get("category"),
            phase_id: row.get("phase_id"),
            category_id: row.get("category_id"),
            progress_type: row.get("progress_type"),
            tags: row.get::<Option<JsonValue>, _>("tags"),
            child_tasks: None,
        };
        ids.push(task_id);
        parents.insert(task_id, parent_task_id);
        by_id.insert(task_id, task);
    }

    let mut children_of: HashMap<Uuid, Vec<Uuid>> = HashMap::new();
    let mut roots = Vec::new();
    for task_id in &ids {
        match parents[task_id] {
            Some(parent) if parent != *task_id && by_id.contains_key(&parent) => {
                children_of.entry(parent).or_default().push(*task_id);
            }
            _ => roots.push(*task_id),
        }
    }

    let mut ordered = Vec::with_capacity(ids.len());
    let mut visited = HashSet::with_capacity(ids.len());
    let mut append_tree = |root: Uuid, ordered: &mut Vec<Task>, visited: &mut HashSet<Uuid>| {
        let mut stack = vec![root];
        while let Some(task_id) = stack.pop() {
            if !visited.insert(task_id) {
                continue;
            }
            if let Some(task) = by_id.get(&task_id) {
                ordered.push(task.clone());
            }
            if let Some(children) = children_of.get(&task_id) {
                stack.extend(children.iter().rev().copied());
            }
        }
    };
    for root in roots {
        append_tree(root, &mut ordered, &mut visited);
    }
    for task_id in ids {
        append_tree(task_id, &mut ordered, &mut visited);
    }

    Ok(ordered)
}
