# PM Resource/Import Implementation Report — Increment 1 Task 1.2

**Worker:** pm-resource-import (pi session) · **Date:** 2026-09-01 · **Plan:** `docs/superpowers/plans/2026-09-01-project-scheduling-wbs.md` Task 1.2 · **Design:** `docs/superpowers/specs/2026-09-01-project-scheduling-wbs-design.md` §6.2/§6.3/§9.2

## Scope warning (manager correction — reported as required)

Mid-task manager directive received and obeyed: **stop all environment/.env/database-credential inspection immediately; no `env`/`printenv`/env-grep, no `.env` files, no live/dev database connections; pure/synthetic tests and migration text/fingerprint validation only.** One earlier routine environment listing (pre-correction) was performed and its output remains in session logs only; no secret values are reproduced in this report or any file. All verification ran offline: pure Rust tests + `cargo check`; no DB connection was made after (or permitted by) the correction. Live-Postgres migration evidence for the two new migrations is therefore **deferred** to the Increment 1 gate (Task 1.5 / `migration_evidence` conventions).

## Skills used

- `ak-cook` (code mode: accepted plan reuse, TDD gates, no-worktree, ownership preflight)
- `ak-backend-development` (Rust/Postgres service patterns, migration discipline, input validation)

No worktree created/used; worked directly in the project tree; no reset/clean/checkout of any path; no commit/push/deploy; no dev-data writes; no browser/session replay.

## Owned files delivered (all within WRITE ownership)

| File | Status |
|---|---|
| `backend/migrations/20260901000200_create_import_provenance.sql` | NEW — `external_import_runs`, `wbs_groups` (metadata-only), additive `tasks.source_system/external_id/source_metadata/wbs_group_id`, partial-unique source identity, wbs nesting scoped to (project, source) |
| `backend/migrations/20260901000300_create_resource_membership.sql` | NEW — `resource_members` (placeholder: required display_name, nullable email/user; MEMBER/COMPANY/GROUP check), partial-unique (project, user_id) for duplicate-link protection, `resource_member_classifications` (no-self check). Legacy `project_members` untouched |
| `backend/src/imports/mod.rs` | NEW — module root, re-exports |
| `backend/src/imports/manifest.rs` | NEW — static bundle serde schema, version gate, canonical snapshot + dependency-free SHA-256 (NIST vectors tested) |
| `backend/src/imports/issue_1115.rs` | NEW — PURE deterministic dry-run validator + exact gate constants (workflow→immutable-phase-key map 69/69/6/6/6, 387.00h, 1139 gates) |
| `backend/src/domain/resource_identity.rs` | NEW — placeholder/link/classification rules; `is_assignable` MEMBER-only; stable-ID linking; explicit duplicate-link conflict |
| `backend/src/domain/mod.rs` | ADDITIVE — `pub mod resource_identity;` (preserved Task 1.1 content) |
| `backend/src/db/models/resource_identity.rs` | NEW — `ResourceMember`, `ResourceMemberClassification` FromRow models |
| `backend/src/db/models/mod.rs` | ADDITIVE — `mod`/`pub use resource_identity` (preserved existing) |
| `backend/src/graphql/resolvers/resource_members/**` | NEW — `mod.rs`: `ResourceMemberQuery`/`ResourceMemberMutation` (list/get, create placeholder, link user, classify); **compile-gated, NOT mounted** |
| `backend/src/bin/import_redmine.rs` | NEW — strict CLI: `--dry-run --input` prints report + snapshot sha; `--apply` REFUSED (increment 4) |
| `backend/src/lib.rs` | ADDITIVE — `pub mod imports;` + `#[cfg(test)] #[path]` resource_members compile gate (taxonomy gate preserved) |
| `backend/src/main.rs` | OWNED, intentionally untouched (bin target auto-discovery needs nothing) |
| `backend/src/migration_runner.rs` | APPEND-ONLY fingerprints: `FP_V5_TABLES` (000200: +`external_import_runs`,`wbs_groups`, +4 tasks columns) and `FP_V6_TABLES` (000300: +`resource_members`,`resource_member_classifications`); existing entries/behavior byte-preserved |
| `backend/tests/import_issue_1115_dry_run.rs` | NEW — 20 pure tests |
| `backend/tests/resource_members.rs` | NEW — 8 pure tests |
| `backend/tests/fixtures/issue_1115_manifest.json` | NEW — synthetic static bundle (156 tasks / 23 headings / 387.00h / 1139 gates verified at generation) |

Not touched: `taxonomy.rs`, task resolver/query/mutation files, `schema.rs`/`schema.graphql`, existing member resolvers, web/**, lockfiles, `.env`, deployment. Forbidden-path dirt observed in git status is **pre-existing** (other owners); no reset/clean performed.

## TDD evidence

**RED** (tests written first, run before implementation):
```
error[E0433]: failed to resolve: could not find `imports` in `task_scheduler_backend`
error[E0432]: unresolved import `task_scheduler_backend::imports`
error[E0432]: unresolved imports `task_scheduler_backend::domain::resource_identity`
error: could not compile `task-scheduler-backend` (test "resource_members") due to 1 previous error
error: could not compile `task-scheduler-backend` (test "import_issue_1115_dry_run") due to 4 previous errors
```

**GREEN** (final runs, exact commands):
```
$ cargo test --lib migration_runner
test result: ok. 7 passed; 0 failed; 0 ignored  (fingerprints cover every embedded version incl. 000200/000300; latest==chain head)

$ cargo test --test import_issue_1115_dry_run --test resource_members
test result: ok. 20 passed; 0 failed; 0 ignored   (import_issue_1115_dry_run)
test result: ok. 8 passed; 0 failed; 0 ignored    (resource_members)

$ cargo check --all-targets        → 0 errors (pre-existing warnings only)
$ cargo test --bin import_redmine  → ok. 3 passed (apply-refusal, strict args)
$ cargo test --lib imports::       → ok. 3 passed (+ manifest/issue_1115 unit tests in full --lib run)
```

### Acceptance criteria coverage

- Root 1115 "Detailed Design" validated; wrong root rejected (`RootMismatch`).
- Exactly 23 `tracker-Phase` headings → root+23 planned WBS display groups only; headings never planned as task/phase/assignment/dependency/capacity objects (dedicated negative test + dependency-endpoint rejection `HeadingAsDependencyEndpoint`).
- Exactly 156 real tasks; duplicates (incl. heading/task/root collisions) rejected.
- Phase counts 69/69/6/6/6 mapped by immutable keys in order; unknown workflow names (`UnknownWorkflow`) and count drift (`WorkflowCountMismatch`) rejected.
- Exact Decimal 387.00h (`rust_decimal`, no floats); drift rejected (`TotalEffortMismatch`).
- Issue 1139 = 40.00h / Shuichi Nakayama (linked-or-placeholder) / WBS row 5; each violation rejected (`Issue1139Violation`) **before** total-effort so wrong-1139-effort reports as a 1135-gate violation, not arithmetic drift.
- Task-under-task → `parent_task_external_id`; task-under-root/heading → `wbs_group_external_id` with NO task parent (tested on 2003 chain and 1139).
- Hierarchy cycles rejected with actionable path (`2001 -> 2002 -> 2001`).
- Ambiguous aliases rejected (`AmbiguousAlias{alias, candidates}`); resolution order person-id → approved alias → unique name → placeholder; placeholders carry no fabricated email/user.
- Deterministic rerun: two dry runs equal (struct + serialized JSON); report contains no timestamps.
- Zero writes: `dry_run(&manifest)` is pure — no pool/async/clock parameter exists; `import_redmine` opens no database; no import apply path exists (structurally impossible until Increment 4).
- Stable resource member: placeholder without email; link preserves `resource_member_id`; idempotent relink; duplicate linked-user (same project) requires explicit resolution; cross-project same-user link allowed; classification COMPANY/GROUP→MEMBER same-project only; `is_assignable` MEMBER-only (companies/groups non-assignable, non-capacity-bearing).
- Migration runner: `cargo test --lib migration_runner` green with appended fingerprints; bootstrap/forward/baseline behavior unchanged (append-only edit).

## Handoff contract for Task 1.3

- GraphQL roots to mount: `ResourceMemberQuery` / `ResourceMemberMutation` (`backend/src/graphql/resolvers/resource_members/mod.rs`), types `ResourceMemberType`, inputs `CreateResourceMemberInput`; mount by `pub mod resource_members;` + schema fold, then REMOVE the `#[cfg(test)] #[path]` gate in `src/lib.rs`.
- Dry-run manifest schema: `backend/src/imports/manifest.rs` (`ImportManifest`, version 1); report shape `DryRunReport` (serializable, deterministic); snapshot digest `manifest::canonical_snapshot` (SHA-256 hex) for `external_import_runs.snapshot_sha256`.
- Phase keys for import mapping: `creation`, `try-s-review-1`, `address-review-comments-1`, `try-s-review-2`, `toshiba-review` (constants in `issue_1115::WORKFLOW_PHASE_MAP`).

## Exact limitations

1. **Resolver not mounted** (by design): compile-gated only; its "never used" warnings mirror the task-1.1 taxonomy gate and disappear when Task 1.3 mounts it. No GraphQL schema/SDL change in this task.
2. **No live-DB migration evidence run** — manager scope correction forbids DB connections. Migration correctness is covered by append-only fingerprint tests (green) and static SQL review; live throwaway-DB evidence deferred to Task 1.5 gate.
3. **No import apply**: `--apply` refuses (exit 2); `external_import_runs` table exists but no writer yet (Increment 4).
4. Fixture is synthetic (real Redmine subtree not exported in this environment); generator math verified at creation (156/23/69-69-6-6-6/387.00/1139 gates).
5. Two placeholder conveniences are domain-level: `link_user` timestamps use `Utc::now()` (test asserts presence, not value, preserving dry-run determinism which never touches members); email validation deliberately light (KISS).
6. Unrelated pre-existing failure observed: `cargo test --lib` → `auth::auth_common::tests::test_token_flow` FAILED (user-modified file outside ownership; requires `DATABASE_URL`/live DB; present before this task, untouched).
7. `resource_members` has no order column; resolver sorts deterministically in Rust (kind, then name).

## Verdict

**GREEN — Task 1.2 complete within scope.** All owned RED tests converted to GREEN; required commands pass (`cargo test --lib migration_runner` 7/7; `cargo test --test import_issue_1115_dry_run --test resource_members` 20/20 + 8/8; `cargo check --all-targets` 0 errors; `cargo check --bin import_redmine` clean). Dry run is deterministic, pure, and write-free; provenance/membership migrations are forward-only additive with append-only fingerprints; resolver authored but unmounted for Task 1.3 handoff. No forbidden file touched; dirty tree preserved; no git publishing performed.
