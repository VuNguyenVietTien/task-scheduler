//! Task 1.1 — taxonomy migration evidence.
//!
//! File-contract cases run always (no database): exact seed rows embedded in
//! the migration, idempotent seeding, project-scoped FKs, nullable task
//! columns, and the "phase rows carry no task/schedule semantics" guarantee.
//! The live case is `#[ignore]`d (throwaway database, migration_evidence
//! conventions).

use std::path::PathBuf;

use sqlx::{postgres::PgPoolOptions, PgPool, Row};
use task_scheduler_backend::migration_runner::{self, MigrationOutcome};

const MIGRATION_FILE: &str = "20260901000100_create_project_taxonomies.sql";

fn migration_text() -> String {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("migrations")
        .join(MIGRATION_FILE);
    std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("migration {MIGRATION_FILE} must exist: {e}"))
}

/// Extract a `CREATE TABLE [IF NOT EXISTS] x (...)` block (up to the closing `);`).
fn create_table_block(sql: &str, table: &str) -> String {
    let header = [format!("CREATE TABLE {table}"), format!("CREATE TABLE IF NOT EXISTS {table}")]
        .into_iter()
        .find(|h| sql.contains(h))
        .unwrap_or_else(|| panic!("CREATE TABLE {table} missing"));
    let start = sql.find(&header).unwrap();
    let end = sql[start..]
        .find(");")
        .map(|i| start + i + 2)
        .unwrap_or(sql.len());
    sql[start..end].to_string()
}

const SCHEDULE_SEMANTICS_COLUMNS: &[&str] = &[
    "effort",
    "progress",
    "start_date",
    "due_date",
    "actual_start",
    "actual_end",
    "assignee",
    "parent",
    "dependency",
    "prerequisite",
    "meeting",
    "allocation",
    "capacity",
];

#[test]
fn migration_file_exists_with_later_version_than_chain_head() {
    let version: i64 = MIGRATION_FILE[..14].parse().unwrap();
    assert_eq!(version, 20_260_901_000_100);
    assert!(
        version > 20_260_328_000_001,
        "forward-only: version must be later than the current chain head"
    );
    migration_text(); // panics if absent
}

#[test]
fn migration_seeds_exactly_five_phases_with_exact_translations() {
    let sql = migration_text();
    let expected: [(&str, &str, &str, &str); 5] = [
        ("creation", "作成", "Creation", "Tạo tài liệu"),
        ("try-s-review-1", "Try-Sレビュー①", "Try-S Review 1", "Đánh giá Try-S lần 1"),
        (
            "address-review-comments-1",
            "指摘修正①",
            "Address Review Comments 1",
            "Sửa theo góp ý lần 1",
        ),
        ("try-s-review-2", "Try-Sレビュー②", "Try-S Review 2", "Đánh giá Try-S lần 2"),
        ("toshiba-review", "東芝レビュー", "Toshiba Review", "Đánh giá Toshiba"),
    ];
    for (key, ja, en, vi) in expected {
        assert!(sql.contains(&format!("'{key}'")), "seed key {key}");
        assert!(sql.contains(ja), "ja label for {key}");
        assert!(sql.contains(en), "en label for {key}");
        assert!(sql.contains(vi), "vi label for {key}");
    }
    // Idempotent seeding for EXISTING projects (re-runnable seed statement).
    assert!(
        sql.to_lowercase().contains("on conflict do nothing"),
        "seed must be idempotent (ON CONFLICT DO NOTHING)"
    );
    // New projects are seeded by a trigger on project insert.
    assert!(
        sql.to_lowercase().contains("create trigger"),
        "new projects must receive default phases via trigger"
    );
}

#[test]
fn phase_and_category_tables_have_no_task_or_schedule_semantics() {
    let sql = migration_text();
    for table in ["project_phases", "project_phase_translations", "project_categories", "project_category_translations"] {
        let block = create_table_block(&sql, table).to_lowercase();
        for banned in SCHEDULE_SEMANTICS_COLUMNS {
            assert!(
                !block.contains(&format!(" {banned}")),
                "{table} must not carry `{banned}` (task/schedule semantics)"
            );
        }
    }
    let phases = create_table_block(&sql, "project_phases");
    assert!(phases.contains("project_id"), "project-scoped");
    assert!(phases.contains("phase_key"), "immutable key");
    assert!(phases.contains("display_order"), "ordered");
    assert!(phases.contains("is_active"), "archivable");
}

#[test]
fn tasks_gain_nullable_project_scoped_phase_and_category_references() {
    let sql = migration_text();
    assert!(
        sql.contains("ADD COLUMN IF NOT EXISTS phase_id UUID"),
        "tasks.phase_id nullable column"
    );
    assert!(
        sql.contains("ADD COLUMN IF NOT EXISTS category_id UUID"),
        "tasks.category_id nullable column"
    );
    assert!(
        !sql.contains("ADD COLUMN IF NOT EXISTS phase_id UUID NOT NULL")
            && !sql.contains("ADD COLUMN IF NOT EXISTS category_id UUID NOT NULL"),
        "tasks.phase_id/category_id must stay optional (Unphased is valid)"
    );
    // Composite foreign keys bind the term to the SAME project.
    assert!(
        sql.contains("FOREIGN KEY (project_id, phase_id)"),
        "composite FK tasks(project_id, phase_id) -> project_phases"
    );
    assert!(
        sql.contains("FOREIGN KEY (project_id, category_id)"),
        "composite FK tasks(project_id, category_id) -> project_categories"
    );
}

/* ------------------------------ live evidence ------------------------------ */

fn admin_db_url() -> String {
    std::env::var("MIGRATION_EVIDENCE_ADMIN_DB")
        .unwrap_or_else(|_| "postgres://longapple@127.0.0.1:5432/postgres".to_string())
}

#[tokio::test]
#[ignore = "requires a reachable PostgreSQL admin database (throwaway DBs only)"]
async fn live_migration_applies_and_schema_is_project_scoped() {
    let admin: PgPool = PgPoolOptions::new()
        .max_connections(2)
        .connect(&admin_db_url())
        .await
        .expect("admin database reachable");
    let name = format!(
        "taxonomy_m_{}_{}",
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

    let outcome = migration_runner::run(&pool).await.expect("migrations run");
    assert!(matches!(outcome, MigrationOutcome::BootstrappedFresh { .. }));
    // Re-run: forward-only no-op (idempotency evidence for the whole chain).
    let again = migration_runner::run(&pool).await.expect("re-run");
    assert!(matches!(again, MigrationOutcome::ForwardOnly { applied: 0 }));

    // Nullable task columns exist; composite FKs exist.
    let phase_null: Option<String> = sqlx::query_scalar(
        "SELECT is_nullable FROM information_schema.columns \
         WHERE table_name = 'tasks' AND column_name = 'phase_id'",
    )
    .fetch_one(&pool)
    .await
    .expect("tasks.phase_id exists");
    assert_eq!(phase_null.as_deref(), Some("YES"));

    let fk: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM information_schema.table_constraints \
         WHERE constraint_type = 'FOREIGN KEY' \
         AND constraint_name IN ('tasks_phase_project_fk', 'tasks_category_project_fk')",
    )
    .fetch_one(&pool)
    .await
    .expect("fk query");
    assert_eq!(fk, 2, "both composite project-scoped FKs present");

    // A project inserted AFTER migration is seeded by the trigger.
    let project_row = sqlx::query(
        "WITH u AS (INSERT INTO users (email, username) VALUES ('m@t.test','m') RETURNING user_id) \
         , p AS (INSERT INTO projects (name, owner_id) SELECT 'proj', user_id FROM u RETURNING project_id) \
         SELECT p.project_id FROM p",
    )
    .fetch_one(&pool)
    .await
    .expect("seed project");
    let project_id: uuid::Uuid = project_row.get("project_id");
    let seeded: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM project_phases WHERE project_id = $1",
    )
    .bind(project_id)
    .fetch_one(&pool)
    .await
    .expect("count phases");
    assert_eq!(seeded, 5, "trigger seeds exactly five default phases");

    let _ = sqlx::query(&format!("DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)"))
        .execute(&admin)
        .await;
}
