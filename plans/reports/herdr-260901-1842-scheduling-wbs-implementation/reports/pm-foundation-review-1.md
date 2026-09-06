# Independent Review — pm-foundation-review-1

**Session:** herdr-260901-1842 · **Mode:** READ-ONLY review (no product/test/docs/config edits; no worktree; no commit/push/deploy; no .env reads; worker reports treated as untrusted claims and independently verified)
**Scope:** Backend Increment 1 Task 1.1 (pm-taxonomy-impl-1, pass 2) + frontend Task 1.4 pure projection portion (pm-gantt-pure-impl-1). NOT the entire Increment 1; planned Task 1.3 mounting/integration is out of defect scope.

**Skills used:** `ak:code-review` (SKILL.md + references/spec-compliance-review.md, references/edge-case-scouting.md, references/verification-before-completion.md). No other skills; no subagents; no worktree (`git worktree list` not invoked, no worktree created — confirmed by working directly in the primary checkout).

## 1. Spec compliance matrix (Stage 1)

| # | Requirement (spec § / plan Task) | Status | Evidence |
|---|---|---|---|
| 1 | Phase/category = project-scoped attribute ONLY; no task/schedule columns | PASS | `backend/migrations/20260901000100_create_project_taxonomies.sql:10-56` — only id/key/order/color/is_active/timestamps; pure test `phase_and_category_tables_have_no_task_or_schedule_semantics` (tests/taxonomy_migration.rs:99) passed |
| 2 | Exact five seeds, keys, order, ja/en/vi labels | PASS | Migration VALUES blocks + `DEFAULT_PHASES` (src/domain/taxonomy.rs:53-96) — labels verified char-by-char against spec §4.1 table (作成/Creation/Tạo tài liệu; Try-Sレビュー①…; 指摘修正①…; Try-Sレビュー②…; 東芝レビュー/Toshiba Review/Đánh giá Toshiba); tests :76 and migration test :66 pass |
| 3 | Seed for existing (backfill) AND new projects (trigger) | PASS | Migration backfill CTE + `seed_default_project_phases()` AFTER INSERT trigger; live trigger test is the `--ignored` PG test (not re-run here — no .env DB access; pure + text tests green) |
| 4 | Locale fallback requested → project default → first → key | PASS | `resolve_label` (taxonomy.rs:118-138); test :104 |
| 5 | Hierarchy: arbitrary depth, ID-indexed materialization | PASS | `materialize_tree` (taxonomy.rs:172-225); five-level adverse-order test :134; `tasks.rs` `take_tree` rewrite replaces clone-loss assembler |
| 6 | Reparent invariants: self/cycle/cross-project rejected; phase/category preserved | PASS (see P3-2 caveat) | `validate_reparent` (taxonomy.rs:249-289) ancestor-walk is correct; `reparent_task` UPDATE touches only parent/updated_at (taxonomy.rs:404-421); create.rs same-project parent guard (create.rs diff, inside tx); tests :220 |
| 7 | Migration runner compatibility (forward-only, fingerprint registry, no weakened assertions) | PASS | `migration_runner.rs:202` FP_V4_TABLES includes 4 taxonomy tables; `:294-305` new `SchemaFingerprint { version: 20_260_901_000_100, … }` appended with tasks.phase_id/category_id columns; `cargo test --lib migration_runner` 7/7 incl. coverage invariant tests |
| 8 | DB Task exposure: `Task.phase_id/category_id` nullable + row mapping | PASS | `db/models/task.rs:32-36`; `db/helpers.rs:71-72` nullable `try_get`; queries use `SELECT *` so reads safe post-migration |
| 9 | Taxonomy resolver compile-only (unmounted) limitation honestly scoped | PASS | `lib.rs:24-26` `#[cfg(test)] #[path]` gate; no `pub mod taxonomies` in `graphql/resolvers/mod.rs`; schema.rs/schema.graphql untouched — matches Task 1.3 deferral |
| 10 | Frontend WBS semantics: arbitrary depth, orphans/cycles safe, non-task headings | PASS | `build-wbs-rows.ts` — orphan→root, cycle members→roots (never dropped, no infinite loop), `SOURCE_HEADING` rows carry zero task semantics |
| 11 | Frontend Master semantics: exactly-once grouping by own phase_id, configured order + explicit Unphased, unknown phase→Unphased | PASS | `build-master-rows.ts:29-46` — unknown/unconfigured phase_id falls to Unphased; `phase_groups` + always-present `unphased_group`; 22/22 focused Jest |
| 12 | Exact weighted progress: `Σ(effort×progress)/Σ(effort)` over positive-effort tasks; missing progress in denominator; no fabricated dates; negative effort→0; deleted excluded | PASS | `build-master-rows.ts:59-78` summarize; corrective regression tests green (600/14 case) |
| 13 | Mode switch presentation-only; phase/heading rows non-draggable, never task callbacks | PASS | `ScheduleModeControl.tsx` callback-only, no writes; `PhaseScheduleRow.tsx` `data-nondraggable`, no pointer handlers; `WbsSourceHeadingRow.tsx` display-only |

**Stage 1 verdict: PASS** → proceeded to Stage 2.

## 2. Edge-case scout (consumers/callers)

- **Rust consumers:** `fetch_task_refs`/`validate_reparent` called from `tasks/mutation/update.rs` (validation before write; only when parent provided — detach needs none) and `reparent_task` service. `materialize_tree` used by tests only (Task 1.3 will consume). `db::models::Task` new fields: `row_to_task` is the only initializer — updated; no other `Task { … }` literal (cargo check --all-targets exit 0 proves exhaustiveness). `create.rs` validation runs inside tx (correct); `update.rs` validation reads via `pool` after `tx.begin()` — consistent-enough snapshot but see P3-2.
- **Migration edge behavior:** composite FKs `(project_id, phase_id)`→`project_phases` enforce project scope at DB level (23503 per worker live run, claim consistent with constraint definitions); `UNIQUE (project_id, phase_id)` satisfies FK target requirement; trigger + backfill both `ON CONFLICT DO NOTHING` (data-modifying CTEs execute once even unreferenced — Postgres semantics OK); `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` idempotent. `tasks.category` free-text column untouched. Default `NO ACTION` on task FKs = deleting a referenced phase fails — archive-only lifecycle per spec, acceptable.
- **Frontend consumers:** builders are pure, `readonly` inputs, no framework imports; no existing component imports them yet (integration is Task 1.3/1.4 remainder — not a defect per review instructions). Duplicate task_id input: `byId` collapses, `seen` guard prevents double-emit. Duplicate phase_id in `phases` input would duplicate groups — producer-controlled, noted only.
- **Dirty-worktree regression risk:** current tree has massive unrelated deletions (`.claude/**`, `.opencode/**`) and pre-existing `M` auth/apollo web files + broad backend `M` formatting changes. Neither worker introduced regressions there (frontend worker: only new `??` files in owned creation paths; Timeline.tsx/TaskBar.tsx/task.ts/i18n NOT modified — verified via `git status --short -- web/`). `cargo check --all-targets` green on the combined dirty tree.

## 3. Findings (severity order)

**P2 (latent, non-blocking for this slice) — `archive_phase` self-reassignment guard missing.**
`backend/src/domain/taxonomy.rs:536-560` — `ArchiveStrategy::ReassignTo(target)` does not reject `target == phase_id`. With `archive_phase(p, p, ReassignTo(p))`: target-active check passes, `UPDATE tasks SET phase_id=$2 WHERE phase_id=$1` is a no-op, then the phase is deactivated while live tasks still reference it — leaving tasks pinned to an archived phase and violating spec §4.1 "archiving a referenced term requires atomic reassignment or explicit Unphased conversion" (reassignment to itself is neither). Repro: call service with same UUID for both args. Latent only — `TaxonomyMutation` is unmounted (Task 1.1 scope), so no GraphQL path reaches it today. **Fix (one line, before Task 1.3 mounts the mutation):** after unpacking `ReassignTo(target)`, `if *target == phase_id { return Err(TaxonomyError::Reparent(ReparentError::UnknownParent)); }` (or a dedicated `InvalidStrategy` variant) + one pure test.

**P3 — reparent validation TOCTOU (concurrent cycle creation possible).**
`taxonomy.rs:382-421` + `update.rs:29-46` — validation reads a pool snapshot, then the UPDATE commits separately; two concurrent reparents (A→under B, B→under A) can each validate clean and commit, creating a DB cycle (no constraint prevents it). Single-user UI makes this unlikely; severity limited by that. Fix when mounting in 1.3: run validate+UPDATE in one transaction with `SELECT … FOR UPDATE` on both task rows (or per-project advisory lock).

**P3 — `take_tree` panics on pre-existing DB cycles.**
`backend/src/graphql/resolvers/tasks/query/tasks.rs` (`take_tree`, `map.remove(&id).expect(…)`) — if legacy data already contains a parent cycle (validation only added now), every cycle member is a non-root child and recursion revisits a removed id → `expect` panic → GraphQL 500. Old code silently mis-nested instead (no crash), so this is a behavior change on corrupt data only. Fix: on second visit, treat node as root (or skip) instead of `expect`.

**P3 — migration re-run asymmetry (informational).**
Migration file aims at idempotency (`IF NOT EXISTS` everywhere) but `ALTER TABLE tasks ADD CONSTRAINT tasks_phase_project_fk …` (2×) has no IF NOT EXISTS (unsupported in PG) → full-file re-run fails with duplicate_object. Harmless under the versioned single-apply migration_runner; document, don't change.

**P3 — `TaskScheduleItem` omits spec §5.1 optional `source_wbs metadata?` field.**
`web/src/types/schedule-projection.ts:30-58` — heading provenance lives only on `WbsSourceHeading`; additive later, no current consumer breaks. Note for Task 1.3/1.4 integration.

**P3 — performance notes.** `wouldCycle` per-task ancestor walk → O(n·depth) (deep chains O(n²)); `materialize_tree` recursion depth = tree depth (stack on pathological depth); `fetch_task_refs` loads whole project per reparent. All fine at expected project scale; revisit only if benchmarks say so.

**Scope deviations (no defect):** plan Task 1.1 specified `backend/tests/contract/taxonomy_hierarchy.rs`; implemented at `backend/tests/taxonomy_hierarchy.rs` (top-level integration test — cargo `--test` path matches plan's commands; harmless, record it). Frontend worker created only the pure subset of Task 1.4 exclusive paths — authorized split; GraphQL/hooks/i18n/Timeline integration correctly deferred (not flagged per instructions).

## 4. Verification (fresh, this review; non-destructive; no live DB)

| Command | Result | Exit |
|---|---|---|
| `cd backend && cargo test --lib migration_runner` | `7 passed; 0 failed; 0 ignored` (incl. fingerprint-coverage + bootstrap-order invariants) | 0 |
| `cargo test --test taxonomy_hierarchy` | `5 passed; 0 failed; 1 ignored` (live-PG test ignored) | 0 |
| `cargo test --test taxonomy_migration` | `4 passed; 0 failed; 1 ignored` (live-PG test ignored) | 0 |
| `cargo check --all-targets` | `Finished dev profile … in 0.36s` (pre-existing warnings only) | 0 |
| `cd web && npx jest --config jest.config.js --reporters default -- src/lib/scheduling/__tests__ src/components/timeline/__tests__/schedule-mode-control.test.tsx --runInBand` | `Test Suites: 3 passed, 3 total · Tests: 22 passed, 22 total` | 0 |
| `cd web && npx tsc --noEmit` | 305 errors total, **0** matching owned paths (`src/lib/scheduling`, `src/types/taxonomy.ts`, `src/types/schedule-projection.ts`, `ScheduleModeControl/PhaseScheduleRow/WbsSourceHeadingRow`) | 1 (baseline) |

Live-PostgreSQL tests were NOT re-run (would need `.env` DB credentials — out of bounds). Worker's live-PG claims (trigger seeding, 23503 FK rejection, reparent phase-preservation, Unphased archive) are consistent with the pure code and constraints I verified statically, but remain worker-attested.

## 5. Baseline vs introduced

- All 305 tsc errors and the repo-wide dirty state (`.claude/.opencode` deletions, `M` auth/apollo/formatting files) are **pre-existing baseline**, untouched by both slices; no introduced failure found in any owned path.
- All focused backend and frontend suites green on the current combined dirty tree → no regression introduced by these changes into existing build.

## 6. Verdict

**ACCEPT** — for the assigned slices (backend Task 1.1, frontend Task 1.4 pure projection). Spec matrix fully PASS; no P0/P1; the single P2 is latent in an unmounted service path outside this slice's reachable behavior and does not block Task 1.1's stated acceptance ("no phase row has task/schedule semantics and parent changes do not alter phase/category" — both hold).

**Mandatory next actions (blocking gates for Task 1.3 mounting, not for this review):**
1. Add `target == phase_id` guard + pure test in `archive_phase` (P2) BEFORE mounting `TaxonomyMutation`.
2. Replace `take_tree`'s `expect` with corrupt-data-safe handling before Increment 1 ships to any legacy DB.
3. Recommended with 1.3: move reparent validate+update into one locking transaction (P3 TOCTOU).
4. Task 1.3 must remove the `lib.rs` compile gate in favor of real `pub mod taxonomies;` mounting + mounted resolver behavior tests + regenerate `schema.graphql`/contract tests.
5. Frontend: record `source_wbs` field decision and Unphased i18n key owner in the 1.3 handoff (unresolved questions 1-3 of pm-gantt-pure-impl-1 remain open for integration).
