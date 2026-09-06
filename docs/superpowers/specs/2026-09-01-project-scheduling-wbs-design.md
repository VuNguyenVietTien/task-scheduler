# Project Scheduling and WBS Design

**Date:** 2026-09-01  
**Status:** Approved corrective design  
**Scope:** Rust/Postgres backend, GraphQL, Next.js task/Gantt UI, and controlled Redmine issue-1115 import

## 1. Goal and controlling rule

Deliver project workflow phases, two useful Gantt presentations, explicit work planning, and later capacity-aware scheduling without changing the meaning of the existing task hierarchy.

> **A product phase is a project-scoped task attribute only. A phase is never a task, WBS/task-hierarchy node, schedulable object, capacity consumer, meeting, or dependency endpoint.**

The first usable slice must not wait for a new scheduling engine. It must provide phase/category administration, correct hierarchy, task phase assignment/filtering, and both Gantt modes using current task dates, effort, and progress. Capacity scheduling upgrades that replaceable projection later.

## 2. Current repository constraints

- Real task hierarchy is `tasks.parent_task_id` in `backend/migrations/20250319000000_create_initial_schema.sql`.
- `backend/src/graphql/resolvers/tasks/query/tasks.rs` currently assembles cloned children in a way that can lose arbitrary depth; correct this without imposing phase-derived hierarchy.
- Current task timing/effort fields are `start_date`, `due_date`, nullable floating-point `effort`, `progress`, and `assignee_id`.
- Current Timeline behavior lives in `web/src/components/timeline/Timeline.tsx` and `TaskBar.tsx`; preserve plan CRUD/selection, priority ordering, filters, date controls, project/member views, modal opening, and existing task bars.
- `plans.plan_data` in `backend/migrations/20230705000001_create_plans_table.sql` is an existing compatibility snapshot. Increment 1 may continue using current task/plan reads; no new versioning infrastructure is required.
- Project members currently require real users. Placeholder identities need stable project-member records without fabricated users/emails.
- Categories are free text in Postgres and hard-coded in `web/src/types/task.ts`; phases/categories need project-scoped IDs and translations.
- Migration history is immutable and bootstrap is dependency-aware through `backend/src/migration_runner.rs`; all additions are new forward-only migrations.
- The worktree has user-owned changes in shared backend schema/task/plan files and web GraphQL paths. Implementers preserve current diffs and assign one owner at a time to `backend/src/graphql/schema.rs`, `backend/schema.graphql`, and `Timeline.tsx`.

## 3. Orthogonal domain concepts

1. **Task hierarchy:** arbitrary real task-to-task decomposition through `parent_task_id`.
2. **Product phase:** one project-scoped workflow-stage attribute on a task.
3. **Category:** independent project-scoped classification attribute on a task.
4. **Prerequisite:** explicit task-to-task finish-to-start edge.
5. **Assignment:** exact effort allocated to concrete project members.
6. **Schedule projection:** replaceable read shape consumed by both Gantt modes.
7. **Source WBS metadata:** import provenance/display headings only.
8. **Meeting:** separate calendar/capacity entity introduced after the scheduler.

Re-parenting does not change phase/category. Parentage and phase order create no prerequisite. Groups/companies classify members but are never assignees or capacity pools.

## 4. Project phases and categories

### 4.1 Exact default phases

Every existing and new project receives these five phases in this order:

| Order | Immutable key | Japanese (`ja`) | English (`en`) | Vietnamese (`vi`) |
|---:|---|---|---|---|
| 1 | `creation` | 作成 | Creation | Tạo tài liệu |
| 2 | `try-s-review-1` | Try-Sレビュー① | Try-S Review 1 | Đánh giá Try-S lần 1 |
| 3 | `address-review-comments-1` | 指摘修正① | Address Review Comments 1 | Sửa theo góp ý lần 1 |
| 4 | `try-s-review-2` | Try-Sレビュー② | Try-S Review 2 | Đánh giá Try-S lần 2 |
| 5 | `toshiba-review` | 東芝レビュー | Toshiba Review | Đánh giá Toshiba |

Owners may create, translate, edit, reorder, and archive phases/categories. Labels are never identifiers. Locale fallback is requested locale → project default locale → first available translation → immutable key. Archiving a referenced term requires atomic reassignment or explicit Unphased conversion.

Minimum relational model:

```text
project_phases(phase_id, project_id, phase_key, display_order, color?, is_active, timestamps)
project_phase_translations(phase_id, locale, name, description?)
project_categories(category_id, project_id, category_key, display_order, color?, is_active, timestamps)
project_category_translations(category_id, locale, name, description?)
tasks.phase_id -> project_phases
tasks.category_id -> project_categories
```

Enforce project-local keys/order/translation uniqueness. Phase rows have no effort, progress, dates, assignee, parent, dependency, meeting, or allocation columns.

## 5. Replaceable schedule projection and the two Gantt modes

### 5.1 Projection interface

Both modes consume one stable UI contract even while its producer changes:

```text
ProjectScheduleProjection
- source: CURRENT_TASK_FIELDS | CAPACITY_SCHEDULER
- project_id
- generated_at?
- wbs_rows[]
- phase_groups[]
- unphased_group
- meetings[]
- diagnostics[]

TaskScheduleItem
- task_id, parent_task_id, phase_id
- title, status, priority, priority_order
- effort_hours, progress_percent
- start, end
- assignments[]
- segments[]
- predecessor_ids[]
- source_wbs metadata?
```

Increment 1 builds the projection from current task/plan fields. Increment 2 adds assignment/dependency/effort fields while dates remain current task dates. Increment 3 changes the projection producer to authoritative capacity-derived allocations. Components do not need another semantic redesign.

**Schedule versioning is deferred.** It is not a prerequisite for phase CRUD, Gantt modes, capacity allocation, or import. Add version/scenario history only if existing plan behavior or an independently approved requirement proves it necessary. The minimum Increment 3 persistence is a replaceable current projection/allocation set with transactional regeneration and input revision protection.

### 5.2 WBS Detail

- Preserve arbitrary-depth task parent/subtask hierarchy.
- Show real tasks using current dates in Increment 1, then assignments/dependencies in Increment 2, then scheduler segments in Increment 3.
- May show issue-1115 root and 23 source `tracker-Phase` headings as non-interactive display rows.
- Source headings have no task ID, parent role, phase role, effort, progress, assignee, capacity, dependency endpoint, draggable/resizable bar, or Master Schedule contribution.

### 5.3 Master Schedule

- Group every real task exactly once by its own `phase_id`, in configured phase order.
- Include explicit **Unphased**.
- Phase rows are derived, non-editable summaries and never task bars.
- Increment 1 derives rollups from current task fields:
  - effort = sum direct task `effort`, once per task regardless of hierarchy;
  - start/end = min current `start_date` and max current `due_date` among tasks with dates;
  - progress = effort-weighted current task progress for positive-effort tasks;
  - task count = real non-deleted tasks only.
- Increment 3 upgrades start/end and allocated/remaining effort from authoritative allocations while preserving the same grouping semantics.
- Meetings may render as overlays in Increment 4 but never affect phase effort/progress.

Switching modes changes presentation only and causes no task, phase, plan, dependency, assignment, or schedule write.

## 6. Increment 1 supporting foundations

### 6.1 Hierarchy correctness

- Materialize arbitrary task depth reliably.
- Reject self/cyclic/cross-project re-parenting with actionable paths.
- Re-parenting preserves phase/category.
- A parent and child may have different phases and direct effort.

### 6.2 Import provenance and dry run

Use new additive source identity fields and non-schedulable WBS metadata:

```text
external_import_runs(... snapshot_sha256, mode, summary, outcome ...)
wbs_groups(... project_id, source_system, external_id, parent_group_id?, title, position, source_metadata ...)
tasks.source_system, tasks.external_id, tasks.source_metadata, tasks.wbs_group_id
```

No relation permits a WBS group to become an assignment, allocation, dependency endpoint, meeting, or task parent.

### 6.3 Stable project members and classifications

A project member may be linked to a user or remain a placeholder with stable ID and required display name. Email is optional. Linking preserves the member ID. Duplicate linked-user conflicts require explicit resolution. Companies and project groups are classification/filtering only.

## 7. Increment 2 work-planning contracts

### 7.1 Exact effort and assignments

- Scheduling quantities become exact decimal hours (`NUMERIC(10,2)` and Rust `Decimal`).
- Each task has direct `effort_hours >= 0`.
- Assignments target concrete `project_member_id` and store explicit `effort_hours`.
- Task effort equals the sum of assignment effort when assignments exist.
- Multi-member example: `6.00h + 10.00h = 16.00h`.
- Single and bulk effort writes use one canonical transactional service. Invalid bulk input changes no selected task.
- Legacy `tasks.effort` and primary `assignee_id` may be mirrored during compatibility rollout.

### 7.2 Prerequisites

V1 supports task-to-task finish-to-start edges with non-negative work-hour lag. Reject self, duplicate, cross-project, deleted-task, and cyclic edges. Phase, WBS heading, meeting, group, and company IDs are invalid endpoints. No dependency comes from phase order, parentage, or titles.

### 7.3 UI upgrades without scheduler dependency

- Task List supports transactional bulk effort.
- WBS Detail shows effort labels/tooltips, validated inline effort edit, exact assignments, and prerequisite links while still using current task dates.
- Master Schedule retains current-date phase rollups and immediately reflects effort/progress/phase edits.

## 8. Increment 3 capacity-aware authoritative scheduler

### 8.1 Calendars/capacity

Effective daily capacity precedence is date exception → member default → project calendar default → `8.00h`. An exception is the effective total for the date: `0` for leave/holiday; above normal for overtime.

### 8.2 Allocations

- Allocate each member's assignment effort exactly.
- For every member/date, task allocations must not exceed effective capacity (meeting reservations join this invariant in Increment 4).
- `20h` at `8h/day` allocates `8/8/4`.
- Weekends, zero capacity, reassignment, and preemption split segments.
- Finish-to-start successors schedule only after predecessors.
- Deterministic tie order uses readiness, task priority, `priority_order`, hierarchy display path, and task ID. Phase order may stabilize display but creates no scheduling constraint.

### 8.3 Minimum persistence/API

Use normalized calendars and allocation rows plus a replaceable current schedule projection. Regeneration is transactional and revision-checked so stale input produces no partial writes. Do not introduce immutable version/scenario tables unless required by the existing plan implementation and approved separately.

`plans.plan_data` may remain a compatibility read adapter. Once capacity scheduling is enabled, client-authored dates/segments cannot override authoritative allocation truth.

## 9. Increment 4 meetings and import apply

### 9.1 Meetings

Support recurring series, fixed occurrences, and ad hoc occurrences with IANA timezone, exact timestamps, stable recurrence keys, cancellation, and concrete project-member attendees.

- Repeated recurrence expansion is idempotent.
- Fixed meetings reserve attendee capacity before tasks and do not move.
- Cancellation removes capacity from the next regenerated projection.
- Optional phase link is classification only.
- Meeting overlays are non-task-interactive and contribute zero phase effort/progress.

### 9.2 Issue-1115 mapping

- Root `1115` (`Detailed Design`): source-root metadata only.
- Exactly 23 `tracker-Phase` rows: source/WBS metadata only.
- Exactly 156 `tracker-Task` rows: tasks.
- Task-under-task source parent maps to `parent_task_id`; task-under-root/heading gets source WBS metadata, not a fake task parent.
- Workflow mapping by immutable configuration:
  - `Create` → `creation` (69),
  - `Try-S Review 1` → `try-s-review-1` (69),
  - `Address Review Comments 1` → `address-review-comments-1` (6),
  - `Try-S Review 2` → `try-s-review-2` (6),
  - `Toshiba Review` → `toshiba-review` (6).
- Exact imported task effort is `387.00h`.
- Issue `1139` is `40.00h`, Shuichi Nakayama linked or placeholder member, source WBS row 5.
- Dependencies require explicit predecessor IDs or approved stable cycle keys; never pair globally by title. Missing intermediate stages are not bridged without explicit source proof.
- Assignee resolution: external person ID → source-linked member → approved alias → placeholder. Ambiguous name-only matching blocks.

Dry run and apply reject wrong counts/effort, duplicate IDs, unknown mapping, hierarchy/dependency cycles, invalid dates/effort, ambiguous assignee, cross-project identity, or any proposed heading-as-task. Apply runs once under project/root lock in one transaction. Repeating the same bundle creates no duplicate identities. Any failure leaves no partial domain writes.

## 10. GraphQL and frontend contracts

### GraphQL

- Focused phase/category, resource-member, dependency/assignment, capacity, meeting, and schedule-projection resolver modules.
- One integration owner composes `backend/src/graphql/schema.rs` and updates checked `backend/schema.graphql` per increment.
- Project authorization and same-project validation on every write.
- Decimal values cross GraphQL as strings.
- Increment 1 reads include phases/categories and current-field `project_schedule_projection`; writes include taxonomy CRUD/reorder/archive and task phase/category assignment.
- Later increments extend the projection rather than replace operation semantics.

### Frontend

- Fetched phase/category IDs replace hard-coded workflow labels.
- Phase selector/filter and taxonomy settings support en/vi/ja and custom BCP-47 translations.
- `Timeline.tsx` owns the mode switch but delegates row shaping/rendering to focused helpers/components.
- Phase and source-heading rows use dedicated types/components and cannot enter `TaskBar` task callbacks.
- `TaskBar.tsx` remains compatible with contiguous current-date bars, then accepts assignment/segment fields in later increments.
- Existing Timeline controls and plan behavior remain available throughout rollout.

## 11. Forward-only migrations and rollout

Suggested practical migration boundaries:

1. `20260901000100_create_project_taxonomies.sql`
2. `20260901000200_create_import_provenance.sql`
3. `20260901000300_create_resource_membership.sql`
4. `20260901000400_create_task_assignments_dependencies.sql`
5. `20260901000500_create_capacity_allocations.sql`
6. `20260901000600_create_meetings.sql`

Each is additive first, followed by idempotent backfill/reconciliation and then safe constraints. Never edit applied migration files.

Rollout:

1. Increment 1 behind phase/two-mode flags; current-field projection is the fallback and usable product slice.
2. Enable taxonomy and two modes for pilot projects after migration/GraphQL/web contracts pass.
3. Increment 2 adds work-planning fields without changing current-date projection semantics.
4. Increment 3 runs capacity projection in shadow mode, compares effort/dates, then switches selected pilot projects to `CAPACITY_SCHEDULER` source.
5. Increment 4 enables meeting capacity and issue-1115 apply after dry-run approval.
6. Roll back by feature flag/read-source switch to current task fields or legacy plan reads; never reverse applied migrations or delete shared domain data.

## 12. Acceptance tests

### Increment 1

- Exact phase seed/translations/order for existing/new projects and locale fallback.
- CRUD/reorder/archive/reassign authorization and atomicity.
- Five-level hierarchy round-trip; cycle-safe reparent; phase preserved.
- Phase selector/filter and both Gantt modes usable without scheduler tables.
- Master Schedule current-date rollups count each real task once; Unphased works; mode switch writes nothing.
- WBS source headings are non-task display metadata.
- Issue-1115 dry run validates 23/156/69-69-6-6-6/387.00/#1139 and produces no writes.
- Placeholder without email; stable link; groups/companies non-assignable.

### Increment 2

- Exact decimal backfill/reconciliation.
- `6.00 + 10.00 = 16.00` assignment conservation.
- Bulk effort all-or-nothing with UI optimistic rollback.
- FS cycle/cross-project rejection with diagnostic path.
- WBS effort labels/edit/prerequisite links and current-date Master rollup refresh.

### Increment 3

- Capacity precedence and `20h → 8/8/4`.
- Leave creates segmented gap; overtime never exceeds effective capacity.
- Successor follows predecessor; deterministic repeated generation.
- Assignment allocations equal assignment effort; no member/date over capacity.
- Both Gantt modes upgrade to authoritative segments without phase/task semantic changes.

### Increment 4

- Recurrence expansion idempotent across DST fixtures.
- Fixed/ad hoc meetings reserve only attendee capacity; cancellation affects regenerated projection.
- Meeting overlays are not tasks/phase effort.
- Issue-1115 apply/retry/reconciliation exact and atomic.
- Full backend, GraphQL contract, Jest, TypeScript, build, lint, migration, and browser acceptance pass.

## 13. Non-goals

- Phase as task/hierarchy/WBS/schedule/dependency object.
- Dependencies inferred from phase order, hierarchy, title, or translation.
- Immutable schedule history/scenario infrastructure in the four increments unless separately justified and approved.
- Critical path/PERT, probabilistic estimates, pooled group capacity, or minute-precise task work placement.
- Full event sourcing or broad Timeline/component cleanup.
- Fabricated imported users/emails or browser-driven authenticated writes.
- Destructive migration rollback or rewriting migration history.

## 14. Risks and controls

| Risk | Control |
|---|---|
| Dirty worktree collision | Targeted status/diff preflight; one owner for schema and Timeline hotspots; no reset/clean/broad formatting. |
| Increment 1 blocked by scheduler scope | Current-field projection is explicit and complete; scheduler is Increment 3 only. |
| Projection churn | Stable replaceable projection interface from Increment 1 onward. |
| Phase/source-heading confusion | Negative DB/Rust/GraphQL/UI/import tests in every increment. |
| Decimal drift | Postgres NUMERIC, Rust Decimal, GraphQL decimal strings, exact reconciliation. |
| Legacy Timeline regression | Focused helpers, one Timeline owner, feature fallback, existing control regression tests. |
| Migration bootstrap regression | New files only; custom migration evidence and checksum compatibility. |
| Import identity error | Strict static bundle, explicit mapping/policy, dry run before apply, one transaction/idempotency. |

## 15. Source paths

- `backend/migrations/20250319000000_create_initial_schema.sql`
- `backend/migrations/20230705000001_create_plans_table.sql`
- `backend/src/migration_runner.rs`
- `backend/src/graphql/schema.rs`
- `backend/schema.graphql`
- `backend/src/graphql/resolvers/tasks/**`
- `backend/src/graphql/types/task.rs`
- `backend/src/db/models/task.rs`
- `backend/src/graphql/resolvers/plans/**`
- `web/src/components/timeline/Timeline.tsx`
- `web/src/components/timeline/TaskBar.tsx`
- `web/src/components/tasks/TaskListView.tsx`
- `web/src/components/tasks/TaskBulkActions.tsx`
- `web/src/types/task.ts`
- `web/src/types/plan.ts`
- `web/src/graphql/__tests__/w3-contract.test.ts`
- `web/src/graphql/__tests__/w3-sdl-fixture.test.ts`
- `plans/reports/herdr-260901-1357-scheduling-wbs/reports/*.md`
