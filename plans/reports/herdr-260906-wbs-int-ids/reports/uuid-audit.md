# UUID Audit — Visible Integer Task IDs (per project, restart at 1)

**Report ID:** herdr-260906-wbs-int-ids
**Mode:** read-only audit + implementation plan (no code/DB changes made)
**Scope covered:** backend migrations/models/queries/GraphQL/import/scheduling/timesheet/plan lifecycle/tests; web types/queries/mutations/routes/components/tests referencing `task_id`/`taskId`/`parent_task_id`/comments/timesheets/saved plan JSON.
**Recommendation (TL;DR):** Do **NOT** replace the UUID PK. Adopt the **dual-key design**: keep `tasks.task_id UUID` as PK/FK join key everywhere, add `tasks.task_number INT NOT NULL` with `UNIQUE(project_id, task_number)` and a per-project monotonic allocator (counter column on `projects`). Full PK conversion is **not advisable** (9+ FK surfaces, JSONB snapshots, saved plan JSON, contract SDL, 3 frontend apps, import mappings — high blast radius, zero user benefit since the requirement is display-only).

---

## 1. Current state (verified in code)

### 1.1 Schema — `backend/migrations/`
- `20250319000000_create_initial_schema.sql`:
  - `tasks.task_id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `tasks.parent_task_id UUID REFERENCES tasks(task_id)` (self-FK)
  - FKs → `tasks(task_id)`: `task_tags` (CASCADE, + UNIQUE(task_id,tag_id)), `task_durations` (CASCADE), `comments` (CASCADE, idx_comments_task), `task_snapshots` (CASCADE), `activity_logs` (SET NULL, idx)
  - `idx_tasks_parent` on `parent_task_id`
  - No `task_dependencies` table exists — "dependencies" are only `parent_task_id` hierarchy + saved-plan ordering.
- `20260905000002_create_timesheets.sql`: `timesheet_entries.task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE`, `UNIQUE (user_id, task_id, work_date)` — task_id participates in a UNIQUE constraint.
- `20260901000100_create_project_taxonomies.sql`: `tasks.phase_id`/`category_id` composite FKs bound to same project (project-scoping precedent exists).
- `20260906000001_plan_lifecycle.sql`: `tasks.assignee_resource_member_id`; `plans` append-only revisions; `plan_data JSONB` stores task refs.
- `20230705000001_create_plans_table.sql`: `plans.plan_data` JSONB documented shape `{"tasks":[{"task_id":"uuid",...}]}` (v1 `task_id`, v2 `taskId` — see `db/plans.rs` serde rename and `web/src/utils/planLifecycle.ts` which accepts both).
- `web/supabase/migrations/00001_initial_schema.sql`: legacy/parallel schema also references task tables — inert but must be inventoried.
- Soft delete: `delete_task` sets `is_deleted = true` (`graphql/resolvers/tasks/mutation/delete.rs`, `db/queries/task.rs`); all reads filter `NOT is_deleted`. Rows persist → number reuse after delete would be ambiguous (comments/timesheets/activity history).

### 1.2 Backend surfaces (Rust, `backend/src/`)
- Models: `db/models/task.rs` (`task_id: Uuid`, `parent_task_id: Option<Uuid>`, `priority_order: i32` — reorder uses `priority_order`, NOT an ID; a task_number must not be conflated with ordering), `db/models/comment.rs`, `report_task.rs`, `bug.rs`.
- Queries/services: `db/queries/task.rs`, `db/queries/comment.rs`, `db/services/task_service.rs`, `comment_service.rs`, `notification_service.rs` (`reference_id` = task id), `db/plans.rs` (Plan + `PlanTaskData { task_id → serde "taskId" }`).
- GraphQL: `graphql/types/task.rs`; resolvers `tasks/mutation/{create,update,delete,reorder,update_status,update_effort}.rs` (create.rs validates parent in same project — precedent for project-scoped invariants), `comments/*` (`task_comments(task_id)`), `timesheet.rs` (`my_timesheet_entries`, `save_timesheet_batch` with task refs), `plans/{mutation,query}.rs` (plan_data passthrough as JSON Value), `plan_lifecycle.rs`, `schedule_projection/mod.rs`, `taxonomies/mod.rs` (`set_task_taxonomy(task_id,…)`), `attachment.rs`.
- SDL (`schema.graphql`): `type Task { task_id: UUID! … parent_task_id: UUID }`; mutations `delete_task(task_id: ID!)`, `set_task_taxonomy(task_id:…)`, query `task(task_id: ID!)`, `task_comments(task_id:…)`, timesheet types (~15 `task_id/taskId` occurrences pinned by `tests/contract/increment1_graphql.rs` SDL fixture + `web/src/graphql/__tests__/w3-sdl-fixture.test.ts`).
- Scheduling: `scheduling/projection.rs` — `task_id`, `parent_task_id`, `Vec<task_ids>`, HashSet joins (UUID-keyed throughout).
- Import: `imports/manifest.rs` + `imports/issue_1115.rs` + `bin/import_redmine.rs` (dry-run only; apply REFUSED per increment 4) — manifest carries `external_id` ("1115") and alias→person mappings; tasks are created fresh with new UUIDs; `parent_task_id` set on apply.
- Other emitters: `api/{task_assignments,comments,attachments}.rs`, REST shims in `web/src/app/api/...` (route handlers pass taskId through), `email/templates.rs`, `firebase/mod.rs` (push payloads), websocket (task payloads).
- Tests: `src/tests/task_tests.rs`, `tests/herdr_flow.rs` (inserts tasks by raw UUID, timesheet GraphQL asserts `task_id`), `tests/contract/increment1_graphql.rs`, `tests/taxonomy_hardering.rs`, `src/db/tests.rs`, `src/tests/testdata.json`.

### 1.3 Web surfaces (`web/src/`) — 60+ files
- Types: `types/task.ts` (`task_id` + `id?` legacy alias), `types/plan.ts` (`task_id` + `taskId?` alias, "backward compat with mixed DB data"), `types/schedule-projection.ts`, `types/notification.ts`.
- GraphQL: `graphql/mutations/tasks.ts` (create/update/reorder select `task_id`, `parent_task_id`), `graphql/mutations/plans.ts`, `graphql/scheduling.ts`, `graphql/queries/`, `graphql/index.ts`.
- Routes: `app/projects/[id]/tasks/[taskId]/page.tsx`, `.../[taskId]/create-subtask/page.tsx`, `app/projects/[id]/timesheet/page.tsx`, REST shims `app/api/projects/[id]/tasks/[taskId]/{route,status,priority}.ts`, `app/api/comments/route.ts`, `app/api/attachments/route.ts`.
- Utils (UUID-keyed logic): `utils/taskScheduler.ts`, `planLifecycle.ts` (v2 `{taskId,startDate,…}` snapshot merge vs live by UUID), `taskAllocations.ts`, `cloneTask.ts`, `ganttRows.ts`.
- Components: `components/tasks/**` (TaskDetailPage(+_backup), KanbanBoard, TaskList(View), TaskExcelGrid, SubtaskList/Item/Tab, CommentsTab/CommentSection, NewTaskForm, SortableTaskItem, DroppableColumn, TaskCard/Detail, title/TaskTitle, description panel), `components/project/TasksTab`, `components/projects/*`, dashboards (`dashboard-task-table`, member/pm views), `NotificationDropdown`, `Header`, `FcmNotificationHandler`, `CommentCard`.
- Tests: `utils/__tests__/{gantt-rows,capacity-scheduling,plan-lifecycle,task-allocations,cloneTask}.test.ts`, `components/tasks/__tests__/TaskExcelGrid.test.tsx`, `app/.../timesheet/__tests__/timesheet-helpers.test.ts`, `graphql/__tests__/w3-*-test.ts`.
- **Out-of-scope-but-affected:** `frontend/` (React Native; ~81 files incl. `redux/features/tasksSlice.ts` keyed by `parentTaskId`/`taskId`) and `task-scheduler-frontend/` — compat plan must include them if task payloads change shape (additive field = safe).

---

## 2. Option comparison

### 2A. Destructive: replace `task_id` PK with per-project integer
Every FK, UNIQUE, index, GraphQL arg, REST route param, Redux slice, saved plan JSONB, snapshot row, import mapping, and contract test above must change simultaneously.
- FK rewrite: drop/re-add 7 FK constraints + self-FK + timesheet UNIQUE(user_id,task_id,work_date) → UNIQUE(user_id,project_id?,task_number,work_date) semantics change.
- `plans.plan_data` (v1 `task_id` + v2 `taskId` mixed historical rows) requires in-place JSONB rewrite of every saved plan — the exact data the lifecycle migration (`20260906000001`) made append-only/staleness-checked; rewriting breaks revision-chain integrity assumptions.
- `task_snapshots`, `activity_logs` (SET NULL), comments history: numbers must never be reused or history lies — but per-project restart-at-1 *inherently* reuses numbers across projects and after resets; cross-project ambiguity corrupts any globally-keyed store.
- Multi-instance/restore hazards: restoring a project into another tenant collides; UUIDs are the collision-proof merge key.
- Verdict: **rejected.** Cost extreme, risk high, user requirement (human-readable per-project numbering) fully satisfiable without it.

### 2B. Recommended: dual-key (display integer + internal UUID)
- `task_id UUID` remains PK and the only FK/JSON/API mutation key → zero referential-integrity risk.
- Add `task_number INT NOT NULL`, `UNIQUE(project_id, task_number)` — human-facing "#N", restarts at 1 per project automatically (project-scoped).
- Monotonic per-project allocator; never reused (soft-deleted tasks keep their number) → history stays truthful.
- Additive migration, staged NOT NULL, trivially reversible (drop column).
- UI shows `#N` next to title; deep links/routes stay on UUID (optionally later add lookup by number).

---

## 3. Exact design (Option B)

### 3.1 Migration SQL outline (`backend/migrations/20260906XXXXXX_task_numbers.sql`)
```sql
-- Stage 1 (additive, online-safe)
ALTER TABLE projects ADD COLUMN task_number_seq BIGINT NOT NULL DEFAULT 0;
ALTER TABLE tasks    ADD COLUMN task_number INT;            -- nullable during backfill

-- Stage 2 (backfill, idempotent, rerunnable)
WITH ranked AS (
  SELECT task_id, project_id,
         ROW_NUMBER() OVER (PARTITION BY project_id
                            ORDER BY created_at ASC NULLS LAST, task_id ASC) AS rn
  FROM tasks
)
UPDATE tasks t SET task_number = r.rn
FROM ranked r WHERE t.task_id = r.task_id;

UPDATE projects p
SET task_number_seq = COALESCE(
  (SELECT MAX(task_number) FROM tasks t WHERE t.project_id = p.project_id), 0);

-- Stage 3 (harden) — run only after backfill verified
ALTER TABLE tasks ALTER COLUMN task_number SET NOT NULL;
ALTER TABLE tasks ADD CONSTRAINT uq_tasks_project_number UNIQUE (project_id, task_number);
-- UNIQUE index doubles as lookup index; no extra index needed.
COMMENT ON COLUMN tasks.task_number IS
  'Human-facing per-project sequence starting at 1; monotonic, never reused (soft deletes keep numbers). Not a sort order (use priority_order).';
```
Note: Stage 2/3 can ship in one migration if the migration runner wraps them in a transaction (sqlx migrate does) and table size permits; otherwise ship Stage 1+2 first, Stage 3 as follow-up once backend populates on create.

### 3.2 Race-free allocation (backend `tasks/mutation/create.rs`)
Same transaction as the INSERT:
```sql
UPDATE projects SET task_number_seq = task_number_seq + 1
WHERE project_id = $1 RETURNING task_number_seq;
```
- The row lock on the single `projects` row serializes concurrent creators for that project → strictly no duplicates; no retry needed. Keep this statement **first** in the txn to avoid deadlocks with other project-row updates.
- Defensive fallback: on `uq_tasks_project_number` violation, resync `task_number_seq = MAX(task_number)` and retry once (belt-and-braces for any legacy writer).
- Alternative (no projects-column change): `SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0)); SELECT COALESCE(MAX(task_number),0)+1 FROM tasks WHERE project_id=$1;` — equivalent guarantees; counter column preferred (O(1), no advisory-lock lifecycle coupling).
- **Bulk paths (import/clone):** allocate a range in one statement — `UPDATE projects SET task_number_seq = task_number_seq + $n WHERE project_id=$1 RETURNING task_number_seq` → numbers `[ret-$n+1 … ret]` assigned in manifest/creation order. No per-row locking.

### 3.3 Clone / import behavior
- **Clone (`web/src/utils/cloneTask.ts` today clones client-side; future server clone):** new UUID + next task_number(s); subtasks get consecutive numbers via bulk range allocation in creation order. Numbers of source are irrelevant to the copy (no "preserve numbers" option — would collide).
- **Redmine import (`imports/manifest.rs` → apply path, currently REFUSED):** on apply, allocate one range for all manifest tasks in manifest order (stable, deterministic numbering: root=1, children follow manifest order); keep the manifest `external_id → new task_id` mapping for idempotency/re-run detection exactly as today; task_number is derived, never taken from the source system.
- **Saved-plan apply (plan_lifecycle):** plan_data v2 rows keep `taskId` (UUID) as the join key — untouched by design. task_number is display-only in plan UIs (gantt bars can label `#N` by joining live task list).

### 3.4 Project "reset" semantics
- **Default: no reset.** Numbers are monotonic per project forever. Rationale: comments/activity/timesheet references and user habituation; soft-deleted tasks (rows persist, `is_deleted`) must not orphan "#5" ambiguity.
- Optional future op (out of scope now): admin "renumber compactly" that rewrites task_number **only** (never FKs) inside one txn with a project lock + advisory notice that displayed numbers shift; plan_data/UUIDs unaffected. Document as explicitly **not** part of this change.

### 3.5 API / GraphQL / UI exposure
- `type Task { … task_number: Int! }` (additive — SDL fixture tests updated).
- Keep all mutations/queries keyed by `task_id: ID!`/`UUID` (zero breakage across web, RN `frontend/`, task-scheduler-frontend, contract tests).
- Optional additive read: `task_by_number(project_id: ID!, number: Int!): Task` for `#N` search/quick-nav (and to accept `#5` in command palettes). Not required for MVP of the user requirement.
- UI: TaskList/Kanban/SubtaskList/TaskExcelGrid/TaskDetail title area render `#N`; Gantt labels optional; no route changes (`[taskId]` stays UUID).

### 3.6 Compatibility plan
1. Migration Stage 1+2 → 2. backend populates `task_number` on create (allocator); Task GraphQL type exposes it. 3. web/RN display `#N` where `task_number` present (optional guard for old cached payloads). 4. Migration Stage 3 (NOT NULL + UNIQUE) once no writer skips allocation. 5. Contract SDL fixtures (`increment1_graphql.rs`, `w3-sdl-fixture.test.ts`) updated in step 2 — additive field addition. Legacy aliases (`types/task.ts` `id?`, `types/plan.ts` `taskId?`) untouched.

---

## 4. Risk register
| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | Allocator deadlock (project row lock vs other updates) | Med | Allocate first in txn; keep txn short |
| R2 | Concurrent creates during deploy gap (writer without allocation) | Med | Stage 3 (NOT NULL) only after step-2 deploy; defensive resync-retry |
| R3 | Backfill ordering ambiguity (equal created_at) | Low | Tiebreak `task_id ASC` (deterministic); numbers are new anyway |
| R4 | Number shown ≠ DB after failed txn | Low | Allocation inside same txn as insert |
| R5 | Users treat #N as sort order | Low | UI keeps priority_order sorting; docs + tooltip |
| R6 | Full PK conversion attempted later on stale audit | — | This report: conversion rejected (§2A) |
| R7 | plan_data/cloneTask/planLifecycle tests assume exact payloads | Low | Additive field; UUID keys unchanged; run existing suites |

## 5. Staged file ownership plan
- **Stage 1 (DB):** `backend/migrations/20260906XXXXXX_task_numbers.sql` (+ follow-up harden migration) — DB owner.
- **Stage 2 (backend):** `db/models/task.rs`, `db/queries/task.rs`, `graphql/resolvers/tasks/mutation/create.rs` (allocator), `update.rs`/`create-subtask` path, `graphql/types/task.rs`, `schema.graphql`, optional `tasks/query/task_by_number.rs`, bulk allocation helper for `imports/*` apply — backend owner.
- **Stage 3 (web):** `types/task.ts` (+ display util), `graphql/mutations/tasks.ts` selections, `components/tasks/*` label sites (TaskList, KanbanBoard, TaskExcelGrid, SubtaskList, TaskDetailPage, NewTaskForm result toast), `utils/ganttRows.ts` optional label — web owner.
- **Stage 4 (tests):** backend `src/tests/task_tests.rs`, `tests/herdr_flow.rs`, `tests/contract/increment1_graphql.rs`; web `graphql/__tests__/w3-sdl-fixture.test.ts`, new `task-number` tests — QA owner.
- **Out of current scope, tracked:** `frontend/` (RN) + `task-scheduler-frontend/` display adoption; `web/supabase/migrations/` legacy schema untouched.

## 6. Deploy / rollback plan
- **Deploy order (zero-downtime):** migrate Stage 1+2 (online-safe: new nullable column, backfill UPDATE) → deploy backend (allocator + GraphQL field) → deploy web (display) → migrate Stage 3 (NOT NULL + UNIQUE). Deploy `backend` before Stage 3 strictly.
- **Rollback:** web rollback trivial (display-only). Backend rollback: keep column, skip allocator (Stage 3 already guarantees presence for old rows; new rows after rollback would violate NOT NULL → **therefore** Stage 3 ships only when backend allocator is confirmed stable ≥1 release; until then UNIQUE-only without NOT NULL is the safe posture). DB rollback: `ALTER TABLE tasks DROP CONSTRAINT uq_tasks_project_number; ALTER TABLE tasks DROP COLUMN task_number; ALTER TABLE projects DROP COLUMN task_number_seq;` — no data loss beyond the display numbers.
- **Verification gates:** backfill count == task count per project; `SELECT project_id, COUNT(*) vs MAX(task_number)` gaps only from future soft-deletes… (initially no gaps); contract SDL green; concurrency test green.

## 7. Exhaustive test plan
**Backend (integration, real Postgres):**
1. Backfill: per-project numbering starts at 1, dense, deterministic under tiebreak; multi-project isolation (two projects both have #1).
2. Allocator: 50 concurrent `create_task` on same project (tokio + N connections) → 50 distinct contiguous numbers, no unique violations, no deadlocks.
3. Cross-project concurrency: interleaved creates on 2 projects → independent sequences.
4. Soft delete: delete task #k, create new → gets max+1, never k; comments/timesheet rows of #k still resolvable by UUID.
5. Subtask creation path allocates number; parent link unaffected.
6. Import bulk: manifest of N tasks → contiguous range in manifest order; re-run dry-run unchanged.
7. Clone (when server-side): range allocation, no collision with existing.
8. GraphQL: `task_number` returned on task/tasks/task_subtasks/child_tasks; `delete_task`/`update_*`/`reorder` unaffected (reorder still priority_order); `task_by_number` (if added) resolves, errors on cross-project wrong number.
9. Timesheet: `save_timesheet_batch` + `my_timesheet_entries` unchanged (UUID keys); UNIQUE(user_id,task_id,work_date) intact.
10. Plans: save/read plan v1(`task_id`) & v2(`taskId`) round-trip unchanged; staleness/fingerprint logic untouched.
11. Contract: SDL fixture includes `task_number: Int!`; increment1 suite green.
12. herdr_flow: extend to assert `task_number` on created tasks + placeholder-assign flow.
**Web (jest):**
13. `types/task.ts` parses task_number; display util renders `#N` (pads? no).
14. TaskList/Kanban/SubtaskList/TaskExcelGrid show `#N`; sorting still by priority_order/status (snapshot tests updated).
15. planLifecycle/ganttRows/cloneTask/taskAllocations suites unchanged-green (UUID keying preserved).
16. SDL fixture test updated; timesheet-helpers tests unchanged-green.
17. Route: `/tasks/[taskId]` still UUID-driven; no navigation change.

## 8. Verdict on full PK conversion
**Not advisable.** The UUID `task_id` is the load-bearing join key across 7 child tables + self-FK + timesheet UNIQUE + activity logs + two generations of saved-plan JSONB + import mappings + 3 apps + contract-pinned SDL. The user-facing requirement (visible integers restarting at 1 per project) is a **presentation** concern; the dual-key design satisfies it with an additive, reversible, race-free change and preserves all referential integrity, history truthfulness, and API compatibility.

---
*Generated read-only; no repo files modified except this report. Unresolved questions: (1) should `#N` also appear in email/push/Firebase payloads (recommend yes, additive)? (2) is `task_by_number` quick-nav wanted in MVP? (3) exact tiebreak preference for backfill order (created_at vs priority_order) — recommend created_at as drafted.*
