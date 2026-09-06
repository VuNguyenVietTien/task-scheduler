# Fix Report — pm-taxonomy-fix-1

**Session:** herdr-260901-1842 · **Mode:** TDD fix execution (RED→GREEN), primary checkout, **no git worktree** (no worktree created/used; all work in main checkout)
**Scope:** ONLY findings accepted in `pm-foundation-review-1.md` (its §3 P2 + two P3s; §6 mandatory actions 1–3). No migration/schema/resolver-registry/frontend/lockfile/.env/deploy changes.

**Skills used:** `ak:cook` (SKILL.md — plan-gated TDD implementation flow), `ak:backend-development` (SKILL.md — transaction/lock correctness guidance). Read before work per instructions; no subagents (15-min deadline, code-review skill already produced the accepted findings).

## Findings fixed (all 3 in-scope)

### F1 (P2) — `archive_phase` self-reassignment guard
- **Fix:** `backend/src/domain/taxonomy.rs`
  - New `TaxonomyError::InvalidArchiveStrategy` variant (+ `Display` arm).
  - New pure `validate_archive_strategy(phase_id, strategy)`: rejects `ReassignTo(target)` when `target == phase_id`.
  - `archive_phase` calls it as its FIRST statement — before `pool.begin()`, before any read/update/deactivation → rejection can never leave a partial write.
- **TDD evidence:**
  - RED: `archive_reassign_to_same_phase_is_rejected` FAILED against stub (`assertion failed: matches!(… Err(InvalidArchiveStrategy))` — stub returned `Ok`).
  - GREEN (pure): same test passes; `ReassignTo(other)`/`Unphased` still `Ok`.
  - GREEN (live PG): `live_archive_self_reassign_rejected_before_any_write` — rejects with `InvalidArchiveStrategy`, phase stays `is_active`, referencing task keeps `phase_id` (proves "before any update/deactivation").

### F2 (P3) — `take_tree` panics / drops on corrupt parent cycles
- **Fix:** `backend/src/graphql/resolvers/tasks/query/tasks.rs`
  - Removed the `expect("task indexed in first pass")` assembler entirely.
  - Projection now delegates to new shared pure `domain::taxonomy::assemble_forest(ForestRow<T>)` (public → integration-testable without DB):
    - visited-set guard: revisit/duplicate edge → skip, **never panic**;
    - missing-parent orphan or self-parent → surfaces as **root**;
    - cycle members (unreachable from real roots) → appended as roots after main assembly (diagnostic-safe fallback);
    - **exactly-once** guarantee for every row (first-row-per-id wins on duplicate input).
  - Healthy behavior unchanged: first-encounter row order for roots and children preserved; fetched sets from the recursive CTE are closed under parent, so ordering/nesting identical to previous assembler on healthy data (existing 5 hierarchy tests green).
- **TDD evidence:**
  - RED: `corrupt_parent_cycle_never_panics_and_surfaces_each_task_exactly_once` FAILED against extracted-as-was algorithm (3 of 6 tasks surfaced; cycle A→B→A, self-parent, orphan all dropped).
  - GREEN: same test passes — all 6 tasks exactly once, healthy root first with child nested.

### F3 (P3) — reparent validate/write TOCTOU (concurrent cycle creation)
- **Inspection:** both entry paths (`graphql …/tasks/mutation/update.rs` and service `reparent_task`) validated on pool snapshots outside the write transaction. All required signatures live in owned files → **real fix implemented, not deferred**.
- **Fix:**
  - `taxonomy.rs`: new `lock_project_hierarchy(executor, project_id)` — transaction-scoped advisory lock `pg_advisory_xact_lock(hashtextextended(project_id::text, 6202401))` (auto-release on commit/rollback; no deadlock risk: lock acquired before any row lock, single lock per tx).
  - `reparent_task`: begin tx → resolve project → advisory lock → `fetch_task_refs` **through the tx** → `validate_reparent` → UPDATE → commit. Validate+write now one atomic pair.
  - `fetch_task_refs` made generic over `sqlx::Executor` (same fn serves `&PgPool` and `&mut *tx`; all callers in owned files updated; pure/live existing tests unaffected).
  - `update.rs`: validation block now reads task/project **through the already-open `tx`**, takes `lock_project_hierarchy`, fetches refs via tx, then validates — the big UPDATE and commit were already in that tx. Full path: lock → validate → update → commit.
- **TDD evidence:** live-PG concurrency test `live_concurrent_opposing_reparents_cannot_commit_a_cycle`: two spawned concurrent `reparent_task(A→B)` / `reparent_task(B→A)` → asserts exactly one commits and final hierarchy is acyclic (exactly one direction valid, reverse is a cycle). **PASSED** on real PostgreSQL. (No pure test can prove locking; the ignored-live convention from `taxonomy_hierarchy.rs` was reused.)

## Verification (fresh, this session)

| Command | Result |
|---|---|
| `cargo test --test taxonomy_hardening` | `2 passed; 0 failed; 2 ignored` (pure GREEN after RED) |
| `cargo test --test taxonomy_hierarchy` | `5 passed; 0 failed; 1 ignored` (all existing tests preserved) |
| `cargo test --test taxonomy_hardening --test taxonomy_hierarchy -- --ignored --test-threads=1` (local PG, throwaway DBs only, created/dropped; no real data touched) | `3 passed; 0 failed` — incl. both new live tests + pre-existing live evidence test |
| `cargo check --lib --test taxonomy_hierarchy --test taxonomy_hardening --test taxonomy_migration` | 0 errors |
| `cargo check --all-targets` | **Pre-existing baseline failures only**, identical with/without this diff: untracked tests `import_issue_1115_dry_run.rs` / `resource_members.rs` (other workers, in-flight) import `task_scheduler_backend::imports` / `domain::resource_identity` which are not registered in `lib.rs` (out of my ownership). Not introduced by this change. |

## Diff scope (only owned files touched)

- `backend/src/domain/taxonomy.rs` — `InvalidArchiveStrategy`, `validate_archive_strategy`, guard call in `archive_phase`, `ForestRow`/`ForestTree`/`assemble_forest`, `lock_project_hierarchy`, `fetch_task_refs` executor-generic, `reparent_task` single-tx+lock rewrite.
- `backend/src/graphql/resolvers/tasks/query/tasks.rs` — projection delegates to `assemble_forest`; `expect`/`take_tree` removed.
- `backend/src/graphql/resolvers/tasks/mutation/update.rs` — reparent validation moved inside tx under advisory lock.
- `backend/tests/taxonomy_hardening.rs` — NEW: 2 pure + 2 live (ignored) tests.
- `backend/tests/taxonomy_hierarchy.rs` — untouched this pass (its live test already covers reparent paths; re-ran green). *(Note: `git diff --stat` vs HEAD for the two resolver files shows larger deltas because it includes the prior Task-1.1 worker's uncommitted edits to the same files; my delta is limited to the blocks described above.)*

## Findings deferred / not fixed (with reason)

- **P3 migration re-run asymmetry** — review itself says "document, don't change"; migration files out of ownership. Deferred.
- **P3 `TaskScheduleItem.source_wbs`** — frontend, out of ownership. Deferred to Task 1.3/1.4 handoff.
- **P3 performance notes** (`wouldCycle` O(n·depth), recursion depth, per-reparent full-project fetch) — review: "fine at expected scale". Deferred.
- **Task 1.3 mounting items** (resolver registry, schema regen, compile-gate removal) — out of scope/ownership by instruction.
- Note: `assemble_forest` recursion depth = tree depth (same as before) — stack-safety on pathological depth unchanged, consistent with the deferred performance note.

## No-commit / no-worktree / no-destructive ops

No commit, push, deploy. No worktree. Live DB tests used only throwaway databases (create/drop, `migration_evidence` convention); no real/live data read or mutated. All other workers' changes (tracked `M`, untracked `??`, deletions) left untouched.

## Verdict

**COMPLETE** — all 3 accepted findings fixed with RED→GREEN evidence; pure + live-PostgreSQL suites green; existing tests preserved; diff strictly inside owned files. Out-of-scope `--all-targets` baseline failures are other workers' in-flight work, unchanged by this diff.

## Unresolved questions

1. Advisory-lock seed `6202401` is arbitrary but fixed; if a project-wide lock-key registry ever emerges (Task 1.3+), register it there.
2. Orphan/self-parent rows in the tasks query now surface as roots (was: silent drop). Frontend WBS builders already treat orphans/cycles the same way — consistent, but flag for Task 1.3 contract tests.
