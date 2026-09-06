//! Task 1.1 — project taxonomy & real-task hierarchy correctness.
//!
//! Pure-domain cases run always (no database). Live-PostgreSQL cases are
//! `#[ignore]`d and follow the `migration_evidence` conventions: throwaway
//! databases only, created/dropped via the admin connection, run with
//! `cargo test --test taxonomy_hierarchy -- --ignored --test-threads=1`.

use std::collections::HashMap;

use sqlx::{postgres::PgPoolOptions, PgPool};
use task_scheduler_backend::domain::taxonomy::{
    self, ArchiveStrategy, LocalizedLabel, ReparentError, TaskRowRef,
};
use task_scheduler_backend::migration_runner::{self, MigrationOutcome};
use uuid::Uuid;

/* ------------------------------ helpers (pure) ------------------------------ */

fn node(task_id: Uuid, project: Uuid, parent: Option<Uuid>) -> TaskRowRef {
    TaskRowRef {
        task_id,
        project_id: project,
        parent_task_id: parent,
        priority_order: 0,
        phase_id: None,
        category_id: None,
    }
}

/// Six-task chain (five levels below the root) plus an unrelated second root
/// with one child; returned in ADVERSE order so nothing can "accidentally"
/// work because parents precede children in the input slice.
fn deep_forest(project: Uuid) -> Vec<TaskRowRef> {
    let (r, a, b, c, d, e) = (
        Uuid::new_v4(),
        Uuid::new_v4(),
        Uuid::new_v4(),
        Uuid::new_v4(),
        Uuid::new_v4(),
        Uuid::new_v4(),
    );
    let (other, other_child) = (Uuid::new_v4(), Uuid::new_v4());
    let mut rows = vec![
        node(r, project, None),
        node(a, project, Some(r)),
        node(b, project, Some(a)),
        node(c, project, Some(b)),
        node(d, project, Some(c)),
        node(e, project, Some(d)),
        node(other, project, None),
        node(other_child, project, Some(other)),
    ];
    rows.reverse();
    rows
}

fn depth_path(tree: &[task_scheduler_backend::domain::taxonomy::TreeNode]) -> HashMap<Uuid, usize> {
    let mut out = HashMap::new();
    fn walk(
        nodes: &[task_scheduler_backend::domain::taxonomy::TreeNode],
        depth: usize,
        out: &mut HashMap<Uuid, usize>,
    ) {
        for n in nodes {
            out.insert(n.task_id, depth);
            walk(&n.children, depth + 1, out);
        }
    }
    walk(tree, 0, &mut out);
    out
}

/* ------------------------------ seed constants ------------------------------ */

#[test]
fn default_phases_are_exactly_five_in_accepted_order_and_translation() {
    let phases = taxonomy::default_phases();
    assert_eq!(phases.len(), 5, "exactly five default phases");
    let expected: [(&str, i32, &str, &str, &str); 5] = [
        ("creation", 1, "作成", "Creation", "Tạo tài liệu"),
        ("try-s-review-1", 2, "Try-Sレビュー①", "Try-S Review 1", "Đánh giá Try-S lần 1"),
        (
            "address-review-comments-1",
            3,
            "指摘修正①",
            "Address Review Comments 1",
            "Sửa theo góp ý lần 1",
        ),
        ("try-s-review-2", 4, "Try-Sレビュー②", "Try-S Review 2", "Đánh giá Try-S lần 2"),
        ("toshiba-review", 5, "東芝レビュー", "Toshiba Review", "Đánh giá Toshiba"),
    ];
    for (term, (key, order, ja, en, vi)) in phases.iter().zip(expected) {
        assert_eq!(term.key, key);
        assert_eq!(term.display_order, order);
        assert_eq!(term.ja, ja, "ja label for {key}");
        assert_eq!(term.en, en, "en label for {key}");
        assert_eq!(term.vi, vi, "vi label for {key}");
    }
}

/* ------------------------------ locale fallback ------------------------------ */

#[test]
fn locale_fallback_requested_then_project_default_then_first_then_key() {
    let translations = vec![
        LocalizedLabel { locale: "en".into(), name: "Creation".into() },
        LocalizedLabel { locale: "vi".into(), name: "Tạo tài liệu".into() },
    ];
    // Requested locale wins.
    assert_eq!(
        taxonomy::resolve_label(&translations, Some("vi"), Some("ja"), "creation"),
        "Tạo tài liệu"
    );
    // Missing requested locale → project default locale.
    assert_eq!(
        taxonomy::resolve_label(&translations, Some("fr"), Some("en"), "creation"),
        "Creation"
    );
    // Missing requested and default → first available translation (stable order).
    assert_eq!(
        taxonomy::resolve_label(&translations, Some("fr"), Some("de"), "creation"),
        "Creation"
    );
    // No translations at all → immutable key.
    assert_eq!(
        taxonomy::resolve_label(&[], Some("fr"), Some("ja"), "creation"),
        "creation"
    );
}

/* ------------------------------ hierarchy materialization ------------------------------ */

#[test]
fn five_level_hierarchy_materializes_from_adverse_input_order() {
    let project = Uuid::new_v4();
    let rows = deep_forest(project);
    // Remember the chain by construction (rows were reversed; re-derive).
    let mut by_parent: HashMap<Uuid, Uuid> = HashMap::new(); // child -> parent
    for r in &rows {
        if let Some(p) = r.parent_task_id {
            by_parent.insert(r.task_id, p);
        }
    }
    // Tips = keys that no other row points to as parent; the 6-task chain
    // has the longest ancestor walk.
    let has_children: std::collections::HashSet<&Uuid> = by_parent.values().collect();
    let chain_tip = *by_parent
        .keys()
        .filter(|c| !has_children.contains(c))
        .max_by_key(|c| {
            let mut len = 0usize;
            let mut cur = by_parent[*c];
            while let Some(p) = by_parent.get(&cur) {
                cur = *p;
                len += 1;
            }
            len
        })
        .expect("at least one tip");
    let mut chain = vec![chain_tip];
    while let Some(p) = by_parent.get(chain.last().unwrap()) {
        chain.push(*p);
    }
    chain.reverse(); // root..tip, 6 tasks = five levels below root
    assert_eq!(chain.len(), 6);

    let forest = taxonomy::materialize_tree(&rows);
    let depths = depth_path(&forest);
    assert_eq!(depths.len(), 8, "every task materialized exactly once");
    for (i, id) in chain.iter().enumerate() {
        assert_eq!(depths[id], i, "task {id} must sit at depth {i}");
    }
    // Two roots only.
    assert_eq!(forest.len(), 2);
}

#[test]
fn materialize_tree_keeps_each_task_own_phase_attribute() {
    let project = Uuid::new_v4();
    let (root, child, grand) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
    let p1 = Uuid::new_v4();
    let p2 = Uuid::new_v4();
    let mut rows = vec![
        node(grand, project, Some(child)),
        node(child, project, Some(root)),
        node(root, project, None),
    ];
    rows[0].phase_id = Some(p2); // grandchild phase differs from parent's
    rows[1].phase_id = Some(p1);
    // Phase is NOT derived from the parent: materialization must carry each
    // row's own phase_id, never inherit or drop it.
    let forest = taxonomy::materialize_tree(&rows);
    let depths = depth_path(&forest);
    assert_eq!(depths.len(), 3);
    let find = |id: Uuid| -> Option<uuid::Uuid> {
        fn hunt(
            nodes: &[task_scheduler_backend::domain::taxonomy::TreeNode],
            id: Uuid,
        ) -> Option<uuid::Uuid> {
            for n in nodes {
                if n.task_id == id {
                    return n.phase_id;
                }
                if let Some(found) = hunt(&n.children, id) {
                    return Some(found);
                }
            }
            None
        }
        hunt(&forest, id)
    };
    assert_eq!(find(root), None);
    assert_eq!(find(child), Some(p1));
    assert_eq!(find(grand), Some(p2));
}

/* ------------------------------ reparent validation ------------------------------ */

#[test]
fn reparent_rejects_self_cycle_and_cross_project() {
    let project_a = Uuid::new_v4();
    let project_b = Uuid::new_v4();
    let (root, mid, tip) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
    let foreign = Uuid::new_v4();
    let rows = vec![
        node(root, project_a, None),
        node(mid, project_a, Some(root)),
        node(tip, project_a, Some(mid)),
        node(foreign, project_b, None),
    ];

    // Self as parent.
    assert!(matches!(
        taxonomy::validate_reparent(tip, Some(tip), &rows),
        Err(ReparentError::SelfParent)
    ));
    // Own ancestor (descendant would create a cycle).
    assert!(matches!(
        taxonomy::validate_reparent(root, Some(tip), &rows),
        Err(ReparentError::WouldCreateCycle)
    ));
    // Cross-project parent.
    assert!(matches!(
        taxonomy::validate_reparent(tip, Some(foreign), &rows),
        Err(ReparentError::CrossProject)
    ));
    // Unknown parent.
    assert!(matches!(
        taxonomy::validate_reparent(tip, Some(Uuid::new_v4()), &rows),
        Err(ReparentError::UnknownParent)
    ));
    // Unknown task.
    assert!(matches!(
        taxonomy::validate_reparent(Uuid::new_v4(), None, &rows),
        Err(ReparentError::UnknownTask)
    ));
    // Valid same-project reparents: to root, to sibling, and detach (None).
    assert!(taxonomy::validate_reparent(tip, Some(root), &rows).is_ok());
    assert!(taxonomy::validate_reparent(tip, None, &rows).is_ok());
}

/* ------------------------------ live-PostgreSQL evidence ------------------------------ */

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

async fn seed_project(pool: &PgPool, name: &str) -> Uuid {
    let user: Uuid = sqlx::query_scalar(
        "INSERT INTO users (email, username) VALUES ($1, $1) RETURNING user_id",
    )
    .bind(format!("{name}@example.test"))
    .fetch_one(pool)
    .await
    .expect("seed user");
    sqlx::query_scalar(
        "INSERT INTO projects (name, owner_id) VALUES ($1, $2) RETURNING project_id",
    )
    .bind(name)
    .bind(user)
    .fetch_one(pool)
    .await
    .expect("seed project")
}

#[tokio::test]
#[ignore = "requires a reachable PostgreSQL admin database (throwaway DBs only)"]
async fn live_taxonomy_seed_fk_archive_and_reparent_evidence() {
    let (pool, db_name) = throwaway_db("taxonomy_h").await;
    let outcome = migration_runner::run(&pool).await.expect("migrations run");
    assert!(matches!(outcome, MigrationOutcome::BootstrappedFresh { .. }));

    // Trigger-seeded defaults for a NEW project: exact keys/order/translations.
    let project = seed_project(&pool, "alpha").await;
    let phases = taxonomy::list_project_phases(&pool, project).await.expect("list phases");
    assert_eq!(phases.len(), 5);
    let expected = taxonomy::default_phases();
    for (row, term) in phases.iter().zip(expected.iter()) {
        assert_eq!(row.phase_key, term.key);
        assert_eq!(row.display_order, term.display_order);
        assert!(row.is_active);
        assert_eq!(row.translations.len(), 3, "ja/en/vi for {}", term.key);
        let by_locale = |l: &str| {
            row.translations
                .iter()
                .find(|t| t.locale == l)
                .unwrap_or_else(|| panic!("missing {l} for {}", term.key))
                .name
                .clone()
        };
        assert_eq!(by_locale("ja"), term.ja);
        assert_eq!(by_locale("en"), term.en);
        assert_eq!(by_locale("vi"), term.vi);
    }

    // Idempotent seeding: second run inserts nothing.
    let inserted = taxonomy::ensure_default_phases(&pool, project)
        .await
        .expect("re-seed");
    assert_eq!(inserted, 0);

    // Project-scoped FK: another project's phase must be rejected by the
    // service validation AND by the composite DB foreign key.
    let other_project = seed_project(&pool, "beta").await;
    let other_phase = taxonomy::list_project_phases(&pool, other_project)
        .await
        .expect("list other phases")[0]
        .phase_id;
    assert!(taxonomy::validate_term_for_project(&pool, project, Some(other_phase), None)
        .await
        .is_err());
    let user: Uuid =
        sqlx::query_scalar("SELECT owner_id FROM projects WHERE project_id = $1")
            .bind(project)
            .fetch_one(&pool)
            .await
            .expect("owner");
    let bad = sqlx::query(
        "INSERT INTO tasks (task_id, project_id, title, created_by, phase_id) \
         VALUES ($1, $2, 'cross-project phase', $3, $4)",
    )
    .bind(Uuid::new_v4())
    .bind(project)
    .bind(user)
    .bind(other_phase)
    .execute(&pool)
    .await;
    assert!(bad.is_err(), "composite FK must reject cross-project phase");

    // Build a five-level chain with phases; reparent preserves phase/category.
    let (phase1, phase2) = (phases[0].phase_id, phases[1].phase_id);
    let category: Uuid = sqlx::query_scalar(
        "INSERT INTO project_categories (project_id, category_key, display_order) \
         VALUES ($1, 'doc', 1) RETURNING category_id",
    )
    .bind(project)
    .fetch_one(&pool)
    .await
    .expect("seed category");
    let mut ids: Vec<Uuid> = (0..6).map(|_| Uuid::new_v4()).collect();
    for i in 0..6 {
        let parent = if i == 0 { None } else { Some(ids[i - 1]) };
        sqlx::query(
            "INSERT INTO tasks (task_id, project_id, parent_task_id, title, created_by, \
             phase_id, category_id) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(ids[i])
        .bind(project)
        .bind(parent)
        .bind(format!("t{i}"))
        .bind(user)
        .bind(if i == 5 { Some(phase2) } else { Some(phase1) })
        .bind(if i == 5 { Some(category) } else { None })
        .execute(&pool)
        .await
        .expect("insert chain task");
    }
    let tip = ids.pop().unwrap();

    let rows = taxonomy::fetch_task_refs(&pool, project).await.expect("refs");
    taxonomy::validate_reparent(tip, Some(ids[0]), &rows)
        .expect("valid same-project reparent");
    let moved = taxonomy::reparent_task(&pool, tip, Some(ids[0]))
        .await
        .expect("reparent under root");
    assert_eq!(moved.phase_id, Some(phase2), "reparent preserves phase");
    assert_eq!(moved.category_id, Some(category), "reparent preserves category");

    // Cycle / self / cross-project rejected on live data too.
    let rows = taxonomy::fetch_task_refs(&pool, project).await.expect("refs");
    assert!(matches!(
        taxonomy::validate_reparent(ids[0], Some(tip), &rows),
        Err(ReparentError::WouldCreateCycle)
    ));
    assert!(matches!(
        taxonomy::validate_reparent(ids[0], Some(ids[0]), &rows),
        Err(ReparentError::SelfParent)
    ));
    let other_owner: Uuid =
        sqlx::query_scalar("SELECT owner_id FROM projects WHERE project_id = $1")
            .bind(other_project)
            .fetch_one(&pool)
            .await
            .expect("other owner");
    let foreign_task: Uuid = sqlx::query_scalar(
        "INSERT INTO tasks (task_id, project_id, title, created_by) \
         VALUES ($1, $2, 'foreign', $3) RETURNING task_id",
    )
    .bind(Uuid::new_v4())
    .bind(other_project)
    .bind(other_owner)
    .fetch_one(&pool)
    .await
    .expect("foreign task");
    let mut all_rows = rows;
    all_rows.push(node(foreign_task, other_project, None));
    assert!(matches!(
        taxonomy::validate_reparent(ids[0], Some(foreign_task), &all_rows),
        Err(ReparentError::CrossProject)
    ));

    // Archive: explicit Unphased conversion NULLs the phase; reassignment moves it.
    let unphased = taxonomy::archive_phase(&pool, project, phase1, ArchiveStrategy::Unphased)
        .await
        .expect("archive unphased");
    assert!(unphased > 0, "five chain tasks referenced phase1");
    let still: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM tasks WHERE project_id = $1 AND phase_id = $2",
    )
    .bind(project)
    .bind(phase1)
    .fetch_one(&pool)
    .await
    .expect("count");
    assert_eq!(still, 0);

    drop_db(&db_name).await;
}
