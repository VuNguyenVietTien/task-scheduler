# Domain Architecture Design — Scheduling, Task Hierarchy, Phases, Capacity, and Master Schedule

**Status:** design-only, read-only analysis  
**Authoritative clarification:** a **phase is an attribute of a task/ticket**. A phase is never a task, never schedulable, and never a WBS/hierarchy container. The Master Schedule groups tasks by phase and derives phase dates, effort, and progress from task allocations.

## 1. Current-state constraints

1. Tasks already have an adjacency-list hierarchy through `tasks.parent_task_id`; the Rust query recursively reads it, although the current in-memory tree builder does not reliably materialize arbitrary depth because it clones children into parents in a single second pass. The domain must preserve arbitrary hierarchy and fix the projection rather than impose `phase → task` depth semantics (`backend/migrations/20250319000000_create_initial_schema.sql`, `backend/src/graphql/resolvers/tasks/query/tasks.rs`, `backend/src/graphql/types/task.rs`).
2. Current task schedule data is split between editable task columns (`start_date`, `due_date`, `effort`, `assignee_id`) and client-authored `plans.plan_data` JSONB. The Timeline calculates dates in TypeScript and saves a flat task snapshot (`backend/migrations/20230705000001_create_plans_table.sql`, `backend/src/graphql/resolvers/plans/mutation.rs`, `web/src/components/timeline/Timeline.tsx`, `web/src/types/plan.ts`).
3. The active Timeline UI is valuable and should survive: plan create/select/save/delete, manual priority order, project/user views, filters, date-window controls, task modal opening, and `TaskBar` rendering (`web/src/components/timeline/Timeline.tsx`, `web/src/components/timeline/TaskBar.tsx`).
4. Current bars are one contiguous client-calculated interval. They do not represent persisted resource allocations, capacity, prerequisites, or gaps (`web/src/components/timeline/Timeline.tsx`, `web/src/components/timeline/TaskBar.tsx`).
5. Task effort exists end-to-end but remains `DOUBLE PRECISION`; list-level single edit is implemented, while bulk handlers are effectively stubs and `TaskBulkActions` is not wired to them (`backend/migrations/20250319000000_create_initial_schema.sql`, `backend/src/graphql/resolvers/tasks/mutation/update_effort.rs`, `web/src/components/tasks/TaskListView.tsx`, `web/src/components/tasks/TaskBulkActions.tsx`).
6. Membership currently requires an existing user and email. `project_members.user_id` is non-null, and add-by-email rejects unknown users. The web UI assumes every member has a user object (`backend/migrations/20250319000000_create_initial_schema.sql`, `backend/src/graphql/resolvers/members/mutation/add_by_email.rs`, `backend/src/graphql/resolvers/members/types.rs`, `web/src/components/projects/MembersView.tsx`, `web/src/types/members.ts`).
7. Task category is a hard-coded frontend union and a free-text database column. There is no phase entity or project-scoped multilingual taxonomy (`web/src/types/task.ts`, `backend/migrations/20250319000000_create_initial_schema.sql`).
8. The plan implementation has contract debt: multiple Rust plan types, mixed snake/camel field shapes, JSONB exposed as an untyped GraphQL value, and an update implementation whose dynamic binds do not correspond to the constructed SQL. New scheduling work should not deepen this path (`backend/src/db/plans.rs`, `backend/src/graphql/schema/plans/types.rs`, `backend/src/graphql/resolvers/plans/mutation.rs`, `web/src/graphql/queries/plans.ts`, `web/src/graphql/mutations/plans.ts`).

## 2. Architecture options

### Option A — Normalized relational truth + Rust scheduler + versioned projection (**recommended**)

Postgres stores task semantics, dependencies, resource calendars, meetings, and allocation rows. A deterministic Rust scheduling service computes a `schedule_version` and its allocations transactionally. A server-generated projection presents the flat task/plan shape needed by the existing Timeline.

**Advantages**
- Rust/Postgres is unambiguously authoritative.
- Capacity, dependency, placeholder identity, and taxonomy invariants can be enforced at write boundaries and partly in the database.
- Persisted allocation segments support gaps, multiple members, phase rollups, audit/history, and explainability.
- Existing Timeline plan UX can be retained behind a compatibility adapter.
- Read performance remains predictable: Timeline reads one versioned projection rather than recomputing every render.

**Costs**
- Largest initial schema/API addition.
- Requires explicit migration from client-authored plan dates to constraints/preferences.
- Projection freshness and optimistic concurrency need design discipline.

### Option B — Normalized truth + Rust scheduler computed on every read, no persisted schedule versions

The same normalized task/calendar model is used, but schedule allocations are ephemeral responses generated whenever the Master Schedule is queried.

**Advantages**
- Fewer persistence tables and no stale projection.
- Simple conceptual rule: current inputs always produce the current schedule.

**Costs**
- Existing named plan/baseline UX has no durable target without reintroducing snapshots.
- Harder to compare schedules, audit moves, or make plan selection meaningful.
- Repeated computation and pagination/cache consistency become concerns.
- User edits can change the viewed schedule between requests without a stable version token.

**Verdict:** viable for a small MVP but a poor fit for the active named-plan UI.

### Option C — Append-only schedule command/event log + derived relational read model

Every task/calendar/meeting change is an event; projections generate current domain tables and schedule versions.

**Advantages**
- Excellent auditability, replay, scenario branching, and explanation provenance.
- Strong long-term foundation for baselines and what-if planning.

**Costs**
- Substantially more operational and implementation complexity than current code warrants.
- Requires event versioning, replay tooling, idempotency infrastructure, and projection recovery.
- Slows delivery of core scheduling behavior.

**Verdict:** not recommended now (YAGNI). Option A can retain immutable schedule versions and an audit trail without full event sourcing.

## 3. Recommended domain model

IDs are UUIDs. Scheduling quantities use `NUMERIC(10,2)` hours, never floating point. Local work dates use `DATE`; instants use `TIMESTAMPTZ`. Every project has an IANA `timezone` used to convert work dates and meeting times.

### 3.1 Task, hierarchy, taxonomy

```text
Task
- task_id
- project_id
- parent_task_id? -> Task
- phase_id? -> ProjectPhase
- category_id? -> ProjectCategory
- title, description
- status, priority, priority_order
- effort_hours NUMERIC(10,2) NOT NULL DEFAULT 0
- progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0
- not_before_date? DATE
- due_date? DATE                 // constraint/deadline, not computed finish
- scheduling_mode AUTO | MANUAL | UNSCHEDULED
- created_by, created_at, updated_at, is_deleted
```

```text
ProjectPhase
- phase_id
- project_id
- phase_key                         // immutable project-local machine key
- display_order
- color?
- is_active
- created_at, updated_at
- UNIQUE(project_id, phase_key)

ProjectPhaseTranslation
- phase_id
- locale                            // BCP-47, e.g. en, vi, ja
- name
- description?
- UNIQUE(phase_id, locale)

ProjectCategory
- category_id
- project_id
- category_key
- color?
- display_order
- is_active
- created_at, updated_at
- UNIQUE(project_id, category_key)

ProjectCategoryTranslation
- category_id
- locale
- name
- description?
- UNIQUE(category_id, locale)
```

**Hierarchy is independent of phase.** Parent and child tasks may have different phases. Re-parenting does not alter phase. Every task—including a parent task—may carry its own effort and allocations. Hierarchy is organizational/decomposition metadata, not an implicit rollup container.

### 3.2 Prerequisites

```text
TaskDependency
- dependency_id
- project_id
- predecessor_task_id -> Task
- successor_task_id -> Task
- kind FINISH_TO_START          // only supported v1 kind
- lag_work_hours NUMERIC(10,2) DEFAULT 0
- created_at, created_by
- UNIQUE(predecessor_task_id, successor_task_id)
```

Dependencies are independent of hierarchy and phase. No automatic dependency is inferred from parent/child order or phase order.

### 3.3 Members, placeholders, companies, groups

Assignments and allocations target a **project member**, not a user. This permits a stable identity before account linkage.

```text
ProjectMember
- project_member_id
- project_id
- user_id? -> User
- display_name NOT NULL
- email? CITEXT
- role Manager | Leader | Member | Guest
- position?
- member_state PLACEHOLDER | INVITED | LINKED | INACTIVE
- default_capacity_hours NUMERIC(5,2) NOT NULL DEFAULT 8
- linked_at?
- joined_at, invited_by?
- UNIQUE(project_id, user_id) WHERE user_id IS NOT NULL
- UNIQUE(project_id, lower(email)) WHERE email IS NOT NULL AND member_state <> INACTIVE
```

```text
Company
- company_id
- name
- external_key?
- is_active

CompanyMember
- company_id
- project_member_id
- UNIQUE(company_id, project_member_id)

ProjectGroup
- group_id
- project_id
- name
- description?
- is_active
- UNIQUE(project_id, name)

ProjectGroupMember
- group_id
- project_member_id
- UNIQUE(group_id, project_member_id)
```

A placeholder requires only `display_name`; email is optional. Linking is an explicit mutation selecting a real `user_id`. The same `project_member_id` remains in assignments/allocations, so linking does not rewrite schedule rows. If the user is already represented in that project, linking must merge only through an explicit conflict-resolution operation.

Companies classify members across projects; groups are project-scoped working teams. Neither company nor group is directly allocated capacity in v1: schedule assignments resolve to concrete project members. Group assignment may be a future dispatch rule, not a hidden pooled-capacity shortcut.

### 3.4 Task assignments, calendars, and capacity exceptions

```text
TaskAssignment
- task_assignment_id
- task_id
- project_member_id
- allocation_weight NUMERIC(5,2) DEFAULT 1
- is_primary BOOLEAN DEFAULT false
- UNIQUE(task_id, project_member_id)
```

```text
WorkCalendar
- calendar_id
- project_id
- name
- timezone
- default_daily_capacity_hours NUMERIC(5,2) NOT NULL DEFAULT 8
- working_weekdays SMALLINT[] DEFAULT [1,2,3,4,5]
- is_default

MemberCalendar
- project_member_id
- calendar_id
- default_daily_capacity_hours?       // null => project calendar default
- UNIQUE(project_member_id)

CapacityException
- capacity_exception_id
- project_member_id
- work_date DATE
- capacity_hours NUMERIC(5,2) NOT NULL
- reason?
- source MANUAL | LEAVE | OVERTIME | HOLIDAY
- UNIQUE(project_member_id, work_date)
```

`capacity_hours` is the **effective total capacity for that date**, not a delta. This avoids ambiguous leave/overtime stacking. Default is member override, then calendar default, then 8h. A holiday/leave day is 0h; overtime is represented by a value greater than the default.

### 3.5 Meetings

```text
MeetingSeries
- meeting_series_id
- project_id
- title
- recurrence_rule?                 // validated RFC 5545 subset
- timezone
- duration_minutes
- starts_local_time
- range_start_date
- range_end_date?
- phase_id?                        // classification only
- created_by, created_at, updated_at

MeetingOccurrence
- meeting_occurrence_id
- project_id
- meeting_series_id?
- occurrence_kind RECURRING | FIXED | ADHOC
- title
- starts_at TIMESTAMPTZ
- ends_at TIMESTAMPTZ
- mobility FIXED | MOVABLE
- status SCHEDULED | CANCELLED
- phase_id?                        // classification only
- recurrence_key?                  // deterministic series occurrence key
- UNIQUE(meeting_series_id, recurrence_key)

MeetingAttendee
- meeting_occurrence_id
- project_member_id
- required BOOLEAN DEFAULT true
- UNIQUE(meeting_occurrence_id, project_member_id)
```

- **Recurring**: generated from a series rule; generated occurrence may still be fixed or movable.
- **Fixed**: one immovable occurrence; may be standalone.
- **Ad hoc**: one standalone occurrence, fixed or movable.
- Meetings are not tasks and never appear in task hierarchy. They consume attendee capacity and may be displayed as overlay segments. A phase link is optional classification only and contributes no task effort/progress.

### 3.6 Schedule scenarios, versions, allocations, and projection

```text
ScheduleScenario                    // compatibility target for current Plan
- scenario_id
- project_id
- name, description?
- is_active
- created_by, created_at, updated_at
- UNIQUE(project_id) WHERE is_active

ScheduleVersion
- schedule_version_id
- scenario_id
- version_number
- input_revision                    // project scheduling revision
- status DRAFT | VALID | INFEASIBLE | SUPERSEDED
- generated_at, generated_by
- algorithm_version
- horizon_start, horizon_end
- diagnostics JSONB
- UNIQUE(scenario_id, version_number)

TaskAllocation
- allocation_id
- schedule_version_id
- task_id
- project_member_id
- work_date DATE
- sequence_no
- start_minute_local?               // optional v1; enables intraday fixed-meeting avoidance
- end_minute_local?
- effort_hours NUMERIC(10,2)
- segment_key                       // contiguous run grouping for UI
- UNIQUE(schedule_version_id, task_id, project_member_id, work_date, sequence_no)

ScheduleProjection
- schedule_version_id PRIMARY KEY
- projection_schema_version
- plan_data JSONB                    // server-generated compatibility/read cache
- generated_at
```

`plans` may initially remain as a compatibility view/adapter over `ScheduleScenario + latest ScheduleVersion + ScheduleProjection`; it must no longer accept arbitrary schedule truth in `plan_data`.

## 4. Exact invariants

### Task/hierarchy
- **T1:** parent and child belong to the same project.
- **T2:** no self-parent and no transitive hierarchy cycle.
- **T3:** hierarchy depth is unrestricted by the domain; API traversal must either return a correctly nested tree or an explicit flat `parent_task_id` list.
- **T4:** phase/category assignment is independent of parentage; no cascade on re-parent.
- **T5:** task effort is direct effort for that ticket. Parent effort is not automatically replaced by child effort; phase totals sum each included task exactly once.

### Phase/category
- **P1:** phases and categories are project-scoped, stable-ID entities; display labels are never identifiers.
- **P2:** each task has zero or one phase and zero or one category in v1.
- **P3:** deleting a referenced phase/category is forbidden; archive it or explicitly reassign affected tasks atomically.
- **P4:** at least one translation is required. Read fallback: requested locale → project default locale → first available translation → key.
- **P5:** phase has no effort, progress, planned dates, assignee, dependency, allocation, or parent phase fields.

### Dependencies
- **D1:** only finish-to-start is accepted in v1.
- **D2:** dependency endpoints belong to the same project and differ.
- **D3:** dependency graph is acyclic; mutation rejection returns the detected cycle path.
- **D4:** successor allocation starts no earlier than the predecessor’s last allocation end plus non-negative working lag.
- **D5:** deleting/archiving a task removes or disables incident dependency edges transactionally.

### Capacity and allocations
- **C1:** effective member capacity is date exception → member default → project calendar default → 8h.
- **C2:** effective capacity is `>= 0`; overtime is explicit through capacity above the default.
- **C3:** for a schedule version and member/date, task allocations plus required meeting hours cannot exceed effective capacity.
- **C4:** every task allocation references a task assignment active for that task/version.
- **C5:** sum of allocations for an AUTO/MANUAL scheduled task equals `effort_hours`, within 0.01h rounding tolerance; zero-effort tasks may be milestones with no allocation.
- **C6:** persisted task `start_date`/computed finish are compatibility projections, not independent editable truth after cutover. `due_date` remains a constraint.
- **C7:** non-contiguous dates or assignee changes produce separate `segment_key` runs.

### Meetings
- **M1:** occurrence end is after start; required attendees belong to the occurrence’s project.
- **M2:** recurrence expansion is deterministic and idempotent by `recurrence_key`.
- **M3:** FIXED occurrences never move during task scheduling and reserve capacity first.
- **M4:** cancellation removes capacity consumption in the next schedule version; historical versions remain immutable.

### Identity/groups
- **I1:** a project member has either a linked `user_id` or placeholder identity; `display_name` is always present; email may be null.
- **I2:** linking preserves `project_member_id` and all references.
- **I3:** role `Guest` cannot receive new task assignments unless policy explicitly changes.
- **I4:** group/company membership never creates capacity by itself and never substitutes for concrete member allocation.

### Rollups
- **R1:** phase effort = sum of direct `effort_hours` for all non-deleted tasks with that `phase_id`, exactly once regardless of hierarchy.
- **R2:** phase scheduled start/end = min/max allocation date/time among those tasks in the selected schedule version; null if none allocated.
- **R3:** phase progress = effort-weighted task progress: `sum(effort_hours * progress_percent) / sum(effort_hours)`. Zero-effort tasks do not affect the weighted result; if all tasks are zero effort, progress is null (UI may display 0%).
- **R4:** phase allocated effort = sum allocation hours; remaining effort = max(phase effort − allocated effort, 0).
- **R5:** Master Schedule displays ordered phase groups plus an explicit **Unphased** group. Meetings may appear within/over a phase visually but never contribute task effort/progress.
- **R6:** rollups are query results/projections, never editable phase columns.

### Versioning/concurrency
- **V1:** schedule inputs increment a project scheduling revision.
- **V2:** APPLY requires expected input revision; stale requests fail with a typed conflict.
- **V3:** a ScheduleVersion and its allocations/projection are immutable after publication.
- **V4:** same normalized input, horizon, and algorithm version yields deterministic allocation ordering and equivalent projection.

## 5. Scheduling algorithm

Use a deterministic serial schedule generation scheme in Rust. Complexity is `O(V + E + allocation slots)` and is appropriate for the observed project scale.

### Inputs
- selected scenario and horizon;
- all non-deleted schedulable tasks;
- hierarchy only for stable display/tie-breaking, never for phase semantics;
- FS dependencies;
- task assignments;
- effective member calendars/capacity exceptions;
- fixed meeting occurrences and attendees;
- manual task constraints (`not_before`, due date, scheduling mode, priority order);
- previous schedule version, optionally used for stability/minimal movement.

### Steps
1. **Normalize and validate:** resolve locale-independent IDs, calculate effective capacities, expand recurring meetings idempotently for the horizon, reject hierarchy/dependency cycles, and report missing assignments.
2. **Reserve fixed meetings:** deduct required attendee meeting intervals/hours from daily capacity. Detect fixed-vs-fixed attendee conflicts; do not silently move either.
3. **Topological order:** Kahn-sort the FS dependency DAG. Stable tie order: dependency-ready date, scheduling mode (manual before auto), priority rank, `priority_order`, phase display order (display stability only), hierarchy path order, task UUID.
4. **Establish earliest start:** maximum of horizon start, task `not_before`, each predecessor finish plus lag, and any accepted manual pin.
5. **Allocate effort:** for each task, walk working dates and assigned members. Consume available capacity in deterministic member order, honoring assignment weights as targets rather than hard constraints. Default capacity is 8h. Emit one or more `TaskAllocation` rows until effort is exhausted.
6. **Segment:** group adjacent allocation slots for the same task/member into segment keys. Weekends, zero-capacity dates, meetings, reassignment, or preemption split segments.
7. **Validate deadlines:** due dates do not truncate work. Record `DUE_DATE_MISSED` diagnostics when computed finish exceeds the deadline.
8. **Produce rollups and diagnostics:** phase/master rollups, unscheduled reasons, capacity conflicts, dependency explanations, movement from prior version.
9. **Persist atomically:** insert immutable version, allocations, diagnostics, and compatibility projection; activate only if APPLY succeeds under expected revision.

### Scheduling modes
- `VALIDATE`: validate current persisted/manual allocations without writing a version.
- `PREVIEW`: compute and return a transient result/projection.
- `APPLY`: persist a new version and projection under optimistic revision check.
- `EXPLAIN`: return ordered causes for a task’s start/finish/unscheduled status.

### Failure/diagnostic codes
`DEPENDENCY_CYCLE`, `HIERARCHY_CYCLE`, `MISSING_ASSIGNMENT`, `PLACEHOLDER_UNLINKED` (warning by default, not necessarily unschedulable), `NO_CAPACITY`, `FIXED_MEETING_CONFLICT`, `DUE_DATE_MISSED`, `OUTSIDE_HORIZON`, `STALE_INPUT_REVISION`, `INVALID_RECURRENCE`, `EFFORT_ALLOCATION_MISMATCH`.

## 6. API surfaces

GraphQL names below use one canonical snake_case contract; temporary camelCase aliases may remain only for current plan operations.

### Queries

```graphql
project_tasks(project_id: ID!, hierarchy: FLAT | TREE = FLAT): [Task!]!
project_phases(project_id: ID!, locale: String!): [ProjectPhase!]!
project_categories(project_id: ID!, locale: String!): [ProjectCategory!]!
project_members(project_id: ID!): [ProjectMember!]!
project_groups(project_id: ID!): [ProjectGroup!]!
companies: [Company!]!
meeting_occurrences(project_id: ID!, from: Date!, to: Date!): [MeetingOccurrence!]!
schedule_scenarios(project_id: ID!): [ScheduleScenario!]!
master_schedule(project_id: ID!, scenario_id: ID, version_id: ID, locale: String!): MasterSchedule!
schedule_explanation(version_id: ID!, task_id: ID!): ScheduleExplanation!
member_capacity(project_id: ID!, from: Date!, to: Date!): [MemberCapacityDay!]!
```

```graphql
type MasterSchedule {
  scenario: ScheduleScenario!
  version: ScheduleVersion!
  phase_groups: [PhaseScheduleGroup!]!
  unphased_group: PhaseScheduleGroup!
  tasks: [ScheduledTask!]!          # flat compatibility list
  meetings: [MeetingOccurrence!]!
  diagnostics: [ScheduleDiagnostic!]!
  input_revision: BigInt!
}

type PhaseScheduleGroup {
  phase: ProjectPhase
  task_ids: [ID!]!
  rollup: PhaseRollup!
}

type PhaseRollup {
  effort_hours: Decimal!
  allocated_hours: Decimal!
  remaining_hours: Decimal!
  progress_percent: Decimal
  scheduled_start: DateTime
  scheduled_end: DateTime
}

type ScheduledTask {
  task: Task!
  allocations: [TaskAllocation!]!
  segments: [AllocationSegment!]!
  computed_start: DateTime
  computed_end: DateTime
  predecessor_ids: [ID!]!
  diagnostics: [ScheduleDiagnostic!]!
}
```

### Mutations

```graphql
create_project_phase(input: ProjectPhaseInput!): ProjectPhase!
update_project_phase(input: UpdateProjectPhaseInput!): ProjectPhase!
archive_project_phase(id: ID!, reassign_to: ID): ProjectPhase!
create_project_category(input: ProjectCategoryInput!): ProjectCategory!
update_project_category(input: UpdateProjectCategoryInput!): ProjectCategory!
archive_project_category(id: ID!, reassign_to: ID): ProjectCategory!

set_task_parent(task_id: ID!, parent_task_id: ID): Task!
set_task_phase(task_ids: [ID!]!, phase_id: ID): BulkTaskResult!
set_task_category(task_ids: [ID!]!, category_id: ID): BulkTaskResult!
set_task_dependencies(task_id: ID!, predecessor_ids: [ID!]!): TaskDependencyResult!
bulk_update_task_effort(input: BulkTaskEffortInput!): BulkTaskResult!

create_project_member(input: CreateProjectMemberInput!): ProjectMember!
link_project_member(project_member_id: ID!, user_id: ID!, merge: MemberMergePolicy): ProjectMember!
create_project_group(input: ProjectGroupInput!): ProjectGroup!
set_project_group_members(group_id: ID!, project_member_ids: [ID!]!): ProjectGroup!
create_company(input: CompanyInput!): Company!
set_company_members(company_id: ID!, project_member_ids: [ID!]!): Company!

upsert_capacity_exception(input: CapacityExceptionInput!): CapacityException!
delete_capacity_exception(id: ID!): Boolean!
create_meeting_series(input: MeetingSeriesInput!): MeetingSeries!
update_meeting_series(input: UpdateMeetingSeriesInput!): MeetingSeries!
create_meeting_occurrence(input: MeetingOccurrenceInput!): MeetingOccurrence!
update_meeting_occurrence(input: UpdateMeetingOccurrenceInput!): MeetingOccurrence!
cancel_meeting_occurrence(id: ID!): MeetingOccurrence!

generate_schedule(input: GenerateScheduleInput!): ScheduleGenerationResult!
activate_schedule_scenario(id: ID!): ScheduleScenario!
create_schedule_scenario(input: CreateScheduleScenarioInput!): ScheduleScenario!
delete_schedule_scenario(id: ID!): Boolean!
```

```graphql
input BulkTaskEffortInput {
  project_id: ID!
  updates: [TaskEffortUpdate!]!
  expected_revision: BigInt
}
input TaskEffortUpdate { task_id: ID!, effort_hours: Decimal! }

input CreateProjectMemberInput {
  project_id: ID!
  display_name: String!
  email: String
  role: ProjectMemberRole!
  position: String
  default_capacity_hours: Decimal
}

input GenerateScheduleInput {
  project_id: ID!
  scenario_id: ID!
  mode: ScheduleMode!
  horizon_start: Date!
  horizon_end: Date!
  expected_input_revision: BigInt!
  stability_policy: KEEP_EXISTING | EARLIEST_FINISH
}
```

All bulk mutations are transactional by default: either all valid updates commit or none do. If product requires partial success later, introduce an explicit `atomic: false`; do not make partial behavior implicit.

## 7. Compatibility strategy for the active Timeline plan UI

### Preserve
- Named plan/scenario dropdown and one active selection per project.
- New/save/delete/select interactions.
- Manual task priority order and filters.
- Project/user views and task modal click behavior.
- Existing flat task list consumption during migration.
- `TaskBar` as the visual primitive, expanded to accept server segments.

### Change behind the boundary
1. `Plan` becomes a compatibility DTO backed by `ScheduleScenario` and its latest version.
2. Server emits legacy `plan_data.tasks[]` fields (`task_id`, `priority_order`, `start_date`, `end_date`, `effort`, `assignee_id`, etc.) from authoritative allocations. Add optional fields without breaking current parsing: `phase_id`, `phase_name`, `segments[]`, `predecessor_ids`, `schedule_version_id`, `input_revision`, `diagnostics` (`web/src/types/plan.ts`, `backend/src/graphql/resolvers/plans/mutation.rs`).
3. Existing `get_project_plans`, `get_latest_project_plan`, `get_plan`, create/update/delete/set-active operations remain temporarily. Their resolvers delegate to scenario/schedule services.
4. During transition, dates submitted by the current `handleSavePlan` are treated as **requested manual constraints** or ignored in AUTO mode; they are never copied directly into authoritative allocation rows. The response immediately returns the server-generated projection (`web/src/components/timeline/Timeline.tsx`).
5. Current Timeline client calls to `calculateTaskSchedule` remain only as a fallback while the new master-schedule query is feature-gated. Once the server response includes segments, rendering uses `computed_start`, `computed_end`, and `segments`; client date math is removed.
6. `tasks.start_date` may be maintained as a compatibility mirror of the active schedule’s computed start. `tasks.due_date` remains the user deadline. The UI must stop interpreting due date as computed schedule end.
7. Preserve flat task ordering in the Timeline, but insert phase header rows client-side from `phase_groups`. Phase headers are not draggable tasks and never pass through `TaskBar`.
8. Task hierarchy remains available in List view. Master Schedule may optionally indent task titles by hierarchy while grouping first by phase; this is a view concern and does not rewrite parents.
9. `assignee_id` remains temporarily populated for a task’s primary linked user. New code uses `TaskAssignment.project_member_id`; placeholder/multi-assignee tasks cannot be faithfully represented by the old field and therefore require the new fields.
10. Replace hard-coded `TaskCategory`/phase labels with fetched IDs and translated labels. Keep legacy strings as import aliases until all rows are migrated (`web/src/types/task.ts`).

## 8. Delivery increments and test gates

### Increment 0 — Contract stabilization
- Select one active Rust plan resolver/type path; document canonical snake_case GraphQL operations while retaining aliases.
- Add Decimal/Date scalars and project scheduling revision.
- Add contract fixtures for existing Timeline plan/task operations before changing them.

**Gate:** existing task/plan GraphQL contract tests pass; current Timeline opens, lists plans, selects active plan, and opens task modal unchanged (`web/src/graphql/__tests__/w3-contract.test.ts`, `web/src/graphql/__tests__/w3-sdl-fixture.test.ts`).

### Increment 1 — Project phase/category taxonomy + hierarchy correctness
- Add phase/category entities and translations.
- Migrate legacy task category strings to project category IDs with alias report.
- Add `phase_id`/`category_id` to task responses.
- Correct arbitrary-depth hierarchy projection; add cycle-safe parent mutation.
- Add phase grouping and Unphased group to Master Schedule read model, still using existing dates.

**Gate:** arbitrary 5+ depth tree round-trip; re-parent cycle rejected with path; parent/child may have different phases; locale fallback tests for en/vi/ja; phase archive with references rejected/reassigned atomically.

### Increment 2 — Members/placeholders/groups/companies
- Convert assignments to stable `project_member_id` targets.
- Permit display-name-only placeholder and optional email.
- Implement explicit linking and collision handling.
- Add project groups and company membership.
- Update member DTO so `user` is nullable and identity display is always available.

**Gate:** create placeholder without email; assign task; link later without changing member/allocation references; duplicate linked user rejected; existing add-by-email flow still works; Guest assignment rule enforced.

### Increment 3 — Dependencies, bulk effort, calendars
- Store exact numeric effort; migrate floats with explicit rounding report.
- Implement transactional bulk effort API and wire List bulk UI.
- Add FS dependencies, DAG validation, default 8h calendars, and date capacity exceptions.
- Expose validation/preview diagnostics without yet activating server-generated dates.

**Gate:** 20h at 8h/day allocates 8/8/4; 0h exception creates a gap; 12h overtime date permits at most 12h; FS chain schedules successor after predecessor; cycle rejected; bulk effort is all-or-nothing; phase effort rollup unaffected by hierarchy depth.

### Increment 4 — Rust schedule versions + Timeline projection cutover
- Implement deterministic PREVIEW/APPLY/EXPLAIN.
- Persist immutable versions/allocations/projection.
- Adapt existing plan operations to scenarios.
- Feature-gate Timeline to server projection and segmented bars.

**Gate:** same input produces equivalent allocations/projection; stale revision rejected; active scenario uniqueness; plan save/load/delete/select compatibility; segmented gaps render; client-calculated dates are not used when projection is present; phase rollups match allocation fixtures.

### Increment 5 — Meetings and recurrence
- Add fixed/ad hoc occurrences, recurring series expansion, attendee capacity reservation, cancellation/edit semantics.
- Render meeting overlays and explanations.

**Gate:** recurrence expansion is idempotent; fixed meeting never moves; attendee capacity is reduced; fixed conflict is diagnosed; cancelled occurrence no longer consumes capacity in new version; historical version unchanged.

### Increment 6 — Hardening and cutover
- Remove client scheduling as source of truth.
- Stop accepting authoritative plan JSON dates.
- Deprecate legacy task `assignee_id`, category string, and plan JSON write fields after telemetry confirms no old clients.
- Add indexes, explain-plan checks, audit records, and migration reconciliation.

**Gate:** full imported project fixture schedules within performance target; no phase is materialized as a task; allocation sums equal effort; no member/date over capacity; all GraphQL and UI regression suites pass; rollback can switch reads to previous schedule version.

## 9. Required test matrix

### Domain/unit
- hierarchy cycle and cross-project parent rejection;
- dependency cycle with returned path;
- FS lag over weekends/zero-capacity dates;
- deterministic tie ordering;
- decimal allocation/rounding conservation;
- locale fallback and immutable taxonomy keys;
- phase rollup with parent and child in same/different phases (no double counting);
- placeholder link/merge policies;
- recurrence DST and timezone boundaries;
- segment splitting by gaps/member changes/meetings.

### Database/integration
- unique active scenario under concurrent activation;
- optimistic revision conflict;
- capacity non-overrun query across task allocations + meetings;
- immutable historical versions;
- transactional bulk effort and taxonomy reassignment;
- migration reconciliation for legacy effort/category/assignee/plan data.

### GraphQL contract
- canonical snake_case plus temporary plan aliases;
- nullable member `user` with stable display identity;
- master schedule flat compatibility fields and segment additions;
- typed diagnostic codes;
- plan compatibility adapter output accepted by current `web/src/types/plan.ts` mapping.

### Frontend/component
- Timeline retains plan controls, filters, task clicks, and project/user views;
- phase headers cannot be dragged or scheduled;
- segmented TaskBar rendering and tooltip effort/date/member details;
- TaskList arbitrary hierarchy and phase/category display;
- bulk effort success, rollback, and revision conflict;
- MembersView placeholder without email and linked-user states.

### End-to-end acceptance
- Create project phases/categories in en/vi/ja; assign independently of task hierarchy.
- Build arbitrary hierarchy, add FS prerequisites, bulk-set effort, add placeholder assignee.
- Configure leave/overtime date exceptions; create fixed, recurring, and ad hoc meetings.
- Generate/apply schedule; verify segmented allocations and no capacity overrun.
- Link placeholder to user; regenerate without losing assignment identity.
- Verify phase/master start, end, effort, allocated effort, remaining effort, and weighted progress.
- Save/select/delete named schedules through the existing Timeline plan UI.

## 10. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Existing plan API/type duplication and update defects | Cutover regressions | Stabilize one resolver path and freeze contract in Increment 0 before scheduler work. |
| Client and server both calculate dates | Divergent bars and saved plans | Feature flag with explicit precedence: server projection wins; remove client scheduling after parity gate. |
| Legacy `due_date` currently acts as visual end | Deadline semantics may appear to change | Introduce explicit `computed_end`; label due date as deadline; compatibility projection supplies `end_date`. |
| Existing `assignee_id` points to users | Cannot represent placeholders/multiple assignees | Add stable project-member assignments; mirror primary linked user only during transition. |
| Arbitrary hierarchy projection bug | Missing grandchildren or incorrect display | Prefer flat API plus client tree builder initially; separately test recursive tree materialization. |
| Phase mistaken for WBS node during import | Violates authoritative requirement | Import phases into `ProjectPhase`; assign `task.phase_id`; never create phase tasks. Add reconciliation assertion. |
| Parent and child both have effort | Stakeholders may expect container rollup | Make direct-effort rule explicit; report hierarchy subtotal separately if desired, but phase total counts task rows once. |
| Meeting hours without intraday slots | False capacity availability/conflicts | Store occurrence timestamps and optional allocation minutes; v1 may reserve hours, but fixed-overlap accuracy requires slot-aware allocation before claiming intraday support. |
| Recurrence/DST complexity | Duplicate or shifted meetings | IANA timezone + local recurrence expansion + stable recurrence key + DST fixtures. |
| Floating legacy effort | Rollup drift | Migrate to Numeric with agreed rounding and reconciliation report before enforcing exact sums. |
| Large allocation table | Read/write growth | Version/horizon partitioning or indexes on `(schedule_version_id, task_id)` and `(schedule_version_id, project_member_id, work_date)`; retain only policy-approved versions. |
| Placeholder identity collision | Wrong account linkage | Explicit link confirmation, uniqueness checks, and merge policy; never auto-link solely by optional email. |
| Schedule churn after small edits | Poor trust/UX | `KEEP_EXISTING` stability policy, movement diagnostics, immutable prior version, preview before apply. |

## 11. Recommendation

Adopt **Option A: normalized relational source of truth, deterministic Rust scheduler, immutable schedule versions, and a server-generated compatibility projection**.

This is the only option that simultaneously preserves the active `Timeline.tsx` plan experience, makes Rust/Postgres authoritative, supports segmented capacity-aware allocation and meetings, and keeps phase semantics correct. The critical modeling choice is to maintain three orthogonal axes:

1. **Task hierarchy** — arbitrary organizational parent/child links.
2. **Phase/category** — project-scoped multilingual task attributes.
3. **Schedule** — versioned allocations constrained by dependencies, capacity, assignments, and meetings.

No phase row enters the task hierarchy or scheduler queue. Master Schedule phase groups and rollups are derived views over tasks and their selected schedule-version allocations.

## 12. Truly blocking user decisions

1. **Parent-task effort semantics:** confirm that when both parent and child tasks have effort, both are real schedulable tickets and both count once in phase totals. Alternative container-parent semantics would materially change allocation and rollups.
2. **Intraday precision:** must task work avoid exact meeting time slots, or is daily-hour capacity subtraction sufficient for v1? Exact avoidance requires minute-level work windows/allocations.
3. **Placeholder scheduling:** may unlinked placeholders receive valid allocations, or should they remain schedulable only with a warning/block? The model supports either policy.
4. **Plan meaning:** should named plans be mutable scenarios with immutable generated versions (recommended), or immutable baselines only? This determines save/update UX and retention policy.
5. **Company scope:** are companies global directory entities shared across projects, or project-local labels? The recommendation assumes global companies and project-local groups.
