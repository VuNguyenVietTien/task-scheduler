# Task 1.1 Implementation Report — Project Taxonomy, Exact Seed, Hierarchy Correctness

Session: herdr-260901-1842 · Scope: Increment 1 / Task 1.1 ONLY (pass 2: corrective revision)
Spec: `docs/superpowers/specs/2026-09-01-project-scheduling-wbs-design.md` §2, §4, §6
Plan: `docs/superpowers/plans/2026-09-01-project-scheduling-wbs.md` Task 1.1
Skills used: `ak:cook` (accepted-plan reuse, TDD per phase, concise evidence-first report) and `ak:backend-development` (Rust/Postgres layering, migration/test discipline). No worktree; edits in place on the dirty tree.

## 1. Changed files (all within owned paths)

Created:
- `backend/migrations/20260901000100_create_project_taxonomies.sql` — forward-only migration (version 20260901000100 > chain head 20260328000001; stock `sqlx::migrate!` checksum conventions preserved; existing files untouched)
- `backend/src/domain/mod.rs` — new domain layer root (`pub mod taxonomy;`)
- `backend/src/domain/taxonomy.rs` — pure rules + DB services (see §4)
- `backend/src/db/models/taxonomy.rs` — `ProjectPhase`, `ProjectPhaseTranslation`, `ProjectCategory`, `ProjectCategoryTranslation` (FromRow)
- `backend/src/graphql/resolvers/taxonomies/mod.rs` — `TaxonomyQuery`/`TaxonomyMutation` + types (AUTHORED, NOT MOUNTED — see §5)
- `backend/tests/taxonomy_hierarchy.rs`, `backend/tests/taxonomy_migration.rs` — TDD tests

Modified (additive; user's pre-existing format/import-order diffs preserved):
- `backend/src/db/models/mod.rs` — register/re-export taxonomy models (user's alphabetical ordering kept)
- `backend/src/db/models/task.rs` — `phase_id`/`category_id: Option<Uuid>` now ON the db model (pass 2)
- `backend/src/db/helpers.rs` — `row_to_task` gains nullable `try_get` reads (pass 2; user changes preserved, 2 lines appended)
- `backend/src/migration_runner.rs` — new `FP_V4_TABLES` + fingerprint entry for 20260901000100 (pass 2; no assertion weakened)
- `backend/src/main.rs` — `mod domain;` registration (pass 2)
- `backend/src/graphql/resolvers/tasks/query/tasks.rs` — depth-safe hierarchy assembly via ID indexes
- `backend/src/graphql/resolvers/tasks/mutation/update.rs` — reparent validation before write (uses `crate::domain` — extern-crate-self workaround REMOVED in pass 2)
- `backend/src/graphql/resolvers/tasks/mutation/create.rs` — same-project parent validation
- `backend/src/lib.rs` — `pub mod domain;` + test-only `#[cfg(test)] #[path]` compile gate for the unmounted taxonomies resolver module (extern crate self alias removed)

Untouched as planned: `reorder.rs`, `tasks/mod.rs`, `mutation/mod.rs`, `query/mod.rs`, `schema.rs`, `schema.graphql`, web files, contract/platform tests, `.env`, lockfiles.

## 2. RED evidence (before implementation)

Command: `cargo test --test taxonomy_hierarchy --test taxonomy_migration`
Outcome (exact):
```
error[E0433]: failed to resolve: could not find `domain` in `task_scheduler_backend`
error[E0432]: unresolved import `task_scheduler_backend::domain`
error[E0433]: failed to resolve: could not find `domain` in `task_scheduler_backend`
error: could not compile `task-scheduler-backend` (test "taxonomy_migration") due to 1 previous error
error: could not compile `task_scheduler_backend` (test "taxonomy_hierarchy") due to 7 previous errors
```
RED cause: taxonomy domain/service and migration did not exist (plus two test-side typos of my own, fixed during the cycle).

## 3. GREEN evidence (pass 2, all fresh, exact commands and outcomes)

1. `cargo test --lib migration_runner` → `test result: ok. 7 passed; 0 failed; 0 ignored` (includes `fingerprints_cover_every_embedded_version` and `bootstrap_order_covers_exactly_the_embedded_chain`; no assertion weakened/skipped — a real `SchemaFingerprint { version: 20_260_901_000_100, tables: FP_V4_TABLES, columns: +[("tasks","phase_id"),("tasks","category_id")], enum_values: unchanged }` entry was appended, keeping the last-entry == chain-head invariant; `probe_state`'s PartialSchema guard now correctly requires the taxonomy tables)
2. `cargo test --test taxonomy_hierarchy --test taxonomy_migration` → `test result: ok. 5 passed; 0 failed; 1 ignored` and `test result: ok. 4 passed; 0 failed; 1 ignored`
3. Live-PostgreSQL evidence (PG 14.17; throwaway DBs created/dropped; dev DB untouched): `cargo test --test taxonomy_hierarchy --test taxonomy_migration -- --ignored --test-threads=1` → `1 passed` + `1 passed`
4. `cargo check --all-targets` → `Finished \`dev\` profile [unoptimized + debuginfo] target(s) in 18.94s` — clean (pre-existing warnings only).

RED-before-fix evidence for pass 2 corrections:
- Fingerprint: pre-pass-2 `cargo test --lib migration_runner` → `test result: FAILED. 6 passed; 1 failed` (`fingerprints_cover_every_embedded_version`, migration_runner.rs:708).
- Task model exposure: after adding model fields, `cargo check --lib` → `error[E0063]: missing fields \`category_id\` and \`phase_id\` in initializer of models::task::Task` at `src/db/helpers.rs:47` — fixed with nullable `try_get` reads (db/queries/task.rs uses `SELECT *`, so reads are safe post-migration).
- Taxonomy resolver compile gate: first gated compile surfaced real draft bugs — `error: traits in #[derive(...)] don't accept values` (5×), `error: Unknown field: \`oneof\`` (this async-graphql version), `error[E0631]` (15× map_err on sqlx::Error) — all fixed in the module; it now compiles. The gate proves compilation; behavior remains untested until Task 1.3 mounts it.

Proven behavior:
- Exact five phases, exact keys/order (`creation`, `try-s-review-1`, `address-review-comments-1`, `try-s-review-2`, `toshiba-review`), exact ja/en/vi labels (pure + live).
- Idempotent seed: migration backfills existing projects (ON CONFLICT DO NOTTHING); AFTER INSERT trigger seeds new projects (live: fresh project → exactly 5 phases, 3 translations each); `ensure_default_phases` re-run inserts 0.
- Locale fallback chain requested → project default → first available → immutable key.
- Project-scoped FKs: composite `tasks(project_id, phase_id)`/`(project_id, category_id)` FKs reject cross-project terms at DB level (live: 23503 rejected) and via `validate_term_for_project`.
- Five-level hierarchy materializes from adverse (reversed) input order; per-node phase/category carried, never inherited.
- Self/cycle/cross-project reparent rejected (pure + live); valid same-project reparent and detach allowed; `reparent_task` UPDATE touches only `parent_task_id`/`updated_at` → phase/category preserved (live assert).
- Archive: `archive_phase` requires explicit `ArchiveStrategy` (ReassignTo active same-project term, or Unphased→NULL), transactional; live Unphased converted 5 referencing tasks, phase_id count → 0.
- No schedule semantics: phase/category tables carry no effort/progress/dates/assignee/parent/dependency/meeting/allocation columns (pure test over CREATE TABLE blocks + live schema).
- No capacity, meetings, assignments, import apply, or schedule versions added.

## 4. Handoff contract for Task 1.3

- Service/type names: `domain::taxonomy::{default_phases, DEFAULT_PHASES, DefaultTerm, LocalizedLabel, resolve_label, TaskRowRef, TreeNode, materialize_tree, ReparentError, validate_reparent, TaxonomyError, PhaseRow, ArchiveStrategy, ensure_default_phases, list_project_phases, validate_term_for_project, fetch_task_refs, reparent_task, archive_phase}`; models `db::models::{ProjectPhase, ProjectPhaseTranslation, ProjectCategory, ProjectCategoryTranslation}`.
- GraphQL roots ready to mount: `graphql::resolvers::taxonomies::{TaxonomyQuery, TaxonomyMutation}` (+ input/object types in same file). Mount by adding `pub mod taxonomies;` to `resolvers/mod.rs` and folding into schema roots — those files are Task 1.3's.
- Task phase/category fields: DB columns exist; domain `TaskRowRef` exposes them; `set_task_taxonomy` mutation is authored (unmounted).

## 5. Limitations / handoffs after pass 2 (exact)

1. **Taxonomy resolver still unmounted** (schema composition is Task 1.3's: `graphql/resolvers/mod.rs`, `schema.rs`, `schema.graphql`). It now COMPILES via a test-only `#[cfg(test)] #[path = "graphql/resolvers/taxonomies/mod.rs"] mod taxonomy_resolver_compile_gate;` in `lib.rs` — exercised by `cargo test --lib` and `cargo check --all-targets`. Compilation is verified; resolver BEHAVIOR is not (no schema mounting ⇒ no execution). Task 1.3 must replace the gate with a normal `pub mod taxonomies;` declaration and remove the gate.
2. **GraphQL public Task type unchanged** (`graphql/types/task.rs`): phase/category GraphQL fields remain Task 1.3 work; db-level exposure is complete (`db::models::Task.phase_id/category_id`, `row_to_task` nullable reads).
3. lib.rs `extern crate self` workaround REMOVED (pass 2): `update.rs` uses `crate::domain::…` and `main.rs` registers `mod domain;`, compiling both lib and bin targets cleanly.

## 6. Collision audit

Pre-existing user modifications in owned files (formatting/import reordering only) were inspected before editing and preserved byte-for-byte: `db/models/mod.rs`, `db/models/task.rs`, all task resolver files, `lib.rs`. All other `M` entries in `backend/` (schema.rs, schema.graphql, delete/update_effort/update_status.rs, query/task.rs, task_subtasks.rs, models/{comment,member,notification,project,report,task_status,user}.rs, etc.) are the user's pre-existing changes — untouched; `schema.graphql` was NOT regenerated (contract test never run). No BLOCKED_COLLISION. No commits, pushes, deploys, or dev-database mutations (only throwaway `taxonomy_h_*`/`taxonomy_m_*` databases, created and dropped).

## 7. Self-verdict

COMPLETE for Task 1.1 (pass 2). All required commands pass fresh: `cargo test --lib migration_runner` (7/7), `cargo test --test taxonomy_hierarchy --test taxonomy_migration` (9 passed + 2 live ignored-when-default, both green when run), `cargo check --all-targets` clean. db::models::Task exposes `phase_id`/`category_id` with nullable `row_to_task` reads; migration fingerprint registry follows existing conventions with no weakened assertions; extern-crate-self workaround removed in favor of `main.rs` `mod domain;` + `crate::domain` imports; taxonomy resolver compiles under a test-only gate (behavior verification deferred to Task 1.3 mounting, as scoped). No phase row carries task/schedule semantics. No commits/pushes/deploys/data mutations.
