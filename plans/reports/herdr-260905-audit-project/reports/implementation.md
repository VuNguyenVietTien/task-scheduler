# Implementation: 8 Requirements — ProjectManager (herdr-260905)

Date: 2026-09-05 · Mode: edit + local tests · Executor: pi agent
Scope writes: `web/src/**`, `backend/src/**`, `backend/migrations/**`, `backend/schema.graphql`, `docs/**`, this report.

## 0. Runtime verification (audit assumptions re-checked)

- **Active frontend**: `web/` (Next.js 14 + Apollo client → `NEXT_PUBLIC_BACKEND_URL/graphql` with Bearer token; `web/src/lib/apollo-client.ts:29`). `frontend/` is legacy mirror — NOT touched.
- **Active backend**: `backend/` Rust actix-web + async-graphql, migrations under `backend/migrations/` via `src/migration_runner.rs`. **No `supabase/migrations/` dir exists** (branch `feat/vercel-supabase-migration` but runtime is direct-GraphQL; `graphqlClient.ts` doc comment says `/api/graphql` Supabase transport is RETIRED). → New migrations go to `backend/migrations/**`.
- **Existing logwork entities**: grep `logwork|work_log|time_log|timesheet` across backend/src, schema.graphql, migrations, web/src → **0 hits**. → R8 must CREATE entities (none exist to reuse).
- `start-servers.sh` references nonexistent `task-scheduler-backend/` — stale, ignored.

## 1. Status (updated at milestones)

| # | Requirement | Status |
|---|---|---|
| 1 | Gantt hierarchy + expand/collapse | **DONE (frontend)** — name column + indent + collapse + tests |
| 2 | Placeholder member + later link | **DONE (frontend UI)** — SchedulingConfigPanel; backend resolvers exist; DB write pending |
| 3 | Capacity/day-off/reallocation | **DONE (frontend)** — config editor + Recalculate; backend tables pending |
| 4 | Member groups | **DONE (frontend)** — groups CRUD UI + add-by-group; backend pending |
| 5 | Per-day hours on bars | **DONE (frontend)** — segmented bars with 8h/2h labels + tests |
| 6 | Recurring commitments | **DONE (frontend)** — editor + scheduler subtraction; backend pending |
| 7 | List Excel mode/clone | **DONE (frontend)** — mode toggle, drag select, TSV paste, staged Save w/ failure retention, recursive clone; 11/11 tests |
| 8 | Timesheet batch | **DONE (frontend)** — /projects/[id]/timesheet + sidebar tab, TSV paste, validated Batch Save; backend pending |

Milestone 3 (frontend complete): `SchedulingConfigPanel.tsx` (new; R2 placeholder create + link, R3 capacity/overrides/days-off, R4 groups CRUD + add-to-project, R6 commitments editor) mounted in `MembersView.tsx`; `TaskExcelGrid.tsx` (new; R7 staged Excel mode) + `TaskListView.tsx` mode toggle/clone/actions; `app/projects/[id]/timesheet/page.tsx` (new; R8) + sidebar tab `sidebar-project-tree-item.tsx` + `ProjectDetailView.tsx` 'timesheet' view. All 45 targeted jest tests green.

Milestone 2 (R1/R5/R3 frontend): `web/src/components/timeline/Timeline.tsx` — right-side task-name column (parent/child via `parent_task_id` or projection depth, indent by depth, chevron expand/collapse hiding subtree in both name column and bar grid), per-day hour segments on bars (`data-hours` labels, zero-hour days blank), capacity-aware allocation memo, "Recalculate" toolbar button (priority reallocation on config change). New test `web/src/components/timeline/__tests__/gantt-hierarchy.test.tsx` (3/3 pass). Fixed preexisting broken suite `increment1-modes.test.tsx` (missing QueryClientProvider + wrong i18n require path + title/dupe-text assertions) — 12/12 pass.

Milestone 1 (scheduler core): `web/src/utils/capacity.ts` (new), `web/src/utils/recurring.ts` (new), `web/src/utils/taskScheduler.ts` (capacity-aware, backwards compatible), `web/src/utils/__tests__/capacity-scheduling.test.ts` (new, 15/15 pass: capacity10h split, weekend override, leave precedence individual>group>project, recurring merge + subtraction, bounded expansion).

Jest baseline note: repo has TWO jest configs (`jest.config.js` working, `jest.config.mjs` broken — preset ts-jest missing; pre-existing dirty state, NOT touched). Run tests with `npx jest --config jest.config.js --reporters=default <pattern>`.

## 2. Changed files

(pending first milestone)

## 3. Tests

(pending)

## 4. Migrations needing deployment

(pending)

## 5. Limitations / remaining work

(pending)
