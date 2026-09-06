//! Increment 1 GraphQL contract tests (task 1.3) — SDL surface locks for
//! taxonomy reads/writes, task phase/category assignment, resource members,
//! import dry-run manifest, and `projectScheduleProjection` with
//! `source: CURRENT_TASK_FIELDS`; plus PURE projection invariants:
//! rollups once per real task, exact phase order + explicit Unphased,
//! legacy float effort as normalized display decimal string, headings as a
//! DISTINCT row type with no task identity, and no schedule-engine dependency.
//!
//! Run: `cargo test --test contract` (this module is mounted from main.rs,
//! same convention as tests/platform/main.rs → migration_evidence).

use async_graphql::{EmptySubscription, Schema};
use std::collections::HashMap;
use task_scheduler_backend::domain::taxonomy::{assemble_forest, ForestRow};
use task_scheduler_backend::graphql::resolvers::schedule_projection::projection::{
    build_projection, HeadingRow, PhaseOrderRow, TaskFieldRow,
};
use task_scheduler_backend::graphql::schema::{Mutation, Query};
use uuid::Uuid;

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

/* ------------------------------ SDL surface ------------------------------ */

#[test]
fn sdl_taxonomy_reads_and_writes() {
    let sdl = sdl();
    for op in [
        "project_phases(project_id:",
        "ensure_default_phases(project_id:",
        "create_project_phase(input:",
        "update_project_phase_translations(input:",
        "archive_project_phase(project_id:",
        "set_task_taxonomy(task_id:",
    ] {
        assert!(sdl.contains(op), "taxonomy op `{op}` missing:\n{sdl}");
    }
    assert!(
        sdl.contains("projectPhaseKeyOrder") || sdl.contains("phase_key:"),
        "phase_key field missing (seed keys must be queryable)"
    );
}

#[test]
fn sdl_task_taxonomy_assignment_contract() {
    let sdl = sdl();
    let start = sdl.find("set_task_taxonomy(").expect("set_task_taxonomy missing");
    let body = &sdl[start..start + 220];
    assert!(body.contains("task_id:"), "task_id arg missing:\n{body}");
    assert!(body.contains("phase_id:"), "phase_id arg missing:\n{body}");
    assert!(body.contains("category_id:"), "category_id arg missing:\n{body}");
}

#[test]
fn sdl_resource_member_reads_and_writes() {
    let sdl = sdl();
    for op in [
        "resource_members(project_id:",
        "resource_member(resource_member_id:",
        "create_resource_member(input:",
        "link_resource_member_user(",
        "classify_resource_member(",
    ] {
        assert!(sdl.contains(op), "resource member op `{op}` missing:\n{sdl}");
    }
    assert!(
        sdl.contains("input CreateResourceMemberInput"),
        "CreateResourceMemberInput missing"
    );
}

#[test]
fn sdl_import_dry_run_query() {
    let sdl = sdl();
    assert!(
        sdl.contains("import_dry_run(manifest:"),
        "import_dry_run query missing:\n{sdl}"
    );
    let report = type_block(&sdl, "ImportDryRunReport");
    for field in [
        "source_system:",
        "root_external_id:",
        "heading_count:",
        "task_count:",
        "phase_counts:",
        "total_effort_hours:",
        "issue_1139:",
        "diagnostics:",
        "snapshot_sha256:",
    ] {
        assert!(
            report.contains(field),
            "ImportDryRunReport.{field} missing:\n{report}"
        );
    }
    // Decimal truth is a string in GraphQL.
    let start = sdl.find("type DryRunIssue1139Check").expect("DryRunIssue1139Check missing");
    assert!(
        sdl[start..].contains("effort_hours: String"),
        "issue_1139 effort_hours must be a decimal String"
    );
}

#[test]
fn sdl_project_schedule_projection_query() {
    let sdl = sdl();
    assert!(
        sdl.contains("project_schedule_projection(project_id:"),
        "project_schedule_projection query missing:\n{sdl}"
    );
    let block = type_block(&sdl, "ProjectScheduleProjection");
    for field in ["project_id:", "source:", "phase_groups:", "wbs_rows:", "totals:"] {
        assert!(
            block.contains(field),
            "ProjectScheduleProjection.{field} missing:\n{block}"
        );
    }
}

#[test]
fn sdl_projection_source_enum_and_unphased_group() {
    let sdl = sdl();
    assert!(
        sdl.contains("enum ScheduleProjectionSource"),
        "ScheduleProjectionSource enum missing"
    );
    assert!(
        sdl.contains("CURRENT_TASK_FIELDS"),
        "CURRENT_TASK_FIELDS value missing"
    );
    let group = type_block(&sdl, "SchedulePhaseGroup");
    for field in ["phase_id:", "phase_key:", "is_unphased:", "task_ids:", "totals:"] {
        assert!(
            group.contains(field),
            "SchedulePhaseGroup.{field} missing:\n{group}"
        );
    }
}

#[test]
fn sdl_source_heading_is_distinct_with_no_task_identity() {
    let sdl = sdl();
    assert!(
        sdl.contains("union ScheduleWbsRow"),
        "ScheduleWbsRow union missing:\n{sdl}"
    );
    let union_start = sdl.find("union ScheduleWbsRow").unwrap();
    let union = &sdl[union_start..union_start + 160];
    assert!(
        union.contains("ScheduleTaskEntry") && union.contains("ScheduleSourceHeading"),
        "union must be task | heading distinctly:\n{union}"
    );
    let heading = type_block(&sdl, "ScheduleSourceHeading");
    assert!(
        heading.contains("heading_id:") && heading.contains("external_id:"),
        "heading identity fields missing:\n{heading}"
    );
    assert!(
        !heading.contains("task_id:"),
        "ScheduleSourceHeading MUST NOT expose a task_id (no bar callbacks):\n{heading}"
    );
    assert!(
        !heading.contains("progress:") && !heading.contains("effort_hours:"),
        "headings carry no schedule numbers:\n{heading}"
    );
    let task = type_block(&sdl, "ScheduleTaskEntry");
    for field in [
        "task_id:",
        "start_date:",
        "end_date:",
        "effort_hours:",
        "progress:",
        "depth:",
    ] {
        assert!(task.contains(field), "ScheduleTaskEntry.{field} missing:\n{task}");
    }
}

#[test]
fn sdl_has_no_schedule_engine_dependency() {
    let sdl = sdl();
    // Scan the operative SDL only (drop triple-quoted doc blocks: prose may
    // legitimately mention that increment 1 has no capacity semantics).
    let mut operative = String::with_capacity(sdl.len());
    let mut in_doc = false;
    for line in sdl.lines() {
        if line.trim_start_matches(['\t', ' ']).starts_with("\"\"\"") {
            in_doc = !in_doc;
            continue;
        }
        if !in_doc {
            operative.push_str(line);
            operative.push('\n');
        }
    }
    // herdr-260905 requirements 3/6 deliberately introduce capacity /
    // commitment surfaces (`MemberCapacity`, `DayOff`, `RecurringCommitment`).
    // The increment-1 guarantee still holds for the surfaces that existed in
    // increment 1: the projection + resource-member + taxonomy blocks must
    // not gain allocation/segment/meeting/capacity fields. Assert on those
    // blocks only, instead of the whole SDL.
    for block_name in ["ProjectScheduleProjection", "ScheduleSourceHeading", "ResourceMemberType"] {
        let block = extract_type_block(&operative, block_name)
            .unwrap_or_else(|| panic!("missing type block {block_name} in SDL"));
        for forbidden in [
            "allocation",
            "Allocation",
            "segment",
            "Segment",
            "meeting",
            "Meeting",
            "capacity",
            "Capacity",
            "CAPACITY_SCHEDULER",
        ] {
            assert!(
                !block.contains(forbidden),
                "increment 1 surface {block_name} must not depend on schedule-engine semantics: `{forbidden}` leaked"
            );
        }
    }
}

/// Extract a `type X { … }` block from flat (doc-stripped) SDL.
fn extract_type_block(sdl: &str, type_name: &str) -> Option<String> {
    let start_marker = format!("type {type_name} {{");
    let start = sdl.find(&start_marker)?;
    let rest = &sdl[start..];
    let end = rest.find("\n}")?;
    Some(rest[..end + 2].to_string())
}

/* --------------------------- pure projection ---------------------------- */

fn phase(id: Uuid, key: &str, order: i32) -> PhaseOrderRow {
    PhaseOrderRow {
        phase_id: id,
        phase_key: key.to_string(),
        display_order: order,
    }
}

fn task(
    id: Uuid,
    parent: Option<Uuid>,
    phase_id: Option<Uuid>,
    effort: Option<f64>,
    progress: Option<i32>,
) -> TaskFieldRow {
    TaskFieldRow {
        task_id: id,
        parent_task_id: parent,
        title: format!("task-{id}"),
        phase_id,
        start_date: None,
        due_date: None,
        effort,
        progress,
        wbs_group_id: None,
    }
}

#[test]
fn projection_phase_groups_exact_order_plus_explicit_unphased_last() {
    let project = Uuid::new_v4();
    let (p1, p2) = (Uuid::new_v4(), Uuid::new_v4());
    let phases = vec![
        phase(p2, "try-s-review-1", 20),
        phase(p1, "creation", 10),
    ];
    // Task with an UNKNOWN/archived phase id falls into Unphased, never dropped.
    let tasks = vec![
        task(Uuid::new_v4(), None, Some(p2), Some(1.0), Some(10)),
        task(Uuid::new_v4(), None, Some(p1), Some(2.0), Some(50)),
        task(Uuid::new_v4(), None, Some(Uuid::new_v4()), None, None),
    ];
    let out = build_projection(project, &tasks, &phases, &[]);
    assert_eq!(out.phase_groups.len(), 3, "two phases + explicit Unphased");
    let keys: Vec<&str> = out.phase_groups.iter().map(|g| g.phase_key.as_str()).collect();
    assert_eq!(keys, vec!["creation", "try-s-review-1", "unphased"]);
    assert!(out.phase_groups[0].phase_id == Some(p1));
    assert!(out.phase_groups[2].is_unphased && out.phase_groups[2].phase_id.is_none());
    // Unphased group exists even when no task is unphased.
    let empty = build_projection(project, &tasks[..2].to_vec(), &phases, &[]);
    assert_eq!(empty.phase_groups.last().unwrap().phase_key, "unphased");
    assert!(empty.phase_groups.last().unwrap().task_ids.is_empty());
}

#[test]
fn projection_counts_each_real_task_once_regardless_of_depth() {
    let project = Uuid::new_v4();
    let phase_id = Uuid::new_v4();
    let (t1, t2, t3) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
    // Three-level chain: root -> child -> grandchild. Rollups are computed
    // ONCE per real task (flat pass), never per hierarchy level.
    let tasks = vec![
        task(t1, None, Some(phase_id), Some(10.0), Some(100)),
        task(t2, Some(t1), Some(phase_id), Some(20.0), Some(50)),
        task(t3, Some(t2), Some(phase_id), Some(30.0), None),
    ];
    let out = build_projection(project, &tasks, &[phase(phase_id, "creation", 10)], &[]);
    let group = &out.phase_groups[0];
    assert_eq!(group.totals.task_count, 3, "each real task counted once");
    assert_eq!(group.totals.effort_hours, "60.00");
    assert_eq!(group.task_ids.len(), 3);
    assert_eq!(out.totals.task_count, 3);
    assert_eq!(out.totals.effort_hours, "60.00");
    // Weighted progress: contributors t1 (10h@100) + t2 (20h@50); t3 has no
    // progress value. (10*100 + 20*50) / 30 = 66.67
    assert!((out.totals.progress.unwrap() - 66.67).abs() < 0.01);
}

#[test]
fn projection_legacy_effort_is_normalized_display_decimal_string() {
    let project = Uuid::new_v4();
    let phase_id = Uuid::new_v4();
    let tasks = vec![
        task(Uuid::new_v4(), None, Some(phase_id), Some(7.5), None),
        task(Uuid::new_v4(), None, Some(phase_id), Some(0.1 + 0.2), None),
        task(Uuid::new_v4(), None, Some(phase_id), None, None),
    ];
    let out = build_projection(project, &tasks, &[phase(phase_id, "creation", 10)], &[]);
    let entries: Vec<&str> = out
        .wbs_rows
        .iter()
        .filter_map(|r| match r {
            task_scheduler_backend::graphql::resolvers::schedule_projection::projection::ScheduleWbsRow::Task(e) => {
                Some(e.effort_hours.as_str())
            }
            _ => None,
        })
        .collect();
    assert_eq!(entries, vec!["7.50", "0.30", "0.00"]);
    assert_eq!(out.totals.effort_hours, "7.80");
}

#[test]
fn projection_wbs_rows_headings_and_tasks_nested() {
    let project = Uuid::new_v4();
    let (h1, h2) = (Uuid::new_v4(), Uuid::new_v4());
    let headings = vec![
        HeadingRow {
            group_id: h1,
            parent_group_id: None,
            source_system: "redmine".into(),
            external_id: "1115".into(),
            title: "Detailed Design".into(),
            position: 1,
        },
        HeadingRow {
            group_id: h2,
            parent_group_id: Some(h1),
            source_system: "redmine".into(),
            external_id: "1116".into(),
            title: "Sub heading".into(),
            position: 1,
        },
    ];
    let (root_task, grouped, nested) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
    let mut t_grouped =
        task(grouped, None, None, Some(40.0), None);
    t_grouped.wbs_group_id = Some(h1);
    let mut t_nested = task(nested, None, None, None, None);
    t_nested.wbs_group_id = Some(h2);
    let tasks = vec![
        task(root_task, None, None, Some(1.0), None),
        t_grouped,
        t_nested,
    ];
    let out = build_projection(project, &tasks, &[], &headings);
    use task_scheduler_backend::graphql::resolvers::schedule_projection::projection::ScheduleWbsRow;
    let mut rows: HashMap<String, (i32, bool)> = HashMap::new();
    for row in &out.wbs_rows {
        match row {
            ScheduleWbsRow::Heading(h) => {
                rows.insert(h.external_id.clone(), (h.depth as i32, false));
            }
            ScheduleWbsRow::Task(t) => {
                rows.insert(t.task_id.to_string(), (t.depth as i32, true));
            }
        }
    }
    assert_eq!(out.wbs_rows.len(), 5, "3 tasks + 2 headings, none dropped");
    assert_eq!(rows["1115"], (0, false), "root heading at depth 0");
    assert_eq!(rows["1116"], (1, false), "nested heading under parent");
    assert_eq!(rows[&root_task.to_string()], (0, true));
    assert_eq!(rows[&grouped.to_string()], (1, true), "task under its heading");
    assert_eq!(rows[&nested.to_string()], (2, true), "task under nested heading");
}

#[test]
fn projection_source_is_current_task_fields() {
    let out = build_projection(Uuid::new_v4(), &[], &[], &[]);
    assert_eq!(out.source, "CURRENT_TASK_FIELDS");
}

/* --------------------- authorization gates (P1 fix) --------------------- */

mod authz_harness {
    use chrono::Duration;
    use task_scheduler_backend::auth::types::Claims;
    use task_scheduler_backend::config::Config;
    use task_scheduler_backend::graphql::context::Context as GraphQLContext;
    use task_scheduler_backend::graphql::dataloaders::{ProjectLoader, UserLoader};
    use uuid::Uuid;

    /// Lazy pool pointed at a dead address: queries fail FAST with a
    /// connection error. Resolvers must therefore reject unauthorized
    /// callers BEFORE touching the database — a DB-flavored error message
    /// proves the auth gate is missing.
    pub fn dead_pool() -> sqlx::PgPool {
        sqlx::PgPool::connect_lazy("postgres://nobody:nopass@127.0.0.1:1/none")
            .expect("lazy pool must construct without connecting")
    }

    pub fn context_with(auth: Option<Claims>) -> GraphQLContext {
        let pool = dead_pool();
        GraphQLContext::new(
            pool.clone(),
            auth,
            ProjectLoader::new(pool.clone()),
            UserLoader::new(pool.clone()),
            Config::default(),
        )
    }

    pub fn claims_for(user: Uuid) -> Claims {
        Claims::new(
            user.to_string(),
            "user@example.test".into(),
            "Contract User".into(),
            Duration::hours(1),
        )
    }
}

use authz_harness::{claims_for, context_with};

/// Assert a request produces an AUTH error (never a DB/connection error).
#[allow(dead_code)]
fn assert_auth_error(op: &str, errors: &[async_graphql::ServerError]) {
    assert!(
        !errors.is_empty(),
        "`{op}` must be rejected for unauthenticated callers"
    );
    for err in errors {
        let msg = err.message.to_lowercase();
        assert!(
            msg.contains("unauthorized") || msg.contains("forbidden"),
            "`{op}` must fail with an auth error, got: {msg}"
        );
        assert!(
            !msg.contains("database")
                && !msg.contains("connect")
                && !msg.contains("refused")
                && !msg.contains("timeout"),
            "`{op}` hit the database before the auth gate: {msg}"
        );
    }
}

async fn exec(
    query: String,
    ctx: task_scheduler_backend::graphql::context::Context,
) -> Vec<async_graphql::ServerError> {
    let schema = Schema::build(Query::default(), Mutation::default(), EmptySubscription).finish();
    schema
        .execute(async_graphql::Request::new(query).data(ctx))
        .await
        .errors
}

const ANY_ID: &str = "00000000-0000-4000-8000-000000000001";
const OTHER_ID: &str = "00000000-0000-4000-8000-000000000002";

#[tokio::test]
async fn authz_unauthenticated_taxonomy_writes_are_rejected_before_db() {
    use authz_harness::dead_pool;
    let _ = dead_pool(); // fail fast if lazy pools stop constructing
    let ops: Vec<(&str, String)> = vec![
        (
            "ensure_default_phases",
            format!("mutation {{ ensure_default_phases(project_id: \"{ANY_ID}\") }}"),
        ),
        (
            "create_project_phase",
            format!(
                "mutation {{ create_project_phase(input: {{ project_id: \"{ANY_ID}\", \
                 term_key: \"k\", display_order: 1, translations: [] }}) {{ phase_id }} }}"
            ),
        ),
        (
            "update_project_phase_translations",
            format!(
                "mutation {{ update_project_phase_translations(input: {{ project_id: \"{ANY_ID}\", \
                 term_id: \"{OTHER_ID}\" }}) {{ phase_id }} }}"
            ),
        ),
        (
            "archive_project_phase",
            format!(
                "mutation {{ archive_project_phase(project_id: \"{ANY_ID}\", \
                 phase_id: \"{OTHER_ID}\", strategy: {{ unphased: true }}) }}"
            ),
        ),
        (
            "set_task_taxonomy",
            format!(
                "mutation {{ set_task_taxonomy(task_id: \"{ANY_ID}\", phase_id: \"{OTHER_ID}\") }}"
            ),
        ),
    ];
    for (op, query) in ops {
        let errors = exec(query, context_with(None)).await;
        assert_auth_error(op, &errors);
    }
}

#[tokio::test]
async fn authz_unauthenticated_resource_member_writes_are_rejected_before_db() {
    let ops: Vec<(&str, String)> = vec![
        (
            "create_resource_member",
            format!(
                "mutation {{ create_resource_member(input: {{ project_id: \"{ANY_ID}\", \
                 display_name: \"someone\" }}) {{ resource_member_id }} }}"
            ),
        ),
        (
            "link_resource_member_user",
            format!(
                "mutation {{ link_resource_member_user(resource_member_id: \"{ANY_ID}\", \
                 user_id: \"{OTHER_ID}\") {{ resource_member_id }} }}"
            ),
        ),
        (
            "classify_resource_member",
            format!(
                "mutation {{ classify_resource_member(resource_member_id: \"{ANY_ID}\", \
                 classified_by_resource_member_id: \"{OTHER_ID}\") }}"
            ),
        ),
    ];
    for (op, query) in ops {
        let errors = exec(query, context_with(None)).await;
        assert_auth_error(op, &errors);
    }
}

#[tokio::test]
async fn authz_projection_and_taxonomy_resource_reads_require_login() {
    let ops: Vec<(&str, String)> = vec![
        (
            "project_schedule_projection",
            format!("query {{ project_schedule_projection(project_id: \"{ANY_ID}\") {{ project_id }} }}"),
        ),
        (
            "resource_members",
            format!("query {{ resource_members(project_id: \"{ANY_ID}\") {{ resource_member_id }} }}"),
        ),
        (
            "project_phases",
            format!("query {{ project_phases(project_id: \"{ANY_ID}\") {{ phase_id }} }}"),
        ),
    ];
    for (op, query) in ops {
        let errors = exec(query, context_with(None)).await;
        assert_auth_error(op, &errors);
    }
}

/// The authenticated-but-role-checked SQL must keep matching the
/// established project-role model: writes = owner OR manager/leader/admin
/// member (same predicate as member admin mutations); reads = owner OR any
/// project member (same predicate as the project query resolver).
#[test]
fn authz_guard_sql_locks_established_role_pattern() {
    use task_scheduler_backend::graphql::resolvers::project_authz;

    let write_sql = project_authz::PROJECT_WRITE_ROLE_SQL;
    assert!(write_sql.contains("owner_id"), "write gate must honor project owner");
    assert!(
        write_sql.contains("role::text IN ('manager', 'leader', 'admin')"),
        "write gate must reuse the member-admin role set"
    );

    let read_sql = project_authz::PROJECT_READ_MEMBER_SQL;
    assert!(read_sql.contains("owner_id"), "read gate must honor project owner");
    assert!(read_sql.contains("project_members"), "read gate must accept members");
    assert!(!read_sql.contains("role::text"), "read gate must not filter by role");
}

/// Guards must be wired into every mounted mutation in scope — the source
/// contract that the behavioral unauthenticated tests alone cannot pin for
/// authenticated non-members.
#[test]
fn authz_guards_are_wired_into_every_scheduling_resolver() {
    use std::fs;
    let base = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("src/graphql/resolvers");
    for (file, write_guard_count, read_guard_count) in [
        ("taxonomies/mod.rs", 5, 1),
        ("resource_members/mod.rs", 3, 2),
        ("schedule_projection/mod.rs", 0, 1),
    ] {
        let src = fs::read_to_string(base.join(file))
            .unwrap_or_else(|e| panic!("cannot read {file}: {e}"));
        let writes = src.matches("require_project_write").count();
        let reads = src.matches("require_project_read").count();
        assert_eq!(
            writes, write_guard_count,
            "{file} must call require_project_write exactly {write_guard_count} times (got {writes})"
        );
        assert_eq!(
            reads, read_guard_count,
            "{file} must call require_project_read exactly {read_guard_count} times (got {reads})"
        );
    }
}

#[test]
fn assemble_forest_returns_orphan_and_self_parent_rows_as_roots() {
    // Domain contract (task 1.1 handoff): corrupt rows surface exactly once
    // as roots — an orphan (parent missing from input) and a self-parent.
    let a = Uuid::new_v4();
    let b = Uuid::new_v4();
    let missing = Uuid::new_v4();
    let forest = assemble_forest(vec![
        ForestRow { task_id: a, parent_task_id: Some(missing), payload: "orphan" },
        ForestRow { task_id: b, parent_task_id: Some(b), payload: "self" },
    ]);
    let mut payloads: Vec<&str> = forest.iter().map(|t| t.payload).collect();
    payloads.sort_unstable();
    assert_eq!(payloads, vec!["orphan", "self"], "both surface as roots");
    assert!(forest.iter().all(|t| t.children.is_empty()));
}
