# Final Review — herdr-260906-plan-deploy rework

Scope: rework only (P0-P2 blockers from `reports/review.md`). Read-only + this file. Independent runtime re-verification performed on a fresh isolated Postgres 14 (initdb trust auth, /tmp cluster, destroyed after).

## VERDICT: **PASS — SAFE TO DEPLOY**

## Blocker re-verification (all runtime-confirmed)

| Prior finding | Fix verified | Evidence |
|---|---|---|
| **P0-1** `"task id"` key mismatch | **FIXED** | `plan_lifecycle.rs:277-284` validates `taskId` (+ UUID check); `:399` recalc extracts `taskId` — matches client `planLifecycle.ts:116,194` and tests. Runtime: `herdr_flow` PASSED end-to-end incl. save/recalc round-trips |
| **P1-1** false-positive report claims | **FIXED** | Re-ran exact P0 command myself on fresh isolated PG: `herdr_flow: ALL DB ROUND-TRIP ASSERTIONS PASSED`, `1 passed; 0 failed`; `cargo test --test contract` → `28 passed; 0 failed`. Claims now match the tree |
| **P2-1** fingerprint blind to UPDATEs | **FIXED** | New migration `20260906000002_fingerprint_update_detection.sql`: adds `updated_at` + BEFORE UPDATE touch triggers to `member_days_off`/`resource_groups`/`recurring_commitments`/`resource_group_members`; all 7 categories now `max(updated_at)` (`plan_lifecycle.rs:129-153`). Test does a literal IN-PLACE `UPDATE` of a day-off row and asserts `stale=true` (`herdr_flow.rs:456-461`) — passed |
| **P2-2** NEW_REVISION from historical plan 500s | **FIXED** | NewRevision branch now deactivates **all** actives in the project (`plan_lifecycle.rs:547` `WHERE project_id = $1 AND is_active`), not just the target row. Test branches from an inactive revision, asserts clean success + correct `parent_plan_id` (`herdr_flow.rs:472-481`) — passed |
| **P2-3** unbounded payload | **FIXED** | `SNAPSHOT_MAX_BYTES = 512 KiB`, `SNAPSHOT_MAX_TASKS = 5_000` (`plan_lifecycle.rs:237-238,263-271`), name 1..=255 chars (`:478`), `hoursPerDay` finite 0..=24 + `yyyy-MM-dd` date-key validation (`:286-310`). Negative tests in `herdr_flow.rs:506+` — passed |
| **P2-4** concurrent saves → raw 500 | **FIXED (mapped)** | Unique-violation 23505 mapped to friendly retry error (`plan_lifecycle.rs:37-48`); same-row saves serialized via `FOR UPDATE` (`:511`). Concurrent-save test asserts no raw DB error + exactly one active plan (`herdr_flow.rs:499-504`) — passed |
| **P3-2** snapshot ids unscoped | **FIXED** | Save validates every `taskId` against non-deleted tasks of the same project via `jsonb_array_elements` (`plan_lifecycle.rs:454-474`, "do not belong to this project" error); out-of-scope negative tested — passed |

## applied=14 vs "13"
- Rework section (`implementation.md:60`) says `applied: 14` — **correct**: 14 migrations on disk; my fresh run printed `BootstrappedFresh { applied: 14 }` (14th = `20260906000002_fingerprint_update_detection.sql`).
- `implementation.md:85` still says "13/13 fresh" — **stale remnant of the pre-rework summary section**, not the rework claim; pre-rework there were 13 migrations, so both numbers were true at their time. Cosmetic doc nit only (P3): suggest striking the stale line or annotating "pre-rework".

## Residual notes (non-blocking, P3)
1. `saved_plans` still runs 7 fingerprint queries per row (7R+1 per list) and returns full `plan_data` blobs per revision (`plan_lifecycle.rs:356-366`) — perf drifts as revision chains grow; acceptable at current scale.
2. Migration 02 adds `NOT NULL DEFAULT now()` (volatile default → rewrite of those 4 tables on a populated DB). They are small config tables; safe, but expect a brief write-lock during migration.
3. Migration 01's non-concurrent `CREATE INDEX` on `tasks` still briefly blocks writes on large tables (unchanged from prior review; maintenance-window item).
4. Web jest suites (123/123) and tsc claims were NOT re-run by this review (time-boxed); they are unaffected-surface claims and the deploy pipeline masks tsc anyway (`next.config` `ignoreBuildErrors`).
5. Backend compiles and the full DB round-trip + contract suites pass against the exact final tree — deploy-blocking gates cleared.

## Exact validation performed
- `TEST_DATABASE_URL=postgres://pgtest@localhost/herdr_flow_test?host=/tmp/pmrev2&port=55508 cargo test --test herdr_flow -- --nocapture` → `applied: 14`, `ALL DB ROUND-TRIP ASSERTIONS PASSED`, `1 passed; 0 failed`
- Same URL `cargo test --test contract` → `28 passed; 0 failed`
- Static inspection of `plan_lifecycle.rs` (validation, fingerprint, revision/concurrency, authz unchanged-and-correct), `20260906000002` migration, `herdr_flow.rs` new assertions, `implementation.md` rework section
- Ephemeral cluster stopped (`pg_ctl stop -m fast`) and deleted; no project files, real DBs, credentials, or remotes touched

**Bottom line: PASS. All P0-P2 blockers from review.md are fixed and independently runtime-verified on the final tree. Safe to deploy.**
