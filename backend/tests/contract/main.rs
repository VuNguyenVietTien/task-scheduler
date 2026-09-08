//! Phase 0+1 contract test: locks the GraphQL naming/enum/shape surface.
//! Covers Sol review C1–C4: snake_case root operation names (no camelCase leaks),
//! `type_` + `type` aliases scoped inside `type Task` / `type Notification`,
//! input `type_` pins, plans dual aliases, ReorderTasksInput shape,
//! `update_task_effort` mount, `delete_comment(id:)`, enum casing.
//!
//! Run: `cargo test --test contract` (regenerates schema.graphql each run).

use async_graphql::{EmptySubscription, Schema};
use std::path::PathBuf;
use task_scheduler_backend::graphql::schema::{Mutation, Query};

fn sdl() -> String {
    let schema = Schema::build(Query::default(), Mutation::default(), EmptySubscription).finish();
    schema.sdl()
}

/// Extract one `type X { ... }` block from the SDL.
fn type_block(sdl: &str, name: &str) -> String {
    let header = format!("type {name} {{");
    let start = sdl
        .find(&header)
        .unwrap_or_else(|| panic!("type {name} not found in SDL"));
    let end = sdl[start..]
        .find("\n}\n")
        .map(|i| start + i + 2)
        .unwrap_or(sdl.len());
    sdl[start..end].to_string()
}

#[test]
fn regenerates_schema_dot_graphql() {
    let sdl = sdl();
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("schema.graphql");
    std::fs::write(&path, &sdl).expect("failed to write backend/schema.graphql");
}

#[test]
fn snake_case_root_operation_names() {
    let sdl = sdl();
    for op in [
        "task(",  // exact fn `task` (word boundary via paren)
        "tasks(", // asserted with args below too
        "task_tree_rows(",
        "task_subtasks(",
        "task_comments(",
        "project_members(",
        "my_project_role(",
        "get_project_plans(",
        "get_latest_project_plan(",
        "get_plan(",
        "notification_count:",
        "notifications(",
        "create_task(input:",
        "clone_task_subtree(input:",
        "update_task(input:",
        "update_task_status(input:",
        "update_task_effort(input:",
        "delete_task(",
        "reorder_tasks(input:",
        "create_comment(input:",
        "delete_comment(id:",
        "create_project(input:",
        "update_project(project_id:",
        "mark_notification_as_read(",
        "mark_all_notifications_as_read:",
        "upload_image(",
    ] {
        assert!(sdl.contains(op), "snake_case op `{op}` missing:\n{sdl}");
    }
    // tasks() arg names
    assert!(
        sdl.contains("tasks(project_id:")
            || (sdl.contains("tasks(") && sdl.contains("project_id: UUID")),
        "tasks(project_id: ...) snake_case args missing"
    );
}

#[test]
fn no_camel_case_operation_leaks() {
    let sdl = sdl();
    for bad in [
        "createTask(",
        "updateTask(",
        "updateTaskStatus(",
        "updateTaskEffort(",
        "deleteTask(",
        "reorderTasks(",
        "taskSubtasks(",
        "taskComments(",
        "projectMembers(",
        "myProjectRole(",
        "getProjectPlans(",
        "getLatestProjectPlan(",
        "getPlan(",
        "notificationCount(",
        "markNotificationAsRead(",
        "markAllNotificationsAsRead(",
        "createComment(",
        "deleteComment(",
        "createProject(",
        "uploadImage(",
        "deleteImage(",
        "registerFcmToken(",
        "updateProfile(",
    ] {
        assert!(!sdl.contains(bad), "camelCase op `{bad}` leaked:\n{sdl}");
    }
    // camelCase field/arg leaks
    assert!(!sdl.contains("taskId"), "camelCase taskId leaked");
    assert!(!sdl.contains("projectId:"), "camelCase projectId leaked");
    assert!(!sdl.contains("authorId"), "camelCase authorId leaked");
}

#[test]
fn type_aliases_scoped_to_task_and_notification_blocks() {
    let sdl = sdl();
    // D4: both `type_` and `type` exist INSIDE Task and Notification blocks (C2/C4)
    for name in ["Task", "Notification"] {
        let block = type_block(&sdl, name);
        assert!(
            block.contains("\ttype_:"),
            "`type_` missing inside type {name}:\n{block}"
        );
        assert!(
            block.contains("\ttype:"),
            "`type` alias missing inside type {name} (ComplexObject dropped — needs #[graphql(complex)]):\n{block}"
        );
    }
}

#[test]
fn input_type_underscore_pins() {
    let sdl = sdl();
    for input in [
        "CreateTaskInput",
        "UpdateTaskInput",
        "CreateNotificationInput",
    ] {
        let start = sdl
            .find(&format!("input {input} {{"))
            .unwrap_or_else(|| panic!("input {input} missing"));
        let body = &sdl[start..start + 400];
        assert!(
            body.contains("type_:"),
            "{input}.type_ not pinned (exposes `type` instead):\n{body}"
        );
        assert!(
            !body.contains("\ttype:"),
            "{input} exposes stray `type` field:\n{body}"
        );
    }
    // Task/Notification SimpleObjects keep the pin too
    let task_block = type_block(&sdl, "Task");
    assert!(task_block.contains("\ttype_:"), "Task.type_ pin lost");
}

#[test]
fn enum_casing_matches_frontend() {
    let sdl = sdl();
    for v in ["TODO", "DOING", "DONE", "REVIEW", "BLOCKED", "ARCHIVED"] {
        assert!(sdl.contains(v), "TaskStatus value {v} missing");
    }
    for v in ["LOW", "MEDIUM", "HIGH", "URGENT", "CRITICAL"] {
        assert!(sdl.contains(v), "TaskPriority value {v} missing");
    }
    assert!(
        sdl.contains("review_code"),
        "TaskProgressType lowercase value missing"
    );
    assert!(sdl.contains("leader"), "MemberRole lowercase value missing");
}

#[test]
fn plans_mutations_dual_aliases() {
    let sdl = sdl();
    // D2: frontend camelCase + web-SDL snake_case both exposed (PlanMutation intentionally exempt from rename)
    for camel in [
        "createPlan(",
        "updatePlan(",
        "deletePlan(",
        "setPlanActive(",
    ] {
        assert!(
            sdl.contains(camel),
            "{camel} missing (frontend surface):\n{sdl}"
        );
    }
    for snake in [
        "create_plan(",
        "update_plan(",
        "delete_plan(",
        "set_plan_active(",
    ] {
        assert!(
            sdl.contains(snake),
            "{snake} alias missing (web-SDL surface):\n{sdl}"
        );
    }
}

#[test]
fn clone_tree_contract_is_additive_and_non_nullable() {
    let sdl = sdl();
    let input_start = sdl
        .find("input CloneTaskSubtreeInput {")
        .expect("CloneTaskSubtreeInput missing");
    let input = &sdl[input_start..input_start + 220];
    for field in [
        "source_task_id: ID!",
        "selected_descendant_ids: [ID!]!",
        "quantity: Int!",
    ] {
        assert!(input.contains(field), "{field} missing:\n{input}");
    }
    let payload_start = sdl
        .find("type CloneTaskSubtreePayload {")
        .expect("CloneTaskSubtreePayload missing");
    let payload = &sdl[payload_start..payload_start + 180];
    for field in ["root_task_ids: [ID!]!", "created_task_ids: [ID!]!"] {
        assert!(payload.contains(field), "{field} missing:\n{payload}");
    }
    let query = type_block(&sdl, "Query");
    assert!(
        query.contains("task_tree_rows(project_id: ID!): [Task!]!"),
        "task_tree_rows must be an authenticated flat non-null Task list:\n{query}"
    );
    let mutation = type_block(&sdl, "Mutation");
    assert!(
        mutation.contains(
            "clone_task_subtree(input: CloneTaskSubtreeInput!): CloneTaskSubtreePayload!"
        ),
        "clone_task_subtree mount/nullability changed:\n{mutation}"
    );
}

#[test]
fn reorder_input_shape_matches_frontend() {
    let sdl = sdl();
    let start = sdl
        .find("input ReorderTasksInput")
        .expect("ReorderTasksInput missing");
    let body = &sdl[start..start + 300];
    assert!(
        body.contains("expected_order: [ID!]\n"),
        "optional optimistic reorder contract missing: {body}"
    );
    assert!(
        body.contains("project_id:"),
        "ReorderTasksInput.project_id missing:\n{body}"
    );
    assert!(
        body.contains("tasks:"),
        "ReorderTasksInput.tasks missing:\n{body}"
    );
    assert!(
        !body.contains("task_orders"),
        "stale task_orders field present:\n{body}"
    );
}

#[test]
fn assignee_full_name_and_comment_user_fields() {
    let sdl = sdl();
    assert!(sdl.contains("full_name:"), "Assignee.full_name missing");
    assert!(
        sdl.contains("avatar_url:"),
        "avatar_url missing on Assignee/Comment"
    );
}

mod increment1_graphql;
