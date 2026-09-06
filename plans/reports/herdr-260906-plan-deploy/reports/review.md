# Independent Pre-Deploy Review — herdr-260906-plan-deploy

Reviewer scope: latest ProjectManager changes (saved-plan lifecycle + placeholder assignment). Read-only except this file. Verdict first:

## VERDICT: **NOT SAFE TO DEPLOY — P0 blocker**

The implementation report's central verification claim is **false for the code as it exists on disk**. `cargo test --test herdr_flow` against a fresh isolated Postgres 14 cluster (reproduced by this review) **FAILS** at the first `save_plan_snapshot` call:

```
save_plan_snapshot create: [ServerError { message: "snapshot.tasks[0].task id is required", ... }]
test herdr_flow_end_to_end ... FAILED. 0 passed; 1 failed
```

The implementation report claims "exit=0, ALL DB ROUND-TRIP ASSERTIONS PASSED". It did not, against this tree. Either the tests were never run against the final code, or the file was edited after the run. All other "verified" claims in implementation.md must be treated as unverified until re-run.

---

## Findings (P0 → P3)

### P0-1 — Snapshot key mismatch: backend requires `"task id"` (with a space); client and tests send `taskId` — entire saved-plan feature non-functional
- `backend/src/graphql/resolvers/plan_lifecycle.rs:227` — `if t.get("task id").and_then(|v| v.as_str()).is_none()` → rejects every real snapshot.
- `backend/src/graphql/resolvers/plan_lifecycle.rs:319` — `plan_recalc_metadata` also extracts `t.get("task id")` → `task_ids` always `[]` → Recalculate builds an empty draft even if a snapshot existed.
- Web client writes/reads `taskId`: `web/src/utils/planLifecycle.ts:116` (snapshot build), `:194` (load validation `taskId missing`).
- Backend test sends `taskId`: `backend/tests/herdr_flow.rs:320`.
- Runtime proof: this review re-ran `cargo test --test herdr_flow` on an isolated ephemeral Postgres (`initdb` trust auth, port 55507, no real credentials) → FAILED with "snapshot.tasks[0].task id is required". Migration bootstrap itself succeeded on the fresh DB before the assertion failure.
- Impact: New Plan → Save always errors; Recalculate metadata always empty. Requirement 2 and 3 of the acceptance are broken end-to-end.
- Fix: validate/extract `taskId` (match client v2 shape) in both places; re-run herdr_flow to green before any deploy.

### P1-1 — Implementation report verification claims invalidated (false positive test evidence)
- `plans/reports/herdr-260906-plan-deploy/reports/implementation.md` — "Verification" section claims herdr_flow exit=0, and by extension confidence in contract/migration_runner/web suites. The P0 proves at least the headline DB round-trip claim is false for the shipped tree. Missing test case that would have caught it: none needed — the existing test catches it; the report simply does not reflect the code. **Missing case for the future:** assert in CI that the exact tree under review is the tree tested (untracked-file drift made this possible; all new backend files are untracked, per report's own cleanup section).

### P2-1 — Fingerprint misses UPDATEs on tables keyed by `created_at`/`added_at`
- `backend/src/graphql/resolvers/plan_lifecycle.rs:107-127` — `member_days_off` (`max(created_at)`), `resource_groups` (`max(created_at)`), `recurring_commitments` (`max(created_at)`), `resource_group_members` (`max(added_at)`).
- Any in-place UPDATE to a day-off, group, or commitment row keeps `count(*)` and `max(created_at)` identical → fingerprint unchanged → saved plan **not** marked stale after a config edit. Requirement 3's "stale marking on config drift" is incomplete for those categories. (`resource_members`, capacity, overrides correctly use `updated_at`.)
- Also note: fingerprint does not include any project-level working-days/holiday config if stored outside these 7 tables — completeness not proven by tests.

### P2-2 — NEW_REVISION of a historical (inactive) plan dead-ends in a DB unique-violation 500
- `backend/src/graphql/resolvers/plan_lifecycle.rs` NewRevision branch: `UPDATE plans SET is_active = false WHERE plan_id = $1` deactivates only the target row; if a *different* plan is the currently active one, the follow-up `INSERT ... is_active = true` violates `unique_active_plan_per_project` (`backend/migrations/20230705000001_create_plans_table.sql:32`) → raw `AuthError::Database` 500. User cannot branch a new revision from a prior revision (a plausible "restore old revision" flow). Test only covers the linear chain (rev1→rev2), so this path is untested.

### P2-3 — No size/shape bounds on snapshot or name
- `validate_snapshot` (`plan_lifecycle.rs:217-236`) checks only "tasks non-empty array + id string present". No cap on snapshot size, task count, `name` length, or `hoursPerDay` values. `plan_data` is JSONB — no SQL injection risk (parameterized, stored as data) — but unbounded multi-MB payloads are persisted per save and re-served verbatim by `saved_plans` for every revision. Hardening gap, not exploitable corruption.

### P2-4 — Concurrent saves surface as raw 500s (invariant survives by index, not by design)
- Two concurrent new-plan saves in one project (`plan_lifecycle.rs`, no-plan_id branch): under READ COMMITTED both pass the "deactivate actives" UPDATE, then both INSERT `is_active=true` → one gets unique-violation 500 (no retry/error mapping). Same for concurrent NEW_REVISION on different plans. FOR UPDATE does correctly serialize same-row NEW_REVISION/SAME_REVISION saves (revision numbering safe). Data stays consistent (partial unique index holds) but races produce unhandled DB errors.

### P3-1 — `saved_plans` N+1 fingerprint queries + full snapshot payloads
- `plan_lifecycle.rs` `saved_plans` → `hydrate()` per row runs 7 fingerprint queries (`config_fingerprint`) → 7R+1 queries per list call, plus `plan_data` blobs for every historical revision. Degrades as append-only chains grow.

### P3-2 — Snapshot task ids not scoped to the project
- `save_plan_snapshot` never checks that `taskId`s belong to `input.project_id`; `plan_recalc_metadata` returns them blind. Client-side `byId.get(st.taskId)` (`planLifecycle.ts:93`) filters mismatches to no-ops, so impact is low, but garbage ids persist in snapshots.

### P3-3 — Migration lock posture on populated DB
- `backend/migrations/20260906000001_plan_lifecycle.sql`: additive-only (nullable FK column, `ON DELETE SET NULL`, default backfill `revision=1`, non-concurrent `CREATE INDEX` ×2). Safe data-wise on a populated DB (no rewrite/rewrite-loss), but `CREATE INDEX` without `CONCURRENTLY` briefly blocks writes on `tasks`/`plans`; acceptable for a maintenance window, may stall traffic on a large `tasks` table. Not tested by anyone against a *populated* DB (fresh-cluster only, incl. this review).

### P3-4 — Deploy pipeline masks type errors
- `web/next.config.*`: `typescript.ignoreBuildErrors: true`, `eslint.ignoreDuringBuilds: true` — the web build will pass despite the repo-wide 307 pre-existing tsc errors, so "builds as deploy would" is true but vacuous as a safety gate.

---

## Acceptance checklist — exact validation performed

| Item | Result | Evidence / validation |
|---|---|---|
| Saved plan / new plan / recalculate semantics | **FAIL (P0-1)** | Runtime: save rejected; recalc `task_ids` extraction same broken key (`plan_lifecycle.rs:319`) |
| Persistence schema / migration safety on populated DB | PASS-with-note | Migration additive-only, FK `ON DELETE SET NULL`, applied cleanly on fresh DB 13/13 (this review's run bootstrapped before test failure); populated-DB path untested by anyone (P3-3) |
| Authorization / project scoping | **PASS** | `plan_lifecycle.rs`: `require_user` + `require_project_read` on all 3 queries; `require_project_write` on save; cross-project `plan_id` rejected (`plan does not belong to this project`); verified functions exist (`backend/src/graphql/resolvers/mod.rs:68,90`). herdr outsider/stranger authz probes ran green before the failing assertion in this review's run |
| Append vs overwrite revision races | PASS-with-notes | `FOR UPDATE` serializes same-row saves; same-row numbering safe; P2-2 (historical-plan branch 500) and P2-4 (cross-plan races → raw 500) noted |
| Config fingerprint completeness/determinism | PARTIAL | Deterministic fixed ordering — PASS; completeness gaps P2-1 (created_at-keyed tables, UPDATEs invisible) |
| Snapshot validation / size / JSON injection | PARTIAL | Shape-only validation; JSONB parameterized (no injection); no size bounds (P2-3) |
| Placeholder resource assignment compatibility | PASS (runtime-verified to failure point) | `assignee_resource_member_id` column + FK + index; same-project validation exercised; herdr placeholder round-trip + cross-project rejection + link-identity assertions all executed green in this review's run *before* the P0 failure |
| Gantt UI coexistence with old plan toolbar | PASS (static) | `Timeline.tsx:1381` mounts `PlanLifecycleBar`; legacy `create_plan` flow intact (`web/src/lib/graphql/resolvers/plan.ts`); no import/symbol conflicts found. No browser smoke (report admits same) |
| GraphQL input/schema/client match | PASS (runtime) | Live server accepted the mutation and returned a *validation* error (not schema error) → SDL, resolvers, and web ops (`web/src/graphql/scheduling.ts:312`) align; SDL has all new types/ops (`backend/schema.graphql:473,529,539,756,760,766,850,871`) |
| Changed files compile/build as deploy would | Backend: PASS (test binary compiled & ran this review); Web: PASS-vacuous (ignoreBuildErrors, P3-4) |
| Tests inspected for false positives | **FALSE POSITIVE FOUND (P1-1)** | Report's herdr_flow "PASSED" claim contradicted by runtime; web jest suites (plan-lifecycle 16, gantt-rows 6, Excel race) NOT re-run by this review (time-boxed) — treat as unverified. Missing cases: historical-plan NEW_REVISION (P2-2), fingerprint UPDATE-drift (P2-1), concurrent-save error mapping (P2-4) |
| Deployment blockers | **BLOCKED** | P0-1 alone blocks deploy; after fix, P2-1/P2-2 should be fixed or explicitly accepted before ship |

## Bottom line
**DO NOT DEPLOY.** One-line-class fix (`taskId` key at `plan_lifecycle.rs:227,319`) + green herdr_flow re-run is the minimum gate; P2-1 and P2-2 are strongly recommended pre-deploy. Implementation.md's verification section must be corrected — its headline DB round-trip claim is disproven by direct execution.

*Review artifacts: ephemeral Postgres cluster at /tmp/pmreview_pg (port 55507) used for runtime verification; no project files, real DBs, credentials, or remotes touched.*
