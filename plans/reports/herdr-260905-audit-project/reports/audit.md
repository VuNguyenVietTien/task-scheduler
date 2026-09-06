# Audit: 8 Requirements — ProjectManager (herdr-260905)

Date: 2026-09-05 · Mode: read-only · Auditor: pi agent (audit run)
Scope root: `/Users/TienVNV/Desktop/ProjectManager` (secrets/.env/keys, deps, .git contents excluded)

## 1. Inventory: Application Roots & Git Status

| Root | Type | Role |
|---|---|---|
| `web/` | Next.js 14 + Apollo + MUI (`package.json` name `task-scheduler`) | **Primary frontend** — all 8 requirements live here (`web/src/app`, `web/src/components`, `web/src/utils/taskScheduler.ts`) |
| `backend/` | Rust / Actix-web + async-graphql | **Primary backend** — `schema.graphql`, `src/graphql/resolvers/*`, `src/scheduling/projection.rs` |
| `frontend/` | Older Next.js copy | Legacy mirror of `web/` (not authoritative; kept in sync historically) |
| `design-doc-service/` | Rust | Auxiliary design-doc service (out of scope for these 8 reqs) |
| `task-scheduler-frontend/` | empty dir | Dead/stub |
| `docs/`, `plans/`, `rule/` | markdown | Docs & plans |

Docs read: root `AGENTS.md`, `web/AGENTS.md`-equivalent `CLAUDE.md`, `docs/README.md`, `web/README.md`. Rules: `.claude/rules/*` referenced by ProjectManager AGENTS.md.

Git status (branch `feat/vercel-supabase-migration`, HEAD `4057a01f`):
- **155 modified** (backend auth/db/graphql wide refactor, `backend/schema.graphql`, web src)
- **1959 deleted** (mostly archived `.claude/agents` + `commands-archived` cleanup)
- **69 untracked** (incl. `.pi/`, `tools/`, plans)
- No changes staged/committed by this audit; all pre-existing changes preserved.

## 2. Requirements Matrix

| # | Requirement | Verdict | Key Evidence |
|---|---|---|---|
| 1 | Gantt right-column parent/child hierarchy + expand/collapse | **PARTIAL** | `web/src/components/timeline/Timeline.tsx:86,689-716`; `WbsSourceHeadingRow.tsx:21-25`; no collapse toggle |
| 2 | Member creation w/o email/account; later link to user preserving assignments | **PARTIAL** (backend done, UI missing) | `backend/schema.graphql:99-105,353,358,620-634`; `web/src/graphql/__tests__/w3-*.test.ts` only |
| 3 | Per-user daily capacity 8h weekday/0h weekend; days off; reallocation; no bar on 0-days | **PARTIAL** (global defaults only) | `web/src/utils/taskScheduler.ts:8,214-219,228-249` |
| 4 | Add project members by group | **MISSING** (schema stub only) | `schema.graphql:103-105,631-633` (`member_kind` GROUP "classify only") |
| 5 | Per-day taskbar hour split (10h → 8h + 2h) | **PARTIAL** (math yes, visual no) | `taskScheduler.ts:246-249`; `TaskBar.tsx:85` single bar |
| 6 | Estimated finite + recurring meeting tasks occupying fixed daily time; subtract from capacity | **MISSING** (finite only; zero recurrence) | grep `recurr|recurrence` = 0 hits in `web/src` + `backend/src`; `backend/src/scheduling/projection.rs:9` |
| 7 | List view clone task + normal/Excel bulk-edit modes (drag-select, bulk effort, explicit Save) | **PARTIAL** (inline edit + CSV export; no clone/Excel mode/Save) | `TaskListView.tsx:694-736,802-840,941,1282`; `TaskBulkActions.tsx:6-7` |
| 8 | Timesheet bulk copy/paste + batch Save | **MISSING** | grep `timesheet` = 0 hits repo-wide (src) |

## 3. Detailed Findings (file:line evidence)

### R1 — Gantt hierarchy in RIGHT column with expand/collapse — PARTIAL
- Gantt tab route works: `web/src/components/projects/ProjectDetailView.tsx:23-26` (`ViewType = 'list'|'kanban'|'gantt'|...`), `:353` (`activeView === 'gantt' && <Timeline/>`); tab URL sync `:39-45`.
- Hierarchy rows exist via schedule projection: `Timeline.tsx:86` row type `{kind:'TASK'; task; depth}`, `:689-716` builds `WBS_DETAIL` rows (SOURCE_HEADING + depth'd tasks) and `MASTER_SCHEDULE` phase groups (tasks at `depth:1`).
- Depth indentation only for headings: `WbsSourceHeadingRow.tsx:25` `paddingLeft: depth*20px`; task name cells get **no depth indent** (TASK branch of render, `Timeline.tsx:~1515-1610`, renders bars without indented labels).
- **Gap:** no expand/collapse state anywhere (`grep expand|collapse|chevron` in `components/timeline/*` → only date-range "auto-expand" `Timeline.tsx:214-263`). Parent/child data exists (`parent_task_id` in `CreateTaskInput`, `schema.graphql:~113`; subtask UI `components/tasks/SubtaskList.tsx`) but is not rendered as a collapsible tree in the gantt column.

### R2 — Member without email/account + later linking — PARTIAL
- **Backend DONE:** `backend/schema.graphql:99-105` `CreateResourceMemberInput { project_id, display_name!, email (optional), member_kind }`; `:353` `create_resource_member`; `:358` `link_resource_member_user(resource_member_id, user_id)`; `:620-634` `ResourceMemberType { email: String; user_id: ID (nullable, "NULL while placeholder"); linked_at }`. Resolver: `backend/src/graphql/resolvers/resource_members/mod.rs`.
- Legacy account-bound path still default: `schema.graphql:1-5` `AddProjectMemberInput { user_id: ID! }`; `backend/src/graphql/resolvers/members/mutation/add_by_email.rs`; `backend/src/db/models/member.rs:7-13` `ProjectMember.user_id: Uuid` (non-null).
- **Gap (UI):** `web/src` references resource members only in tests (`web/src/graphql/__tests__/w3-sdl-fixture.test.ts`, `w3-contract.test.ts`). `components/projects/MembersView.tsx` has no create-placeholder/link flow. Assignment preservation on link is not implemented (no resolver logic carrying task `assignee_id` from resource_member → user_id).

### R3 — Capacity defaults, days off, reallocation, zero-day suppression — PARTIAL
- `web/src/utils/taskScheduler.ts:8` `WORK_HOURS_PER_DAY = 8`; `:214-219` weekend days skipped (`isWeekend` → continue) = 0h; `:228-233` default 8h/day unless `updatedSchedule[dateStr]` set; `:237-239` `availableHoursInDay <= 0` → day skipped entirely (no hours allocated → no taskbar segment).
- **Gap:** `WorkSchedule` is an ephemeral in-memory map, default `{}` (`taskScheduler.ts:185`). No per-user capacity field (no `daily_capacity` in `backend/schema.graphql`), no individual/project/group day-off entities (grep `day_off|days_off|holiday` = 0), no persistence, no reallocation trigger on capacity change. Backend explicitly defers: `backend/src/scheduling/projection.rs:9` "NO dependency on capacity/allocation/meeting/schedule-engine tables"; `schema.graphql:361,588` "no capacity semantics (Increment 3)".
- Priority-based reflow exists independently: drag reorder sets `priority_order` + `force_recalculate` (`Timeline.tsx:717-780`), but is date-order reflow, not capacity-driven.

### R4 — Add members by group — MISSING
- Only stub: `member_kind: "MEMBER | COMPANY | GROUP. Companies/groups classify only"` (`schema.graphql:103-105`, `:631-633` — "Only MEMBER is assignable"). GROUP is a classification label, not a set of users to expand.
- No user-group/team entity anywhere (`grep user_group|UserGroup|member_group` = 0). Member mutations `bulk_update.rs`/`bulk_remove.rs` operate per-member roles, not group adds. No UI.

### R5 — Per-day taskbar hours (10h → 8h then 2h) — PARTIAL
- Scheduler math: `taskScheduler.ts:246-249` `hoursForThisDay = Math.min(remainingEffort, availableHoursInDay)`; `hoursPerDay` map records per-day split; `:130` caps at 8h/day.
- Visual: `TaskBar.tsx:85` renders ONE continuous rounded bar; `Timeline.tsx:1515-1610` computes bar span from `totalDays` — no per-day segmentation, no "8h | 2h" split rendering, no overflow annotation.
- **Gap:** computed but never displayed. A split bar (solid 8h cell + hatched/shortened 2h cell) is unimplemented.

### R6 — Recurring meetings + commitments subtracted from capacity — MISSING
- Finite estimated tasks: DONE (`effort: Float` `CreateTaskInput` `schema.graphql:~120`; `calculateTaskSchedule` consumes effort).
- Recurrence: grep `recurr|recurrence` across `web/src` + `backend/src` = **0 results**. No daily/weekly/monthly fields, no meeting entity, no fixed-time-block model.
- Commitment subtraction: `WorkSchedule` subtraction exists generically (`taskScheduler.ts:250-252` decrements day capacity) but is sequential single-project, not per-person across project/group meetings; no meeting source feeds it.

### R7 — List view clone + Excel bulk-edit — PARTIAL
- Inline editable cells: `TaskListView.tsx:694-736` (effort cell w/ `h` suffix display), `:941` `handleSaveEditing`, `:1003-1019` effort persist via `updateTaskEffort` Redux/GraphQL; status/priority/assignee/due cells `:1282,501,609,665`.
- Bulk actions: `TaskBulkActions.tsx:6-7` (bulk status/priority selects), `TaskListView.tsx:802-806,840` handlers.
- CSV export (one-way): `TaskListView.tsx:815-830` `handleExport`.
- **Gap:** no task clone/duplicate (`grep clone|duplicateTask` → unrelated hits only); no "Excel mode" (no drag-select cell range, no staged edits + explicit Save — every cell edit fires immediately); no paste/import from Excel.

### R8 — Timesheet — MISSING
- grep `timesheet|time_sheet` across `web/src` + `backend/src` = **0 results**. No model, resolver, page, or grid. Copy/paste input and batch Save do not exist.

## 4. End-to-End Gap Map

| Req | UI (web/src) | API (backend resolvers) | Schema (schema.graphql / DB) | Scheduler |
|---|---|---|---|---|
| 1 | Hierarchy rows render, **no collapse chevron/indent for tasks** | projection provides WBS rows | — | projection rows ordered, no visibility tree |
| 2 | **No UI** | create/link resolvers exist | resource_member tables exist | — |
| 3 | No capacity/day-off config UI | **No capacity endpoints** | **No capacity/day_off tables** | defaults 8h/weekend-0 + skip-0-days done; per-user config absent |
| 4 | No UI | no group-expansion mutation | member_kind GROUP classify-only stub | — |
| 5 | **No split-bar rendering** | — | — | hoursPerDay split computed |
| 6 | No recurrence UI | no recurrence resolvers | **no recurrence/meeting tables** | no commitment source |
| 7 | Inline edit + CSV out; **no clone, no Excel mode/Save** | update per-field exists | — | — |
| 8 | **Nothing** | **Nothing** | **Nothing** | — |

## 5. Proposed Implementation Ownership (write-file plan)

**R1 (frontend only):** edit `web/src/components/timeline/Timeline.tsx` — add `expandedRowKeys` state + chevron toggle in TASK name cells; indent by `row.depth`; filter collapsed children in `scheduleGridRows` (line ~681). Test: `cd web && npx jest components/timeline/__tests__/increment1-modes.test.tsx` + new `gantt-hierarchy.test.tsx`.

**R2 (frontend + small backend):** new `web/src/hooks/useResourceMembers.ts` + `web/src/graphql/resource-members.ts` (mutations exist in SDL); edit `web/src/components/projects/MembersView.tsx` — "Add placeholder member" form (display_name only) + "Link to user" dialog. Backend: extend `resource_members/mod.rs` link resolver to reassign `tasks.assignee_id` from placeholder to user atomically. Tests: `cargo test -p backend resource_members`; `npx jest graphql/__tests__/w3-contract.test.ts`.

**R3 (full stack):** new tables `user_capacity_overrides(user_id,date,hours)`, `days_off(scope: individual|project|group, ...)`, migrations in `backend/migrations/`; resolvers `backend/src/graphql/resolvers/capacity/mod.rs`; extend `scheduling/projection.rs` to emit per-user capacity; frontend `web/src/hooks/useCapacity.ts` + capacity tab in `MembersView.tsx`; feed `WorkSchedule` in `taskScheduler.ts:185` from GraphQL instead of `{}`; on capacity mutation, re-run `updateTasksWithDates` (priority_order asc) — reuse `Timeline.tsx:717-780` recalc path. Tests: `cargo test capacity`; `npx jest utils/taskScheduler` (extend existing).

**R4 (backend + UI):** add `add_project_members_by_group(group_id, role)` resolver expanding GROUP-kind resource member or user-group into `ProjectMember` rows in one transaction; UI button in `MembersView.tsx`. Tests: `cargo test members_by_group`.

**R5 (frontend only):** edit `Timeline.tsx` TASK bar render (~line 1515): when `hoursPerDay[lastDay] < WORK_HOURS_PER_DAY`, render final day cell as narrower/hatched segment labeled `2h`; pass `hoursPerDay` (already returned by `calculateTaskSchedule`, `taskScheduler.ts:270`) into `TaskBar`. Test: new `components/timeline/__tests__/taskbar-split.test.tsx`.

**R6 (full stack):** new `recurrence_rules(task_id, freq: daily|weekly|monthly, interval, weekday_mask, time_block)` + `meeting_occurrences` tables; resolvers under `backend/src/graphql/resolvers/recurrence/`; projection expands occurrences into `WorkSchedule` commitments per assignee BEFORE task allocation; frontend: recurrence editor in `components/tasks/TaskForm.tsx`. Tests: `cargo test recurrence`; scheduler unit test asserting 2h meeting reduces task hours that day.

**R7 (frontend only):** refactor `TaskListView.tsx` grid into two modes: `normal` (current) and `excel` (staged `Map<taskId,field,value>` + drag-range selection via mouse cell anchors + explicit Save button batching `updateTaskEffort`/`updateTask` calls); add `cloneTask(taskId)` in `web/src/hooks/useTasks.ts` calling new backend `clone_task` resolver (copy task + subtasks, reset status). Tests: `npx jest components/tasks/__tests__` + new excel-mode.test.tsx.

**R8 (full stack):** new `timesheet_entries(user_id, task_id, date, hours)` table + CRUD resolvers; new page `web/src/app/projects/[id]/timesheet/page.tsx` with grid supporting `onPaste` (parse clipboard TSV) into staged buffer + single "Batch Save" mutation `save_timesheet_batch(entries:[...]!)`. Tests: `cargo test timesheet`; jest paste-parse util test.

## 6. Meaningful Test Commands (current suite, runnable now)

```bash
cd /Users/TienVNV/Desktop/ProjectManager/web && npx jest components/timeline/__tests__/increment1-modes.test.tsx
cd /Users/TienVNV/Desktop/ProjectManager/web && npx jest graphql/__tests__/w3-contract.test.ts   # resource-member SDL contract
cd /Users/TienVNV/Desktop/ProjectManager/web && npm test                                          # full jest suite
cd /Users/TienVNV/Desktop/ProjectManager/backend && cargo test resource_members
cd /Users/TienVNV/Desktop/ProjectManager/backend && cargo test schedule_projection
```

## 7. Unresolved Questions
1. R1: "RIGHT column" interpreted as the gantt task-name/row column adjacent to bars — confirm if a separate right-hand tree panel (chart-left/list-right) was intended instead.
2. R2: should placeholder members be assignable to tasks today (assignee_id → resource_member_id), or only after linking?
3. R3: do "group days off" refer to `member_kind: GROUP` placeholders, or a not-yet-existing user-group feature (blocking dependency for R4 too)?
4. R7: Excel mode — import FROM Excel (paste-in) required, or only spreadsheet-like in-grid editing?
5. Legacy `frontend/` dir mirrors `web/`; confirm `web/` is the sole implementation target.
