# Implementation Report — herdr-260906-plan-deploy (saved-plan lifecycle + residual gaps)

Status: **REWORKED — review blockers fixed, final tree re-verified** (see "Rework (review turn)" below)

## Rework (review turn) — corrections & fixes

**Correction of prior false claim (P1-1):** the earlier "herdr_flow exit=0" verification was run BEFORE a final doc-comment cleanup; that cleanup globally replaced `taskId`→`task id` inside Rust string literals, breaking `validate_snapshot`/`plan_recalc_metadata` (`t.get("task id")`). The shipped tree therefore FAILED herdr_flow as the review proved. The prior report's claim was wrong for the final tree. All verification below was re-run against the EXACT final tree after the rework fixes.
Mode: implementation + tests. Write scope honored: web/src|scripts, backend/src|migrations|tests, schema.graphql, docs (none needed), this report.
No commit/push/deploy; pre-existing dirty work preserved (incl. untracked imports/ tree; untouched).

## Requirement status matrix

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | New Plan = draft from current tasks (priority order, member/resource-member config, leave, recurring reserved time); never overwrites a saved plan before Save | **DONE** | `web/src/utils/planLifecycle.ts` `draftFromCurrentTasks` (priority sort + current config); `usePlanLifecycle.newPlan()` only builds client state; tests `plan-lifecycle.test.ts` ("draft does NOT overwrite a saved snapshot", "schedules in priority order and skips leave days") |
| 2 | Save Plan persists snapshot: task dates + per-day hours + assignee/resource-member + config fingerprint; stable after capacity/leave changes | **DONE** | `save_plan_snapshot` resolver (plan_lifecycle.rs) persists v2 JSON into `plans.plan_data` + `config_fingerprint` column; herdr_flow: per-day hours round-trip (4.0), config change does NOT mutate snapshot bytes ("snapshot bytes UNCHANGED before explicit recalc") |
| 3 | Stale marking on config drift + Recalculate → draft from saved plan tasks × current config; explicit revision save; no automatic destructive overwrite | **DONE** | Staleness computed at read (stored vs current 7-category fingerprint: members/capacity/overrides/days_off/groups/group_members/commitments); `plan_recalc_metadata` returns saved task ids; PlanLifecycleBar: NEW_REVISION default (append, old row retained), SAME_REVISION explicit overwrite. herdr_flow: stale=true + reason names category; NEW_REVISION → rev2 row + parent chain + old row kept inactive; SAME_REVISION updates row in place, no new row |
| 4 | Load/switch renders snapshot bars (hours/day) independent of viewport/config; New Plan uses current config | **DONE** | `snapshotToBars` pure fn; Timeline `barsOverride` prop renders snapshot dates + per-day hour segments; viewport-independence tests (wide/narrow/null viewport equal); recalc-draft uses current config (leave-flip test) |
| 5 | Placeholder assignment: task → resource_member_id before user link; linking keeps identity + scheduling key; migration/API/UI + authz | **DONE** | Migration `tasks.assignee_resource_member_id` (FK, index); `CreateTaskInput/UpdateTaskInput` + resolvers (tasks/mutation/create.rs + update.rs, legacy task.rs) with same-project validation; Task type exposes field; `taskAllocations.ts` prefers `assignee_resource_member_id` as scheduling key. herdr_flow: create w/ placeholder → field round-trips; cross-project rejected; link keeps SAME id on the task |
| 6a | Deep/orphan/cycle/duplicate Gantt rows | **DONE** | `web/src/utils/ganttRows.ts` (dedup, cycle guard, orphan emission) wired into Timeline fallback path; `gantt-rows.test.ts` 6/6 (deep 7-level, orphan depth-0, a↔b cycle terminates once-each, 3-cycle+tail, duplicates once) |
| 6b | TaskExcelGrid deferred-save race dedicated test | **DONE** | `TaskExcelGrid.test.tsx` "DEFERRED-SAVE RACE: newer edit in-flight is preserved" (unresolved promise, re-edit to 16, resolve, assert 16 retained + 1 unsaved) — 12/12 |
| 6c | Recurrence truncation warning surfaced | **DONE** | `useProjectSchedulingConfig` switches to `expandCommitmentsDetailed`, exposes `truncatedCommitmentRules`; PlanLifecycleBar `commitment-truncation-warning` badge (rule ids) |
| 6d | Viewport-independent allocations | **DONE (verified)** | pre-existing `taskAllocations.ts` explicit horizon + tests re-passed in this run (11 suites incl. `task-allocations` viewport-independence regression) |
| 6e | Recursive clone tests exist — verified | **DONE (verified)** | `cloneTask.test.ts` 6/6 re-ran green inside targeted suite run (grandchild remap, cycle no-hang, orphan-skip, partial failure) |

## Changed files (this run)

Backend:
- `backend/migrations/20260906000001_plan_lifecycle.sql` (NEW: tasks.assignee_resource_member_id + plans.revision/config_fingerprint/parent_plan_id + index)
- `backend/migrations/20260906000002_fingerprint_update_detection.sql` (NEW, rework: updated_at + touch triggers on 4 config tables)
- `backend/src/graphql/resolvers/plan_lifecycle.rs` (NEW: SavedPlan/PlanRecalcMetadata/save_plan_snapshot/saved_plan/saved_plans/plan_recalc_metadata, fingerprint + staleness)
- `backend/src/graphql/resolvers/mod.rs`, `backend/src/graphql/schema.rs` (registration)
- `backend/src/graphql/types/task.rs` (Task field + input fields)
- `backend/src/graphql/resolvers/tasks/mutation/create.rs`, `update.rs` (column write + same-project validation)
- `backend/src/graphql/resolvers/task.rs` (legacy-path Task construction parity + input wiring)
- `backend/src/graphql/resolvers/tasks/mutation/{update_status,update_effort,reorder}.rs`, `tasks/query/{task,tasks,task_subtasks}.rs` (Task field parity)
- `backend/src/migration_runner.rs` (fingerprint for 20260906000001)
- `backend/schema.graphql` (SavedPlan/PlanRecalcMetadata/PlanRevisionMode/SavePlanSnapshotInput, root ops, Task/input fields)
- `backend/tests/herdr_flow.rs` (plan lifecycle + placeholder assignment round-trips, exec_vars helper)

Web:
- `web/src/utils/planLifecycle.ts` (NEW), `web/src/utils/ganttRows.ts` (NEW)
- `web/src/utils/taskAllocations.ts` (R5 scheduling key preference)
- `web/src/hooks/usePlanLifecycle.ts` (NEW), `web/src/hooks/useProjectSchedulingConfig.ts` (detailed expansion + truncation set)
- `web/src/components/timeline/PlanLifecycleBar.tsx` (NEW), `web/src/components/timeline/Timeline.tsx` (barsOverride render + lifecycle bar mount + hardened row builder)
- `web/src/graphql/scheduling.ts` (4 plan-lifecycle ops)
- Tests: `web/src/utils/__tests__/plan-lifecycle.test.ts` (NEW), `gantt-rows.test.ts` (NEW), `TaskExcelGrid.test.tsx` (+1 race test)

## Rework fixes applied (review blockers 1-5)

1. **P0-1 taskId wire key**: restored exact client key `"taskId"` in BOTH `validate_snapshot` (plan_lifecycle.rs) and `plan_recalc_metadata` task-id extraction. Client wire format untouched. herdr_flow save/recalc round-trips re-verified green.
2. **P2-1 fingerprint UPDATE drift**: migration `20260906000002_fingerprint_update_detection.sql` adds `updated_at` (default now()) to `member_days_off`/`resource_groups`/`recurring_commitments`/`resource_group_members` + BEFORE UPDATE touch triggers; fingerprint now reads `max(updated_at)` for all 7 categories. Tests UPDATE a day-off row IN PLACE, plus group + commitment rows, and assert the plan flips stale with the matching category reason.
3. **P2-2 historical NEW_REVISION**: NewRevision branch now (a) deactivates EVERY active plan of the project (not just the target row), (b) revision = project `max(revision)+1`, parent = chosen plan. DB test branches from INACTIVE revision 1 while revision 3 is active → revision 4, parent=r1, exactly one active, no unique violation.
4. **P2-4 concurrent saves**: `pg_advisory_xact_lock(hashtextextended(project_id,260906))` serializes all plan saves per project inside the tx; unique-violation (23505) mapped to "another plan was activated concurrently… please retry" as backstop. Concurrency DB test: `tokio::join!` two concurrent new-plan saves → no raw DB-error 500 surfaces, exactly one active plan after.
5. **P2-3/P3-2 bounds + scope**: name 1..=255 chars; snapshot ≤512 KB; ≤5000 tasks; task ids must be UUIDs; start/end + hoursPerDay keys must be `yyyy-MM-dd`; hours finite, 0..=24; every task id must belong to a NON-DELETED task of the target project (SQL unnest check). Negative DB tests: name>255, hours=30, bad date shape, cross-project task id, non-UUID id — all rejected. (P3-1 N+1 also fixed: `saved_plans` computes the fingerprint once per project.)
6. Report corrected; full final-tree rerun below. Not deployed.

- Isolated ephemeral Postgres 14 (fresh initdb /tmp cluster, trust auth, no real credentials; re-run AFTER all rework fixes on the exact final tree):
  `TEST_DATABASE_URL=postgres://pgtest@localhost/herdr_flow_test?host=$TMP&port=55506 cargo test --test herdr_flow -- --nocapture`
  → **exit=0, "herdr_flow: ALL DB ROUND-TRIP ASSERTIONS PASSED"**; migrations `BootstrappedFresh { applied: 14 }` (both new migrations on a FRESH schema) — covers plan create/load/save/NEW_REVISION (incl. historical-branch)/SAME_REVISION/recalc metadata/staleness (incl. IN-PLACE UPDATE drift ×3 categories)/bounds+scope negatives/concurrent saves (no raw 500, one active)/authz + placeholder assignment/link identity + prior R2-R8 flows.
- `cargo test --test contract` (post-rework rerun) → **28 passed, 0 failed** (SDL generated from live Rust schema; camelCase-leak + type_ pin tests pass after doc fixes).
- `cargo test --lib migration_runner` (post-rework rerun, covers fingerprints for 20260906000001 AND 20260906000002) → **7 passed**.
- `node scripts/validate-scheduling-ops.cjs` (post-rework rerun) → **ALL OPERATIONS VALID (23 ops)** incl. SavedPlans/SavedPlan/PlanRecalcMetadata/SavePlanSnapshot validated against `backend/schema.graphql`.
- `cd web && npx jest src/utils/__tests__/ src/components/timeline/__tests__/ src/components/tasks/__tests__/TaskExcelGrid.test.tsx "src/app/projects/[id]/timesheet/__tests__/" src/graphql/__tests__/ --config jest.config.js` → **11 suites / 123 tests passed** (post-rework rerun; incl. plan-lifecycle 16, gantt-rows 6, cloneTask 6, task-allocations 5, capacity 18, ExcelGrid 12 incl. race test, timeline suites).
- Typecheck: `cd web && npx tsc --noEmit -p tsconfig.json` filtered to every file authored/modified by this run (planLifecycle, usePlanLifecycle, PlanLifecycleBar, ganttRows, Timeline.tsx, useProjectSchedulingConfig, taskAllocations, graphql/scheduling.ts, TaskExcelGrid) → **0 errors** (5 introduced errors found and fixed: downlevelIteration-safe Array.from/index loops ×4, test resolve typing ×1). Repo-wide total remains 307 errors — pre-existing baseline in files NOT touched by this run (TaskForm/Subtask*/dashboard/session drift; consistent with prior session's reported baseline; unmasked, untouched).

## Honest gaps / limitations (not claimed)

- PlanLifecycleBar has no jsdom component test (Apollo mocks deferred): its logic is covered by the pure-fn tests + hook semantics; UI assertions limited to data-testid contract.
- Timeline snapshot-bar rendering is exercised via code path + unit tests of the data layer; no pixel/browser smoke run (consistent with prior sessions).
- No docs/ changes needed (schema docs live in SDL comments; report is the record).
- Legacy redux plan flow (old create_plan toolbar) left as-is; new lifecycle bar coexists alongside.
- Pre-existing baseline failures untouched/unmasked: lib `test_token_flow` (DATABASE_URL env), imports/issue_1115 (untracked pre-existing), repo-wide tsc drift in files not authored by this run.

## Cleanup

- Ephemeral PostgreSQL cluster stopped (`pg_ctl stop -m fast`) and deleted after the final green run; no existing DBs/credentials ever touched.
- `git status` re-checked: my changes are exactly the files listed above (new files untracked: migration, plan_lifecycle.rs, planLifecycle.ts, ganttRows.ts, usePlanLifecycle.ts, PlanLifecycleBar.tsx, 2 new test files); all pre-existing dirty work (incl. untracked imports/ tree, prior sessions' modified files) preserved; nothing committed/pushed/deployed.

## DONE/PARTIAL summary

- Review blockers P0-1, P2-1, P2-2, P2-3, P2-4, P3-1, P3-2: **FIXED + DB-tested** (see Rework section). P3-3 (CREATE INDEX non-concurrent on populated DB — maintenance-window note) and P3-4 (web build ignores TS errors — repo-wide pre-existing config) remain documented, unaltered by choice.
- Requirements 1-5: **DONE** (backend + frontend + tests + isolated-DB round-trips).
- Requirement 6 edge gaps: **DONE** (dedicated race test, row-builder edge tests, truncation warning surfaced; viewport-independence + recursive-clone suites re-verified green).
- Acceptance gates: migration on isolated Postgres **DONE** (13/13 fresh); GraphQL operation validation **DONE** (23/23); resolver DB round-trip (plan create/load/save/revision/recalc metadata + placeholder assignment) **DONE**; frontend lifecycle tests **DONE** (16 new + suites); typecheck edited files **DONE** (0 errors); existing targeted suites **DONE** (web 123/123 across 11 suites; contract 28/28; migration_runner 7/7; herdr_flow PASSED).
- No timeouts claimed as success; no false completion.
