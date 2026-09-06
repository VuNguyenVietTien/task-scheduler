//! Hardening tests for accepted findings of pm-foundation-review-1.
//!
//! - P2: `archive_phase(ReassignTo(self))` must be rejected BEFORE any task
//!   update or phase deactivation (pure decision test + live-DB evidence).
//! - P3: corrupt parent cycles in the hierarchy projection must never panic;
//!   every surfaced task appears exactly once (root fallback is acceptable).
//! - P3: concurrent opposing reparents must not be able to commit a cycle
//!   (live-DB, transaction/advisory-lock evidence).
//!
//! Pure cases run always; live cases follow the `migration_evidence`
//! conventions (throwaway databases only, `#[ignore]`d).

use sqlx::{postgres::PgPoolOptions, PgPool};
use task_scheduler_backend::domain::taxonomy::{
    self, assemble_forest, validate_archive_strategy, ArchiveStrategy, ForestRow, TaxonomyError,
};
use task_scheduler_backend::migration_runner::{self};
use uuid::Uuid;

/* ------------------------- pure: archive self-reassignment ------------------------- */

#[test]
fn archive_reassign_to_same_phase_is_rejected() {
    let phase = Uuid::new_v4();
    let other = Uuid::new_v4();
    // Reassigning a phase's tasks to the phase being archived is a no-op
    // conversion: it would strand live tasks on an archived term.
    assert!(matches!(
        validate_archive_strategy(phase, ArchiveStrategy::ReassignTo(&phase)),
        Err(TaxonomyError::InvalidArchiveStrategy)
    ));
    // A different active target and Unphased remain valid strategies.
    assert!(validate_archive_strategy(phase, ArchiveStrategy::ReassignTo(&other)).is_ok());
    assert!(validate_archive_strategy(phase, ArchiveStrategy::Unphased).is_ok());
}

/* ------------------------- pure: corrupt-cycle projection ------------------------- */

fn forest_row(task_id: Uuid, parent: Option<Uuid>, payload: usize) -> ForestRow<usize> {
    ForestRow { task_id, parent_task_id: parent, payload }
}

/// Collect the payload of every node in the forest (used for exactly-once
/// checks; payloads are unique per row by construction).
fn walk(
    trees: &[task_scheduler_backend::domain::taxonomy::ForestTree<usize>],
) -> Vec<usize> {
    let mut out = Vec::new();
    fn rec(
        nodes: &[task_scheduler_backend::domain::taxonomy::ForestTree<usize>],
        out: &mut Vec<usize>,
    ) {
        for n in nodes {
            out.push(n.payload);
            rec(&n.children, out);
        }
    }
    rec(trees, &mut out);
    out
}

#[test]
fn corrupt_parent_cycle_never_panics_and_surfaces_each_task_exactly_once() {
    let (root, child) = (Uuid::new_v4(), Uuid::new_v4());
    let (a, b) = (Uuid::new_v4(), Uuid::new_v4()); // cycle A→B→A
    let self_parent = Uuid::new_v4(); // corrupt self edge
    let orphan = Uuid::new_v4(); // parent missing from the fetched set
    let rows = vec![
        forest_row(root, None, 0),
        forest_row(child, Some(root), 1),
        forest_row(a, Some(b), 2),
        forest_row(b, Some(a), 3),
        forest_row(self_parent, Some(self_parent), 4),
        forest_row(orphan, Some(Uuid::new_v4()), 5),
    ];

    let forest = assemble_forest(rows); // must not panic (old code: expect/drop)

    // Every task surfaces exactly once (no drops, no duplicates).
    let payloads = walk(&forest);
    assert_eq!(payloads.len(), 6, "each of the six tasks exactly once");
    let mut seen = std::collections::HashSet::new();
    for p in &payloads {
        assert!(seen.insert(*p), "task {p} surfaced more than once");
    }

    // Healthy structure and order are unchanged: root first, child nested.
    assert_eq!(forest[0].payload, 0, "healthy root keeps first position");
    assert_eq!(forest[0].children.len(), 1);
    assert_eq!(forest[0].children[0].payload, 1, "healthy child nests under its parent");
}

/* ------------------------- live-PostgreSQL evidence ------------------------- */

fn admin_db_url() -> String {
    std::env::var("MIGRATION_EVIDENCE_ADMIN_DB")
        .unwrap_or_else(|_| "postgres://longapple@127.0.0.1:5432/postgres".to_string())
}

async fn throwaway_db(prefix: &str) -> (PgPool, String) {
    let admin: PgPool = PgPoolOptions::new()
        .max_connections(2)
        .connect(&admin_db_url())
        .await
        .expect("admin database reachable");
    let name = format!(
        "{}_{}_{}",
        prefix,
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis()
    );
    sqlx::query(&format!("CREATE DATABASE \"{name}\""))
        .execute(&admin)
        .await
        .expect("create throwaway database");
    let pool = PgPoolOptions::new()
        .max_connections(2)
        .connect(&format!("postgres://longapple@127.0.0.1:5432/{name}"))
        .await
        .expect("connect throwaway database");
    (pool, name)
}

async fn drop_db(name: &str) {
    let admin: PgPool = PgPoolOptions::new()
        .max_connections(2)
        .connect(&admin_db_url())
        .await
        .expect("admin database reachable");
    let _ = sqlx::query(&format!("DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)"))
        .execute(&admin)
        .await;
}

#[tokio::test]
#[ignore = "requires a reachable PostgreSQL admin database (throwaway DBs only)"]
async fn live_archive_self_reassign_rejected_before_any_write() {
    let (pool, db_name) = throwaway_db("taxo_hard1").await;
    migration_runner::run(&pool).await.expect("migrations run");
    let user: Uuid = sqlx::query_scalar(
        "INSERT INTO users (email, username) VALUES ('hard1@example.test', 'hard1') RETURNING user_id",
    )
    .fetch_one(&pool)
    .await
    .expect("seed user");
    let project: Uuid = sqlx::query_scalar(
        "INSERT INTO projects (name, owner_id) VALUES ('hard1', $1) RETURNING project_id",
    )
    .bind(user)
    .fetch_one(&pool)
    .await
    .expect("seed project");
    let phase: Uuid = sqlx::query_scalar(
        "SELECT phase_id FROM project_phases WHERE project_id = $1 AND phase_key = 'creation'",
    )
    .bind(project)
    .fetch_one(&pool)
    .await
    .expect("seeded phase");
    sqlx::query(
        "INSERT INTO tasks (task_id, project_id, title, created_by, phase_id) \
         VALUES ($1, $2, 'references phase', $3, $4)",
    )
    .bind(Uuid::new_v4())
    .bind(project)
    .bind(user)
    .bind(phase)
    .execute(&pool)
    .await
    .expect("seed task");

    // Self-reassignment must be refused outright...
    assert!(matches!(
        taxonomy::archive_phase(&pool, project, phase, ArchiveStrategy::ReassignTo(&phase))
            .await
            .map(|n| n as i64),
        Err(TaxonomyError::InvalidArchiveStrategy)
    ));
    // ...without deactivating the phase or touching its referencing tasks.
    let still_active: bool = sqlx::query_scalar(
        "SELECT is_active FROM project_phases WHERE phase_id = $1",
    )
    .bind(phase)
    .fetch_one(&pool)
    .await
    .expect("phase row");
    assert!(still_active, "phase must NOT be deactivated by a rejected archive");
    let still_referencing: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM tasks WHERE phase_id = $1 AND NOT COALESCE(is_deleted, false)",
    )
    .bind(phase)
    .fetch_one(&pool)
    .await
    .expect("count");
    assert_eq!(still_referencing, 1, "task must keep its phase reference");

    drop_db(&db_name).await;
}

#[tokio::test]
#[ignore = "requires a reachable PostgreSQL admin database (throwaway DBs only)"]
async fn live_concurrent_opposing_reparents_cannot_commit_a_cycle() {
    let (pool, db_name) = throwaway_db("taxo_hard2").await;
    migration_runner::run(&pool).await.expect("migrations run");
    let user: Uuid = sqlx::query_scalar(
        "INSERT INTO users (email, username) VALUES ('hard2@example.test', 'hard2') RETURNING user_id",
    )
    .fetch_one(&pool)
    .await
    .expect("seed user");
    let project: Uuid = sqlx::query_scalar(
        "INSERT INTO projects (name, owner_id) VALUES ('hard2', $1) RETURNING project_id",
    )
    .bind(user)
    .fetch_one(&pool)
    .await
    .expect("seed project");
    let (a, b) = (Uuid::new_v4(), Uuid::new_v4());
    for id in [a, b] {
        sqlx::query(
            "INSERT INTO tasks (task_id, project_id, title, created_by) \
             VALUES ($1, $2, 'root', $3)",
        )
        .bind(id)
        .bind(project)
        .bind(user)
        .execute(&pool)
        .await
        .expect("seed root task");
    }

    // Two opposing reparents race: A under B and B under A. Without a
    // validate+write lock pair both can pass validation and commit a cycle.
    let pool_a = pool.clone();
    let pool_b = pool.clone();
    let h1 = tokio::spawn(async move { taxonomy::reparent_task(&pool_a, a, Some(b)).await });
    let h2 = tokio::spawn(async move { taxonomy::reparent_task(&pool_b, b, Some(a)).await });
    let r1 = h1.await.expect("join 1");
    let r2 = h2.await.expect("join 2");
    let committed = usize::from(r1.is_ok()) + usize::from(r2.is_ok());
    assert_eq!(committed, 1, "exactly one opposing reparent may commit");

    // The surviving hierarchy must be acyclic: one direction valid, reverse a cycle.
    let rows = taxonomy::fetch_task_refs(&pool, project).await.expect("refs");
    let ab = taxonomy::validate_reparent(a, Some(b), &rows).is_ok();
    let ba = taxonomy::validate_reparent(b, Some(a), &rows).is_ok();
    assert!(ab ^ ba, "exactly one direction must remain valid (no cycle): ab={ab} ba={ba}");

    drop_db(&db_name).await;
}
