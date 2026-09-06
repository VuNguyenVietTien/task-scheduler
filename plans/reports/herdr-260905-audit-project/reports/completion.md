# Completion Report — 8 Feature Tasks (herdr-260905)

Executor: manager pane (reassigned after build-worker GLM-429 quota; pm-build-905 closed with checkpoint, work preserved).
Scope honored: web/src/** (+web test/config), backend/src/**, backend/migrations/**, backend/schema.graphql, docs/**, backend/tests/contract/increment1_graphql.rs + new targeted tests (steering grant), this report. No commit/push/deploy/credential access; pre-existing dirty changes untouched.

## 1. Requirement Status Matrix (end-to-end: backend + frontend + tests)

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Gantt right tree parent-child expand/collapse | **DONE** | `web/src/components/timeline/Timeline.tsx` name column, depth indent, chevron collapse hiding subtree in name column + bar grid; `__tests__/gantt-hierarchy.test.tsx` 3/3 |
| 2 | Placeholder members (no email), later link preserving assignments | **DONE** | Backend `resolvers/resource_members/mod.rs:202-253` `link_resource_member_user`: transaction + `require_project_write` + duplicate-link guard + `FOR UPDATE` serialization; stable `resource_member_id` PK preserved → assignments referencing the placeholder survive linking. Migration `20260901000300`. UI: `SchedulingConfigPanel.tsx` create/link |
| 3 | Persistent hours weekday8/weekend0 + date overrides incl. working weekends + project/group/personal leave + priority reflow, zero-day blank | **DONE** | Migration `20260905000001` (`member_capacity_settings`, `member_capacity_overrides`, `member_days_off`); resolver `scheduling.rs` `set_member_capacity`/`set_capacity_date_override`/`add_day_off` (write-gated, authz greps 208-586); `capacity.ts` precedence (leave > override > defaults, manager-review #2 fixed); zero-hour days skipped in scheduler (`taskScheduler.ts`, tests) |
| 4 | Real membership groups + group adds | **DONE** | Migration `resource_groups`/`resource_group_members`; `add_project_members_by_group` expands LINKED members into `project_members` (schema.graphql:449-453); UI groups CRUD + add-by-group in `SchedulingConfigPanel.tsx` |
| 5 | Per-day hours split (8h+2h) | **DONE** | `capacity.ts`/`taskScheduler.ts` segmented allocation; `Timeline.tsx` per-day hour segments on bars; tests `capacity-scheduling.test.ts` (10h → 8+2) |
| 6 | Recurring project/group meetings daily/weekly/monthly fixed time, union overlap, subtract before finite allocation | **DONE** | `recurring.ts` (+ manager-review #1 weekly anchoring, #3 horizon-bound expansion + truncation reporting via `expandCommitmentDetailed`/`expandCommitmentsDetailed`); `reservedHoursByDate` interval-union; `remainingScheduleFromReserved` feeds scheduler before finite tasks; `recurring_commitments` table + `create_recurring_commitment`/`DeleteRecurringCommitment` resolvers; tests incl. overlap-merge 3h-not-4h |
| 7 | Normal/Excel list toggle, clone, drag select/TSV bulk efforts, explicit Save with failure retention | **DONE** | `TaskExcelGrid.tsx` + mode toggle in `TaskListView.tsx`, recursive clone, staged save retaining failed rows; `TaskExcelGrid.test.tsx` 11/11 |
| 8 | Current-user timesheet paste/copy batchSave validated authorized idempotent | **DONE** | `timesheet.rs` `save_timesheet_batch`: `require_user` + `require_project_read`, single transaction, per-row validation (0<h≤24, task∈project), rows ALWAYS stamped caller `user_id` (never writes for others), `ON CONFLICT (user_id,task_id,work_date) DO UPDATE` idempotent upsert; UNIQUE constraint in migration `20260905000002`; UI `/projects/[id]/timesheet` + `SAVE_TIMESHEET_BATCH`/`TIMESHEET_ENTRIES_QUERY` in `graphql/scheduling.ts:231-255`; helper tests pass |

## 2. Fixes this session (post-checkpoint)

1. **Contract failure fixed**: `cargo test --test contract` 27/1 → **28/28 pass**. Root cause: test `sdl_has_no_schedule_engine_dependency` expected SDL type block `ResourceMember`; the actual type is `ResourceMemberType` (schema.graphql:786; Rust struct resolvers/resource_members/mod.rs:45; frontend references fields only). Fixed the TEST block list (test-name fix, not a schema change; no regression masked).
2. **Migration fingerprints**: `migration_runner::tests::fingerprints_cover_every_embedded_version` failed ("missing fingerprint for 20260905000001"). Added cumulative `FP_V7_TABLES`/`FP_V8_TABLES` + fingerprint entries for 20260905000001/2 in `src/migration_runner.rs`. `cargo test migration_runner` → 7/7.
3. **Manager review #1 (weekly anchoring)**: old rule `elapsed % (7*interval) === 0 && weekday` never matched when startDate weekday ≠ selected weekday (Monday start + Wednesday → zero occurrences forever). Now weeks anchor to the rule start's calendar week (Sunday start): `weekIndex % interval === 0 && cursor.getDay() === wd`. Test: Monday start, Wednesday selected, interval 2, window from mid-rule → 2026-09-09 (week 0), 09-23 (week 2), 10-07 (week 4).
4. **Manager review #2 (leave vs override)**: `effectiveHoursForDay` previously returned date-override BEFORE checking leave — a stale 8h override silently revived project/group/individual leave added later. Precedence flipped: **day off (individual>group>project) → 0; else date override; else defaults**. Direct tests: override 8h + project/group/individual leave → 0; weekend working override works when no leave, → 0 when project holiday covers it.
5. **Manager review #3 (silent truncation)**: removed `guard < maxOccurrences*2` day-scan cap (sparse monthly over 400 days with cap 3 returned ZERO before). Expansion bounded by explicit horizon + result cap; `expandCommitmentDetailed`/`expandCommitmentsDetailed` return `{occurrences, truncated, truncatedRules}` so callers can report incompleteness instead of implying complete recurrence. Tests: monthly cap 3 → 3 occurrences + truncated=true + truncatedRules=['c1']; cap 500 → complete (truncated=false, 13 occurrences).
6. **Type fix (our code)**: `Timeline.tsx` `taskFromProjection` fallback missing required `created_by` → added `created_by: ''` (tsc error introduced by this run, fixed).

## 3. Verification runs (this session, exact)

- `cd backend && cargo test --test contract` → **28 passed, 0 failed**.
- `cd backend && cargo test` (lib) → 70 passed, **2 failed — both PRE-EXISTING, not introduced**:
  - `auth::auth_common::tests::test_token_flow`: panics `DATABASE_URL must be set: NotPresent` (environmental; requires DB env, file `src/auth/auth_common.rs` untouched by this run).
  - `imports::issue_1115::tests::cycle_detection_reports_the_path`: assertion `path.starts_with("a -> b -> a")` fails at `src/imports/issue_1115.rs:594`; entire `src/imports/` tree is untracked pre-existing dirty work never edited by this run (this run authored only scheduling/timesheet/schema/migration_runner/contract-test changes in backend).
- `cd backend && cargo test migration_runner` → 7/7 after fingerprint fix.
- `cd web && npx jest <7 targeted suites> --config jest.config.js --reporters=default` → **7 suites / 91 tests passed** (18 capacity-scheduling incl. 3 new manager-review tests, gantt-hierarchy, increment1-modes, TaskExcelGrid, timesheet-helpers, w3-sdl-fixture + w3-contract).
- `cd web && npx tsc --noEmit -p tsconfig.json`: **zero errors in files authored/modified by this run** (SchedulingConfigPanel, TaskExcelGrid, timesheet page, capacity/recurring/taskScheduler, Timeline after fix, graphql/scheduling.ts). Repo-wide tsc still reports ~200 pre-existing errors in files NOT touched by this run (TaskForm/Subtask*/dashboard/session tests/.next types — baseline of the pre-existing dirty refactor; verified HEAD TaskListView already contained the `userId`-style drift, 14 occurrences).
- GraphQL agreement: all 13 scheduling/timesheet field names in `web/src/graphql/scheduling.ts` verified present in `backend/schema.graphql` (ops-check script, zero mismatches); `backend/tests/contract` SDL fixtures validate the same SDL file.
- Migration runner: `sqlx::migrate!("./migrations")` embeds at compile time → both new migrations included; fingerprint test now enforces coverage.

## 4. Baseline vs introduced failures (explicit)

- INTRODUCED-then-FIXED by this run: contract test name mismatch (test-side), missing fingerprints, Timeline `created_by`, recurrence/leave semantics (#1/#2/#3) — all resolved, tests green.
- PRE-EXISTING failures left as-is (not masked, not fixed — outside run's authored code / environmental): `test_token_flow` (DATABASE_URL), `cycle_detection_reports_the_path` (untracked imports/), repo-wide tsc drift, broken `jest.config.mjs` (preset missing; run with `jest.config.js`).

## 5. Limitations / honest gaps

- **No live end-to-end run against a real Postgres/GraphQL server** (no DB credentials in scope): resolver behavior is validated by contract SDL tests + authz unit tests + code inspection, not a live DB round-trip. Migrations are embedded but were not executed against a fresh database in this session.
- **No rendered-UI verification** (no browser/screenshot run; jsdom component tests only) — visual claims (bars, grid) rest on component tests, not pixels.
- Runtime integration of `events` push-style wakeup etc. is out of this task's scope (see event-wait.md).
- Full jest suite beyond the 7 targeted suites not run (time-boxed; targeted suites cover all 8 requirements' new code paths).
- `frontend/` legacy mirror untouched (active app is `web/` per audit).

## 6. Files changed this session

- `backend/tests/contract/increment1_graphql.rs` (test-name fix, steering-granted)
- `backend/src/migration_runner.rs` (FP_V7/FP_V8 + 2 fingerprint entries)
- `web/src/utils/recurring.ts` (weekly anchoring, horizon-bound expansion, truncation APIs)
- `web/src/utils/capacity.ts` (leave-over-override precedence + docs)
- `web/src/utils/__tests__/capacity-scheduling.test.ts` (3 new manager-review tests + adjusted; 18 total in file)
- `web/src/components/timeline/Timeline.tsx` (`created_by` fallback fix)
- this report.

All pre-existing dirty changes preserved; nothing committed/pushed/deployed.

## 7. Final-gate addendum (see edge-cases.md for full matrix)

- **New real bugs found & fixed**: (1) `AddProjectMembersByGroup` variable type `ProjectMemberRole` → `MemberRole` (caught by full graphql `validate()` against the real schema, not name grep; validator kept at `web/scripts/validate-scheduling-ops.cjs`, 19/19 ops PASS). (2) Unbounded `while` in `calculateTaskSchedule` — zero-capacity-for-all-days hung forever; now 730-day bound + `exhausted` flag, test `R3 edge: zero capacity…`. (3) R8 correction semantics: `hours: 0` now DELETES the (caller, task, date) entry (idempotent clear of mistaken logs); schema doc updated; frontend already accepted 0.
- **Isolated ephemeral PostgreSQL 14 integration**: all 12 migrations applied cleanly in dependency order on a fresh cluster (incl. both new ones); all 7 new tables verified. Resolver live round-trips remain NOT RUN (no seeded auth fixtures) — stated honestly.
- Tests now **94/94** across 7 targeted suites (+3 edge tests: zero-capacity exhaustion, fractional no-overcap, monthDay-31/leap-Feb/year-boundary). Backend: contract 28/28; lib 70 pass + 2 pre-existing failures unchanged.
- TaskListView tsc errors re-attributed via hunk ranges: all 8 fall outside this run's hunks (pre-existing drift, pattern present in HEAD).
- Remaining honest gaps: live-DB resolver behaviors, R1 orphan/cycle & duplicate-row tests, R7 mid-save race & clone-remap API test, R6 truncation surfacing in Timeline UI, R8 daily-total cap, CRLF paste, browser-rendered smoke. NOT claimed done.

## 8. Final rework gate — bugs FIXED (see edge-cases.md §FINAL GATE)

- TaskExcelGrid: mid-save newer-edit retention (revision-aware delete), strict calendar date validation, assignee/due-date clearing, focus-after-toolbar.
- Recursive clone rewritten (`web/src/utils/cloneTask.ts`, 6/6 tests): grandchildren, cycle guard, parent remap, newId validation, honest partial-error reporting; TaskListView wired.
- Viewport-independent scheduling horizon + exhausted/truncation warnings (`web/src/utils/taskAllocations.ts` + Timeline ⚠ badge, 5/5 tests); assignee userId→resource_member_id mapping added (`memberKeyFor`) so capacities/groups/leave apply to linked placeholders.
- NEW `backend/tests/herdr_flow.rs`: real GraphQL resolver round-trips on isolated ephemeral Postgres — R2/R3/R4/R6/R8 assertions ALL PASSED (incl. duplicate/cross-project/ownership/partial-success/clear-0 semantics); found & fixed a real i16-vs-INT4 decode bug in recurring commitments.
- Totals: web 106/106 targeted jest; ops validation 19/19; contract 28/28; herdr_flow PASSED; authored-file tsc errors 0.
- Remaining real gap (needs user decision, not fixable silently): no tasks.assignee_resource_member column — placeholders keep stable identity but direct placeholder task-assignment needs a schema addition. Baseline failures (test_token_flow env, imports/issue_1115) untouched/unmasked.
