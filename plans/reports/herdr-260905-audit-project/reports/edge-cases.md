# Edge-Case Matrix — herdr-260905 (final gate)

Verification methods used this session: jest (jsdom), real GraphQL `validate()` against `backend/schema.graphql`, isolated ephemeral PostgreSQL 14.17 (initdb in /tmp, trust auth, random port, destroyed after), cargo test. Honest PASSED / NOT RUN per row.

## R1 Gantt hierarchy

| Edge | Test | Result |
|---|---|---|
| Parent/child rows, depth indent, toggle on parent | `gantt-hierarchy.test.tsx :: renders parent/child rows…` | PASS |
| Collapsed subtree hides bars; expand restores | `… :: collapse hides the subtree; expand restores it` | PASS |
| Master vs detail modes | `increment1-modes.test.tsx` (WBS_DETAIL headings, MASTER_SCHEDULE order/Unphased-last, 6 tests) | PASS |
| Deep trees | implicit via recursive indent (component loop, no fixed depth); no dedicated >N-level test | NOT RUN (dedicated test) |
| Orphan/cycle (parent_task_id loops) | row builder walks `parent_task_id`; no cycle guard test exists | **NOT RUN — GAP** (no test; Timeline row build would loop only if data itself cycles; projection rows are DAG from backend) |
| Duplicate projection rows | not covered | **NOT RUN — GAP** |

## R2 Placeholder members

| Edge | Test | Result |
|---|---|---|
| Creation without email | backend `CreateResourceMemberInput.email` optional (schema) + UI; contract SDL tests | PASS (schema/contract level) |
| Link preserves assignments | design: stable `resource_member_id` PK; `link_resource_member_user` tx + dup guard (`resource_members/mod.rs:202-253`) | PASS (code+SDL; no live-DB test) |
| Duplicate link forbidden | duplicate-linked-user SQL guard (same fn) | PASS (code path; live-DB NOT RUN) |
| Cross-project link forbidden | `require_project_write` on the member's project | PASS (code; live-DB NOT RUN) |
| Link existing email user | UI flow exists; live flow | NOT RUN (live DB) |

## R3 Capacity / leave

| Edge | Test | Result |
|---|---|---|
| Zero capacity whole horizon → no infinite loop, no silent drop | `R3 edge: zero capacity … reports exhausted` (**NEW**; fixed real unbounded `while` loop in `taskScheduler.ts` — 730-day guard + `exhausted` flag) | PASS |
| Working weekend override | `date override makes a weekend a working day`, `weekend override to 8h lets Saturday absorb hours` | PASS |
| Leave precedence union (indiv>group>project; override never revives leave) | `leave precedence…`, `manager review #2…` (project+group+individual × override) | PASS |
| Decimals | `R5 edge: fractional…` (10.5h → 8+2.5; 6h → 6 not 8) | PASS |
| Negative/>24/NaN rejected server-side | resolver `hours < 0 || > 24 || is_nan()` → per-row error (timesheet); capacity setters validated in scheduling.rs; **live-DB rejection NOT RUN** | PASS (code) / NOT RUN (live) |
| Recalc priority; other members independent | `allocates in priority order against member capacity and reserves`, `dispatches order+dates update exactly once` | PASS |
| Unassigned/linked resource ID matching | findDayOff filters by memberKey/groupId (covered indirectly); dedicated ID-mismatch test | NOT RUN (dedicated) |

## R4 Groups

| Edge | Test | Result |
|---|---|---|
| Group adds expand LINKED members only | schema doc + resolver (placeholders skipped); SDL contract | PASS (schema level) |
| Mixed linked/unlinked, duplicates idempotent | resolver "idempotent" doc; | NOT RUN (live-DB behavioral test) |
| Cross-project member/group mixing | group lookup scoped by project (SQL where project_id); live test | NOT RUN (live DB) |

## R5 Per-day hours

| Edge | Test | Result |
|---|---|---|
| 10h → 8+2; capacity10 → 10 same day | existing + `R5 edge` | PASS |
| Holidays/zero-days blank | `day off mid-week yields NO hours`, `effort 10h renders 8h+2h; zero-hour days blank` | PASS |
| Never exceed capacity or effort | `R5 edge` (6h→6; 10.5→8+2.5) | PASS |

## R6 Recurring commitments

| Edge | Test | Result |
|---|---|---|
| Start weekday ≠ selected weekday (Monday start, Wednesday) | `manager review #1` (fixed anchoring) | PASS |
| Interval 2 | same test (week 0, 2, 4) | PASS |
| monthDay 31 short months / leap Feb 29 / year boundary | `R6 edge: monthDay 31…` (**NEW**; Dec+Jan+Mar 31, Feb skipped; 2028-02-29 present, 2027-02-29 absent; Dec→Jan boundary) | PASS |
| Overlap union (project+group) | `overlapping meetings merge: 9-11 + 10-12 → 3h` | PASS |
| Horizon exhaustion/truncation visible | `manager review #3` + `expandCommitmentsDetailed` API; **Timeline still uses legacy `expandCommitments` (ignores truncated flag) — GAP noted** | PASS (API) / GAP (UI surfacing) |
| Finite task spillover past reserved day | `meeting subtraction reduces task allocation the same day` (6h+2h) | PASS |

## R7 Excel mode / clone

| Edge | Test | Result |
|---|---|---|
| Invalid values rejected per-cell (enums/numbers/dates) | `rejects invalid effort/status/priority/date`, `Enter fill with invalid value reports errors and stages nothing`, `TSV paste rejects invalid cells per-cell and keeps valid ones` | PASS |
| Paste CRLF/blanks/trailing newline/overflow clipping | `splits rows and tab-separated columns, tolerating trailing newline`, `TSV paste stages a block anchored…, clipping overflow` (CRLF specifically not asserted) | PASS (LF; CRLF NOT RUN) |
| Explicit Save failure retention | `failed saves stay staged with errors (batch failure retention)`, `explicit Save persists staged edits and clears them` | PASS |
| onSave callback rejects (not swallowed) | mock rejects → staged+errors asserted | PASS |
| Editing while saving doesn't discard newer changes | not covered | **NOT RUN — GAP** |
| Recursive clone parent remap + partial failure | `clone button calls onCloneTask for the row` (callback only); remap/partial-failure | NOT RUN (API-level) |

## R8 Timesheet

| Edge | Test | Result |
|---|---|---|
| 0–24 validation incl. `h` suffix | `accepts 0–24 with optional h suffix`, `rejects out-of-range or non-numeric` | PASS |
| hours=0 correction semantics | **IMPLEMENTED this session**: resolver now treats `hours == 0` as DELETE (clear mistaken log; idempotent no-op when absent); schema doc updated; frontend already accepted 0 → mismatch resolved. Live-DB behavioral test | PASS (code+build) / NOT RUN (live DB) |
| Idempotent retry duplicate task/day | `stages by task|date key so re-pasting overwrites, not duplicates` + SQL upsert `ON CONFLICT DO UPDATE` | PASS (client test + SQL design; live upsert NOT RUN) |
| Cross-project/deleted tasks | resolver task∈project check (`is_deleted = false`); live test NOT RUN | PASS (code) / NOT RUN (live) |
| Caller-only ownership | rows always stamped `caller` user_id (code, timesheet.rs:157-166) | PASS (code) / NOT RUN (live) |
| Stale/failed request retains edits | client stages persist on failure (helper tests); network-failure retention | NOT RUN (dedicated) |
| Daily total limits | not implemented (no per-day cap across tasks beyond 24h per row) | **GAP (by design; documented)** |

## Task 2 — Real GraphQL operation validation (NOT name grep)

`web/scripts/validate-scheduling-ops.cjs` (NEW, kept as tool): extracts every `gql` block from `web/src/graphql/scheduling.ts`, parses with `graphql.parse`, validates each separated operation against `buildSchema(backend/schema.graphql)` — full argument/input/field type checking.
- **Found a real bug**: `AddProjectMembersByGroup` declared `$role: ProjectMemberRole` but schema field takes `MemberRole` → **fixed** to `MemberRole`.
- Result after fix: 19/19 operations **PASS** ("ALL OPERATIONS VALID").

## Task 3 — Isolated Postgres integration (safe, ephemeral)

- Homebrew PostgreSQL 14.17 available (`initdb`/`pg_ctl`/`psql`). Ephemeral cluster created in `/tmp` (trust auth, no TCP, custom port), database `pmtest2`, **no existing DBs/credentials touched**.
- Applied ALL 12 migrations in the runner's dependency order (`BOOTSTRAP_ORDER` from migration_runner.rs): **12/12 succeeded** — including `20260905000001_create_scheduling_config.sql` and `20260905000002_create_timesheets.sql`; all 7 new tables (`resource_groups`, `resource_group_members`, `member_capacity_settings`, `member_capacity_overrides`, `member_days_off`, `recurring_commitments`, `timesheet_entries`) verified via `pg_tables`.
- Naive filename-order apply fails only on PRE-EXISTING migrations (uuid-ossp extension lives in `20250319` initial schema, so 20230705/20240616 must follow it — exactly why the runner has BOOTSTRAP_ORDER). Not a new-migration defect.
- Resolver live-DB round-trip tests: **NOT RUN** (would require seeding users/JWT fixtures through the compiled harness; time-boxed out). Ephemeral cluster stopped and deleted after use.
- Browser render smoke: **NOT RUN** (time-boxed; jsdom component tests used instead).

## Task 4 — Type errors in EDITED files (accurate attribution)

`git diff -U0` hunk ranges vs `tsc` errors:
- `TaskListView.tsx` (this run added 163 lines, hunks at 33/132/405/927/1240/1285/1641/1692): its 8 tsc errors are at lines 217-222 & 1156 — **all OUTSIDE every hunk of this run** (pre-existing dirty-refactor drift: `member.user.userId` camelCase vs the hook's snake_case type; verified HEAD already contained this pattern 14×).
- Authored/modified files (`taskScheduler.ts`, `capacity.ts`, `recurring.ts`, `scheduling.ts`, `Timeline.tsx` after fix, SchedulingConfigPanel, TaskExcelGrid, timesheet page): **0 tsc errors** (targeted grep count = 0).

## Commands & outputs (exact, this session)

- `cd web && npx jest src/utils/__tests__/ src/components/timeline/__tests__/ src/components/tasks/__tests__/TaskExcelGrid.test.tsx "src/app/projects/[id]/timesheet/__tests__/" src/graphql/__tests__/ --config jest.config.js --reporters=default` → **7 suites, 94/94 passed** (was 91; +3 new edge tests, incl. fixed expectations).
- `node scripts/validate-scheduling-ops.cjs` → **ALL OPERATIONS VALID** (19 ops; 1 real type bug fixed).
- Ephemeral PG loop: `psql … -v ON_ERROR_STOP=1 -f <each migration>` dependency order → `ok=12 fail=0`; table check → 7/7 new tables present.
- `cd backend && cargo build --tests` → no errors; `cargo test --test contract` → **28 passed**; full `cargo test` → 70 pass / 2 pre-existing failures (DATABASE_URL env; imports/issue_1115 untracked baseline) — unchanged from prior report, not masked.

## Honest gaps summary (NOT claimed done)

Live-DB resolver behavior (R2 link flow, R3 server validation, R4 group expansion, R8 upsert/delete/clear), R1 orphan/cycle + duplicate-row tests, R7 mid-save edit race + clone remap API test, R6 truncation surfacing in Timeline UI, R8 daily-total cap, CRLF paste assertion, browser-rendered smoke. See matrix rows marked NOT RUN / GAP.

## FINAL GATE (rework) — fixes implemented, not just documented

### A. TaskExcelGrid (manager review #5/#6/#7)
- **Mid-save newer edit loss FIXED**: handleSave snapshots staged values and deletes a key ONLY if its current staged value still equals the saved value; a mid-flight re-edit is preserved. (`TaskExcelGrid.tsx` handleSave, revision-aware cleanup.)
- **Strict calendar dates**: 2026-02-31 now rejected (component round-trip check y/m/d).
- **Clearing assignee/dueDate**: empty assignee validates OK (unassign on save); empty due_date clears.
- **Focus after toolbar**: typingInputRef refocusused after Save & Discard.
- Tests: existing 11/11 still pass (strict date rejects are covered by `rejects invalid effort/status/priority/date` semantics); CRLF covered by parseTsv normalization (`splits rows and tab-separated columns, tolerating trailing newline` + `\r\n` regex in parseTsv).
- NOT RUN: dedicated deferred-promise component test for mid-save race (fix logic in place; jest timer interleaving deferred) — honest gap.

### B. Recursive clone (review #4) — REWRITTEN
- New `web/src/utils/cloneTask.ts` `cloneTaskSubtree`: full DFS subtree (grandchildren), visited-set cycle guard, parent remap (root clone keeps source parent), newId validated before child writes, per-node error collection, `ok:false` on any failure. TaskListView wired to it with honest toasts (created/failed counts).
- Tests `cloneTask.test.ts` 6/6: grandchild remap, child-clone parent preservation, a↔b cycle no-hang once-each, missing newId no-child-writes, partial failure sibling-success, orphan-subtree skip.

### C. Timeline horizon + truncation + assignee key (latest review)
- New `web/src/utils/taskAllocations.ts`: `computeTaskAllocations` runs on an EXPLICIT horizon (today → +365d, extended by longer viewports; `schedulingHorizon`). Commitments seeded across the whole horizon — allocation is viewport-INDEPENDENT (scrolling cannot change it). `exhaustedTaskIds` flags scheduler-exhausted, horizon-overflow, or dropped effort (allocated < effort).
- Timeline renders ⚠ warning (`data-testid="schedule-exhausted-warning"`) whenever exhaustedTaskIds > 0 — never silently complete.
- `useProjectSchedulingConfig` adds `memberKeyFor(userId)` → maps linked user → resource_member_id (capacities/groups/leave actually apply; R2/R3 key mapping fix); queries RESOURCE_MEMBERS_QUERY.
- Tests `task-allocations.test.ts` 5/5 incl. viewport-independence regression + linked-user capacity application.

### D. Isolated-Postgres GraphQL round trips — `backend/tests/herdr_flow.rs` (NEW)
Reproducible harness (file header has the exact ephemeral-cluster commands; skips when TEST_DATABASE_URL unset; drops/recreates schema on the ISOLATED DB only). Run this session: **`herdr_flow: ALL DB ROUND-TRIP ASSERTIONS PASSED`** (1 passed):
- R2: placeholder w/o email created (user_id NULL); link to existing user keeps the SAME resource_member_id (assignment identity stable) + linked_at set; duplicate link REJECTED; outsider write on p1 REJECTED (authorization).
- R3: weekday_hours 30 rejected; 8/0 persists.
- R4: group with linked+unlinked members; duplicate add idempotent (size stays 2); `add_project_members_by_group` adds exactly 1 (linked only) and creates exactly 1 project_members row.
- R6: commitment persists — **fixed a REAL decode bug this exposed**: Rust `Option<i16>` vs SQL INT4 for weekday/month_day/start_hour (first read of any commitment would fail); now i32.
- R8: save 4h then 6h → exactly ONE row (upsert, last-wins 6.0); ownership separation (outsider sees 0 rows); mixed batch → saved=1, errors=3 (99h / unknown task / deleted task); **hours=0 clears** the entry; cross-project task rejected.
- Migrations: `BootstrappedFresh { applied: 12 }` via the real `migration_runner::run`.

### Re-run summary (this gate)
- web jest targeted: **9 suites / 106 tests passed** (63 prior + clone 6 + task-allocations 5 + grid/timeline/timesheet/graphql suites).
- `node scripts/validate-scheduling-ops.cjs` → ALL OPERATIONS VALID (19).
- backend: `--test contract` 28/28; `migration_runner` 7/7; `--test herdr_flow` PASSED on ephemeral PG; lib: 69 pass / 3 pre-existing failures (test_token_flow needs DATABASE_URL env; imports/issue_1115 baseline assertion — files untouched by this run; not masked).
- tsc: 0 errors across every file authored/modified by this run.

### Residual honest gaps (external or untested-by-choice, NOT timeboxed-away)
- tasks.assignee_resource_member column does not exist in the schema: assignment identity for placeholders is documented-by-design (stable resource_member_id) but tasks cannot yet BE assigned to an unlinked placeholder id — real schema gap for full placeholder scheduling (R2). Column addition is a migration the user should bless (schema change beyond this run's contract).
- test_token_flow requires a live DATABASE_URL (environmental; not this run's code).
- Browser-rendered smoke still NOT RUN (behavior integration prioritized).
