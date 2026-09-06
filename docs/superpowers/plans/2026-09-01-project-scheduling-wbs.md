# Project Scheduling and WBS Implementation Plan

> **For agentic workers:** Execute one checkbox at a time with strict file ownership. Start every task by inspecting only its owned paths. Stop with `BLOCKED_COLLISION` if an owned path contains unexpected user changes that cannot be preserved. No version-control publishing operations are authorized.

**Goal:** Deliver project-scoped multilingual phases, correct WBS hierarchy, two immediately useful Gantt modes, exact work planning, then capacity scheduling, meetings, and a controlled issue-1115 import in four practical increments.

**Architecture:** Increment 1 exposes a replaceable `ProjectScheduleProjection` built from current task dates/effort/progress so phase CRUD and both Gantt modes are independently usable. Increment 2 enriches that projection with exact effort, assignments, and prerequisites. Increment 3 replaces its producer with Rust/Postgres capacity allocations. Increment 4 adds meetings and controlled import apply. Phase remains only a task attribute; source headings remain display/provenance metadata.

**Stack:** Rust, Actix-web, async-graphql, SQLx/Postgres, rust_decimal, Next.js/React/TypeScript, Jest/Testing Library, Playwright.

**Design:** `docs/superpowers/specs/2026-09-01-project-scheduling-wbs-design.md`

---

## Global constraints

- Modify product files only when executing this plan; this planning pass changes documentation only.
- Never run reset, clean, path-replacement, broad formatting, destructive migration, deployment, production/non-throwaway database, or unrelated-file operations.
- Before each implementation task run `git status --short -- <owned paths>` and `git diff -- <owned paths>`. Inspection is allowed; publishing is not.
- Applied migrations and `backend/src/migration_runner.rs` behavior are immutable. Add new forward-only migrations and preserve dependency/checksum evidence.
- Phase is a project-scoped task attribute only. It cannot be a task, task parent, source WBS group, dependency endpoint, assignment, allocation, meeting, or capacity consumer.
- Real task hierarchy stays arbitrary-depth and independent from phase, category, and prerequisites.
- Exactly five default phase keys/order/translations are required: `creation`, `try-s-review-1`, `address-review-comments-1`, `try-s-review-2`, `toshiba-review`.
- Issue 1115 gates are exact: 23 non-task headings, 156 tasks, workflow counts `69/69/6/6/6`, `387.00h`; issue 1139 is `40.00h`, Shuichi Nakayama, source WBS row 5.
- Use Postgres `NUMERIC(10,2)`, Rust `Decimal`, and GraphQL decimal strings for new schedule truth.
- Preserve Timeline plan CRUD/selection, priority ordering, filters, date controls, project/member views, modal opening, and existing task bars.
- `plans.plan_data` remains compatibility projection, not authoritative allocation truth.
- New schedule history/scenario infrastructure is out of scope unless existing code proves it mandatory and a separate approval is obtained. Increment 3 may transactionally replace the current projection/allocation set.
- Shared hotspots have one owner at a time:
  - GraphQL composition: tasks 1.3, 2.3, 3.3, and 4.3 sequentially own `backend/src/graphql/schema.rs`, `backend/schema.graphql`, and web SDL fixtures.
  - Timeline integration: tasks 1.4, 2.4, 3.4, and 4.4 sequentially own `web/src/components/timeline/Timeline.tsx`.
- Workers add focused modules first; hotspot owners integrate after producer tests are green.

## Execution overview and agent-session estimates

An **agent session** is one focused 60–120 minute implementation/test/review cycle. Estimates include targeted tests but exclude waiting for external import configuration or resolving unrelated dirty-file collisions.

| Increment | Independently usable outcome | Parallel shape | Estimate |
|---|---|---|---:|
| 1 | Phase/category CRUD+i18n, safe hierarchy, dry run/provenance, placeholders/classification, phase selector/filter, WBS Detail preserved, current-date Master Schedule | 1.1 and 1.2 parallel; 1.3 then 1.4; 1.5 acceptance | 8–12 sessions |
| 2 | Exact member effort, FS dependencies, bulk effort, Gantt effort edit/labels, richer current-date phase rollups | 2.1 and 2.2 parallel; 2.3 then 2.4; 2.5 acceptance | 7–10 sessions |
| 3 | Capacity-aware Rust scheduler, allocations/segments, both modes upgraded through same projection | 3.1 and 3.2 parallel; 3.3 then 3.4; 3.5 acceptance | 9–13 sessions |
| 4 | Recurring/fixed/ad hoc meetings, capacity overlays, import apply/reconciliation, hardening | 4.1 and 4.2 parallel; 4.3 then 4.4; 4.5 final review | 8–12 sessions |

Increment 1 is the immediate execution target. Increments 2–4 must not delay its release.

---

# Increment 1 — Foundations and immediately usable phase/two-mode slice

## Task 1.1 — Project taxonomy, exact seed, and hierarchy correctness

**Owner:** Backend foundation worker  
**Depends on:** none  
**May run with:** Task 1.2  
**Exclusive paths:**

- Create `backend/migrations/20260901000100_create_project_taxonomies.sql`
- Create `backend/src/domain/taxonomy.rs`
- Create `backend/src/db/models/taxonomy.rs`
- Create `backend/src/graphql/resolvers/taxonomies/**`
- Create `backend/tests/contract/taxonomy_hierarchy.rs`
- Modify `backend/src/db/models/mod.rs`
- Modify `backend/src/db/models/task.rs`
- Modify `backend/src/graphql/resolvers/tasks/query/tasks.rs`
- Modify task phase/category mutation files under `backend/src/graphql/resolvers/tasks/mutation/`

**Do not touch:** `backend/src/graphql/schema.rs`, `backend/schema.graphql`, web files.

- [ ] **RED — write failing migration/domain tests**

Test the exact five keys/order and ja/en/vi labels, idempotent seed for existing/new projects, locale fallback, same-project foreign keys, archive reassignment, five-level hierarchy materialization, cycle rejection, and reparent-with-phase-preservation.

```bash
cd backend
cargo test --test taxonomy_hierarchy -- --nocapture
cargo test --test migration_evidence -- --nocapture
```

Expected RED: taxonomy tables/services and deep-tree correction do not exist.

- [ ] **Implement the smallest foundation**

Add project phase/category tables/translations and nullable `tasks.phase_id/category_id`. Seed exactly the accepted rows. Build tree nodes by task ID/reference indexes rather than recursively mutating detached clones. Reject self/cycle/cross-project reparenting.

- [ ] **GREEN — focused verification**

```bash
cd backend
cargo test --test taxonomy_hierarchy -- --nocapture
cargo test --test migration_evidence -- --nocapture
cargo check --all-targets
```

- [ ] **Handoff contract**

Provide Task 1.3 with taxonomy service/type names, seed evidence, phase/category task fields, and hierarchy test output. Acceptance: no phase row has task/schedule semantics and parent changes do not alter phase/category.

## Task 1.2 — Import dry-run/provenance and stable resource identities

**Owner:** Backend import/resource worker  
**Depends on:** none  
**May run with:** Task 1.1  
**Exclusive paths:**

- Create `backend/migrations/20260901000200_create_import_provenance.sql`
- Create `backend/migrations/20260901000300_create_resource_membership.sql`
- Create `backend/src/imports/mod.rs`
- Create `backend/src/imports/issue_1115.rs`
- Create `backend/src/imports/manifest.rs`
- Create `backend/src/domain/resource_identity.rs`
- Create `backend/src/graphql/resolvers/resource_members/**`
- Create `backend/src/bin/import_redmine.rs`
- Create `backend/tests/import_issue_1115_dry_run.rs`
- Create `backend/tests/contract/resource_members.rs`

**Do not touch:** schema composition, existing member resolver files, Timeline, task hierarchy files.

- [ ] **RED — dry-run and identity tests**

```bash
cd backend
cargo test --test import_issue_1115_dry_run -- --nocapture
cargo test --test resource_members -- --nocapture
```

Require a static bundle; validate root 1115, 23 headings, 156 tasks, `69/69/6/6/6`, `387.00`, issue 1139 `40.00`/Shuichi Nakayama/WBS row 5, duplicate identities, hierarchy cycles, mapping ambiguity, and zero writes in dry-run mode. Test display-name-only placeholder creation, stable account linking, and non-assignable groups/companies.

- [ ] **Implement provenance and validator only**

Add import-run/source identity/WBS group records and placeholder/classification records. No browser/session replay. No import apply. `tracker-Phase` rows normalize only to source WBS groups.

- [ ] **GREEN — focused verification**

```bash
cd backend
cargo test --test import_issue_1115_dry_run -- --nocapture
cargo test --test resource_members -- --nocapture
cargo check --bin import_redmine
```

- [ ] **Handoff contract**

Provide Task 1.3 with resource GraphQL types/resolver roots and dry-run manifest schema. Acceptance: rerun is deterministic; no source heading can satisfy a task/assignment/dependency relation.

## Task 1.3 — Increment 1 GraphQL contract and current-field projection

**Owner:** Increment 1 GraphQL integration worker; sole schema owner for this task  
**Depends on:** Tasks 1.1 and 1.2  
**Exclusive paths:**

- Create `backend/src/scheduling/projection.rs`
- Create `backend/src/graphql/resolvers/schedule_projection/**`
- Create `backend/tests/contract/increment1_graphql.rs`
- Modify `backend/src/graphql/schema.rs`
- Modify `backend/schema.graphql`
- Modify `web/src/graphql/__tests__/w3-contract.test.ts`
- Modify `web/src/graphql/__tests__/w3-sdl-fixture.test.ts`

**Do not touch:** Timeline/UI files or existing plan resolver implementations.

- [ ] **RED — contract tests**

```bash
cd backend
cargo test --test increment1_graphql -- --nocapture
cd ../web
npx jest src/graphql/__tests__/w3-contract.test.ts src/graphql/__tests__/w3-sdl-fixture.test.ts --runInBand
```

Require taxonomy reads/writes, task phase/category assignment, resource member reads/writes, import dry-run manifest, and `projectScheduleProjection(projectId)` with `source: CURRENT_TASK_FIELDS`, WBS rows, phase groups, Unphased, current task dates/effort/progress, and no schedule-engine dependency.

- [ ] **Implement focused composition**

Preserve user-owned schema diffs. Compute projection rollups once per real task regardless of hierarchy. Treat source headings as a distinct union/object with no task ID/bar callbacks. Return legacy float effort as a normalized display decimal string until Increment 2 migration.

- [ ] **GREEN — schema/contract verification**

```bash
cd backend
cargo test --test increment1_graphql -- --nocapture
cargo test --test taxonomy_hierarchy -- --nocapture
cargo check --all-targets
cd ../web
npx jest src/graphql/__tests__/w3-contract.test.ts src/graphql/__tests__/w3-sdl-fixture.test.ts --runInBand
```

- [ ] **Handoff contract**

Give Task 1.4 exact SDL operation/field names and current-field projection fixture. Acceptance: GraphQL contract works without capacity/allocation/meeting/version tables.

## Task 1.4 — Phase administration, selector/filter, and both Gantt modes

**Owner:** Increment 1 frontend integration worker; sole Timeline/locales owner for this task  
**Depends on:** Task 1.3  
**Exclusive paths:**

- Create `web/src/types/taxonomy.ts`
- Create `web/src/types/schedule-projection.ts`
- Create `web/src/graphql/queries/taxonomies.ts`
- Create `web/src/graphql/mutations/taxonomies.ts`
- Create `web/src/graphql/queries/scheduleProjection.ts`
- Create `web/src/hooks/useProjectTaxonomies.ts`
- Create `web/src/hooks/useScheduleProjection.ts`
- Create `web/src/lib/scheduling/build-wbs-rows.ts`
- Create `web/src/lib/scheduling/build-master-rows.ts`
- Create `web/src/components/timeline/ScheduleModeControl.tsx`
- Create `web/src/components/timeline/PhaseScheduleRow.tsx`
- Create `web/src/components/timeline/WbsSourceHeadingRow.tsx`
- Create focused taxonomy settings/selector components under `web/src/components/projects/`
- Create tests under `web/src/lib/scheduling/__tests__/` and `web/src/components/timeline/__tests__/`
- Modify `web/src/components/timeline/Timeline.tsx`
- Modify `web/src/components/tasks/TaskListView.tsx`
- Modify `web/src/types/task.ts`
- Modify only scheduling/taxonomy keys in `web/src/i18n/locales/{en,vi,ja}/*.json`

**Do not touch:** `TaskBar.tsx`, backend files, plan resolver files.

- [ ] **RED — UI shaping and regression tests**

```bash
cd web
npx jest src/lib/scheduling/__tests__/build-wbs-rows.test.ts src/lib/scheduling/__tests__/build-master-rows.test.ts src/components/timeline/__tests__/increment1-modes.test.tsx --runInBand
```

Require deep hierarchy, non-task source headings, exact phase order plus Unphased, current-date min/max, direct-effort sum, weighted progress, one contribution per task, phase selector/filter, en/vi/ja labels, mode switch with no mutation, and preserved existing Timeline controls/task modal.

- [ ] **Implement the immediate vertical slice**

Add phase/category settings and task phase selector/filter. Integrate `WBS_DETAIL | MASTER_SCHEDULE` using the GraphQL current-field projection. Keep existing task bars and plan controls. Phase/source rows are non-draggable and never passed to task callbacks.

- [ ] **GREEN — focused and static verification**

```bash
cd web
npx jest src/lib/scheduling/__tests__/build-wbs-rows.test.ts src/lib/scheduling/__tests__/build-master-rows.test.ts src/components/timeline/__tests__/increment1-modes.test.tsx --runInBand
npx tsc --noEmit
npm run build
```

- [ ] **Acceptance**

Increment 1 is independently deployable behind flags: multilingual phase CRUD/seed, phase assignment/filter, hierarchy-safe WBS Detail, and current-date Master Schedule all work with no capacity scheduler.

## Task 1.5 — Increment 1 migration and browser acceptance

**Owner:** Independent Increment 1 verifier  
**Depends on:** Tasks 1.1–1.4  
**Exclusive paths:**

- Create `web/e2e/project-scheduling-wbs-increment1.spec.ts`
- Create `docs/testing/project-scheduling-wbs-increment1.md`

- [ ] **RED — write acceptance checks before the final run**

Cover project creation seed, translations/fallback, CRUD/reorder/archive, five-level reparent with phase preservation, phase filter, WBS Detail, Master Schedule/Unphased/rollups, no writes on mode switch, placeholder linking, and issue-1115 dry-run gates.

- [ ] **GREEN — run the increment gate**

```bash
cd backend
cargo test --test migration_evidence -- --nocapture
cargo test --test taxonomy_hierarchy -- --nocapture
cargo test --test import_issue_1115_dry_run -- --nocapture
cargo test --test resource_members -- --nocapture
cargo test --test increment1_graphql -- --nocapture
cd ../web
npx jest src/graphql/__tests__/w3-contract.test.ts src/graphql/__tests__/w3-sdl-fixture.test.ts src/lib/scheduling/__tests__/build-wbs-rows.test.ts src/lib/scheduling/__tests__/build-master-rows.test.ts src/components/timeline/__tests__/increment1-modes.test.tsx --runInBand
npx tsc --noEmit
npm run build
npx playwright test e2e/project-scheduling-wbs-increment1.spec.ts
```

Record pass/fail and unrelated baseline failures. Do not repair files outside task ownership.

---

# Increment 2 — Exact work planning and current-date Gantt upgrades

## Task 2.1 — Decimal task effort and explicit member assignments

**Owner:** Backend work-planning worker  
**Depends on:** Increment 1 accepted  
**May run with:** Task 2.2  
**Exclusive paths:**

- Create `backend/migrations/20260901000400_create_task_assignments_dependencies.sql`
- Create `backend/src/domain/task_work.rs`
- Create `backend/src/graphql/resolvers/task_work/**`
- Create `backend/tests/contract/task_work.rs`
- Modify `backend/src/db/models/task.rs`
- Modify `backend/src/graphql/resolvers/tasks/mutation/update_effort.rs`

- [ ] **RED**

```bash
cd backend
cargo test --test task_work -- --nocapture
```

Test exact conversion/reconciliation, non-negative two-decimal input, `6.00 + 10.00 = 16.00`, stable placeholder assignment, one canonical single/bulk service, and all-or-nothing bulk failure.

- [ ] **Implement and GREEN**

Add `effort_hours NUMERIC(10,2)` and assignment rows. Mirror legacy fields only at compatibility boundaries.

```bash
cd backend
cargo test --test task_work -- --nocapture
cargo test --test migration_evidence -- --nocapture
cargo check --all-targets
```

## Task 2.2 — Explicit finish-to-start prerequisites

**Owner:** Backend dependency worker  
**Depends on:** Increment 1 accepted  
**May run with:** Task 2.1  
**Exclusive paths:**

- Create `backend/src/domain/dependencies.rs`
- Create `backend/src/graphql/resolvers/dependencies/**`
- Create `backend/tests/contract/task_dependencies.rs`

- [ ] **RED**

```bash
cd backend
cargo test --test task_dependencies -- --nocapture
```

Test self/duplicate/cross-project/deleted/cycle rejection with cycle path. Test that phase/source heading/member/group/company IDs cannot be endpoints.

- [ ] **Implement and GREEN**

```bash
cd backend
cargo test --test task_dependencies -- --nocapture
cargo check --all-targets
```

## Task 2.3 — Increment 2 GraphQL/projection extension

**Owner:** Increment 2 GraphQL integration worker; sole schema owner for this task  
**Depends on:** Tasks 2.1 and 2.2  
**Exclusive paths:**

- Modify `backend/src/scheduling/projection.rs`
- Modify `backend/src/graphql/resolvers/schedule_projection/**`
- Create `backend/tests/contract/increment2_graphql.rs`
- Modify `backend/src/graphql/schema.rs`
- Modify `backend/schema.graphql`
- Modify `web/src/graphql/__tests__/w3-contract.test.ts`
- Modify `web/src/graphql/__tests__/w3-sdl-fixture.test.ts`

- [ ] **RED**

```bash
cd backend
cargo test --test increment2_graphql -- --nocapture
cd ../web
npx jest src/graphql/__tests__/w3-contract.test.ts src/graphql/__tests__/w3-sdl-fixture.test.ts --runInBand
```

Require decimal strings, assignments, predecessor IDs, transactional bulk effort, and phase rollups updated from exact effort while projection source remains `CURRENT_TASK_FIELDS`.

- [ ] **Implement and GREEN**

```bash
cd backend
cargo test --test increment2_graphql -- --nocapture
cargo test --test task_work -- --nocapture
cargo test --test task_dependencies -- --nocapture
cd ../web
npx jest src/graphql/__tests__/w3-contract.test.ts src/graphql/__tests__/w3-sdl-fixture.test.ts --runInBand
```

## Task 2.4 — Bulk effort and Gantt effort/dependency UI

**Owner:** Increment 2 frontend integration worker; sole Timeline/TaskBar owner for this task  
**Depends on:** Task 2.3  
**Exclusive paths:**

- Create `web/src/graphql/mutations/taskWork.ts`
- Create `web/src/hooks/useTaskWorkMutations.ts`
- Create `web/src/components/timeline/DependencyLinks.tsx`
- Create/update focused tests under `web/src/components/tasks/__tests__/` and `web/src/components/timeline/__tests__/`
- Modify `web/src/components/tasks/TaskBulkActions.tsx`
- Modify `web/src/components/tasks/TaskListView.tsx`
- Modify `web/src/components/timeline/TaskBar.tsx`
- Modify `web/src/components/timeline/Timeline.tsx`
- Modify `web/src/types/task.ts`

- [ ] **RED**

```bash
cd web
npx jest src/components/tasks/__tests__/bulk-effort.test.tsx src/components/timeline/__tests__/effort-dependencies.test.tsx --runInBand
```

Test two-decimal validation, transactional optimistic rollback, visible effort label when space permits/tooltip otherwise, inline effort edit, prerequisite links, and immediate current-date Master rollup refresh.

- [ ] **Implement and GREEN**

```bash
cd web
npx jest src/components/tasks/__tests__/bulk-effort.test.tsx src/components/timeline/__tests__/effort-dependencies.test.tsx src/components/timeline/__tests__/increment1-modes.test.tsx --runInBand
npx tsc --noEmit
npm run build
```

## Task 2.5 — Increment 2 gate

**Owner:** Independent Increment 2 verifier  
**Depends on:** Tasks 2.1–2.4  
**Exclusive path:** Create `docs/testing/project-scheduling-wbs-increment2.md`

```bash
cd backend
cargo test --test migration_evidence -- --nocapture
cargo test --test task_work -- --nocapture
cargo test --test task_dependencies -- --nocapture
cargo test --test increment2_graphql -- --nocapture
cd ../web
npx jest src/graphql/__tests__/w3-contract.test.ts src/graphql/__tests__/w3-sdl-fixture.test.ts src/components/tasks/__tests__/bulk-effort.test.tsx src/components/timeline/__tests__/effort-dependencies.test.tsx src/components/timeline/__tests__/increment1-modes.test.tsx --runInBand
npx tsc --noEmit
npm run build
```

Acceptance: Increment 1 remains usable; exact work planning adds no scheduler dependency.

---

# Increment 3 — Capacity-aware authoritative scheduler and segments

## Task 3.1 — Capacity calendars and normalized allocation storage

**Owner:** Backend capacity worker  
**Depends on:** Increment 2 accepted  
**May run with:** Task 3.2  
**Exclusive paths:**

- Create `backend/migrations/20260901000500_create_capacity_allocations.sql`
- Create `backend/src/domain/calendars.rs`
- Create `backend/src/graphql/resolvers/calendars/**`
- Create `backend/tests/contract/capacity_calendars.rs`

- [ ] **RED**

```bash
cd backend
cargo test --test capacity_calendars -- --nocapture
```

Test precedence date exception → member default → project default → `8.00`, leave `0`, overtime, authorization, and exact decimal serialization.

- [ ] **Implement and GREEN**

Add normalized current allocation/projection tables only. Do not add scenario/history tables.

```bash
cd backend
cargo test --test capacity_calendars -- --nocapture
cargo test --test migration_evidence -- --nocapture
cargo check --all-targets
```

## Task 3.2 — Deterministic scheduler service

**Owner:** Rust scheduler worker  
**Depends on:** Increment 2 accepted; consumes Task 3.1 interfaces after available  
**Exclusive paths:**

- Create `backend/src/scheduling/engine.rs`
- Create `backend/src/scheduling/types.rs`
- Create `backend/src/scheduling/repository.rs`
- Create `backend/tests/scheduling_engine.rs`

- [ ] **RED — pure scheduler tests**

```bash
cd backend
cargo test --test scheduling_engine -- --nocapture
```

Require `20h → 8/8/4`, leave gaps/segments, overtime bounds, two-member conservation, FS ordering, no member/date over capacity, deterministic repeated result, unschedulable diagnostics, stale revision rejection, and transaction rollback on invariant failure.

- [ ] **Implement minimal engine**

Topologically order explicit dependencies, use stable task/member/date ordering, allocate exact assignment effort, derive stable contiguous segments and phase rollups, then transactionally replace the project's current generated allocations/projection after revision check.

- [ ] **GREEN**

```bash
cd backend
cargo test --test scheduling_engine -- --nocapture
cargo check --all-targets
```

## Task 3.3 — Increment 3 GraphQL projection source switch

**Owner:** Increment 3 GraphQL integration worker; sole schema owner for this task  
**Depends on:** Tasks 3.1 and 3.2  
**Exclusive paths:**

- Modify `backend/src/scheduling/projection.rs`
- Modify `backend/src/graphql/resolvers/schedule_projection/**`
- Create `backend/tests/contract/increment3_graphql.rs`
- Modify `backend/src/graphql/schema.rs`
- Modify `backend/schema.graphql`
- Modify `web/src/graphql/__tests__/w3-contract.test.ts`
- Modify `web/src/graphql/__tests__/w3-sdl-fixture.test.ts`

- [ ] **RED**

```bash
cd backend
cargo test --test increment3_graphql -- --nocapture
```

Require validate/generate operations, revision conflict, diagnostics, allocations/segments, and `source: CAPACITY_SCHEDULER`; retain the same WBS/phase grouping contract and current-field fallback.

- [ ] **Implement and GREEN**

```bash
cd backend
cargo test --test increment3_graphql -- --nocapture
cargo test --test scheduling_engine -- --nocapture
cd ../web
npx jest src/graphql/__tests__/w3-contract.test.ts src/graphql/__tests__/w3-sdl-fixture.test.ts --runInBand
```

## Task 3.4 — Upgrade both Gantt modes to allocation segments

**Owner:** Increment 3 frontend integration worker; sole Timeline/TaskBar owner for this task  
**Depends on:** Task 3.3  
**Exclusive paths:**

- Modify `web/src/types/schedule-projection.ts`
- Modify `web/src/hooks/useScheduleProjection.ts`
- Create `web/src/components/timeline/AllocationSegments.tsx`
- Modify `web/src/components/timeline/TaskBar.tsx`
- Modify `web/src/components/timeline/PhaseScheduleRow.tsx`
- Modify `web/src/components/timeline/Timeline.tsx`
- Create `web/src/components/timeline/__tests__/capacity-segments.test.tsx`

- [ ] **RED**

```bash
cd web
npx jest src/components/timeline/__tests__/capacity-segments.test.tsx src/components/timeline/__tests__/increment1-modes.test.tsx --runInBand
```

Test gaps/segments, member allocations, allocated/remaining phase effort, source fallback, unchanged phase grouping, source-heading non-interactivity, and preserved legacy controls.

- [ ] **Implement and GREEN**

```bash
cd web
npx jest src/components/timeline/__tests__/capacity-segments.test.tsx src/components/timeline/__tests__/effort-dependencies.test.tsx src/components/timeline/__tests__/increment1-modes.test.tsx --runInBand
npx tsc --noEmit
npm run build
```

## Task 3.5 — Increment 3 gate and shadow comparison

**Owner:** Independent Increment 3 verifier  
**Depends on:** Tasks 3.1–3.4  
**Exclusive paths:**

- Create `backend/tests/sql/capacity_invariants.sql`
- Create `docs/testing/project-scheduling-wbs-increment3.md`

Run exact effort/capacity invariant SQL, deterministic regeneration, current-field versus capacity projection comparison, performance fixture for 156 tasks, and both-mode browser checks. Record actual local elapsed time; target under 2 seconds excluding DB startup.

```bash
cd backend
cargo test --test migration_evidence -- --nocapture
cargo test --test capacity_calendars -- --nocapture
cargo test --test scheduling_engine -- --nocapture
cargo test --test increment3_graphql -- --nocapture
cd ../web
npx jest src/components/timeline/__tests__/capacity-segments.test.tsx src/components/timeline/__tests__/increment1-modes.test.tsx --runInBand
npx tsc --noEmit
npm run build
```

---

# Increment 4 — Meetings, import apply/reconciliation, and hardening

## Task 4.1 — Recurring, fixed, and ad hoc meetings

**Owner:** Backend meetings worker  
**Depends on:** Increment 3 accepted  
**May run with:** Task 4.2  
**Exclusive paths:**

- Create `backend/migrations/20260901000600_create_meetings.sql`
- Create `backend/src/domain/meetings.rs`
- Create `backend/src/graphql/resolvers/meetings/**`
- Create `backend/tests/contract/meetings.rs`
- Modify `backend/src/scheduling/engine.rs` only after Task 3.2 handoff review

- [ ] **RED**

```bash
cd backend
cargo test --test meetings -- --nocapture
cargo test --test scheduling_engine meeting -- --nocapture
```

Test stable recurrence keys, repeated expansion, IANA timezone/DST, fixed/ad hoc occurrences, attendee-only capacity reservation, cancellation on regeneration, fixed conflicts, and phase classification with zero phase effort.

- [ ] **Implement and GREEN**

```bash
cd backend
cargo test --test meetings -- --nocapture
cargo test --test scheduling_engine -- --nocapture
cargo test --test migration_evidence -- --nocapture
cargo check --all-targets
```

## Task 4.2 — Transactional issue-1115 apply and reconciliation

**Owner:** Import apply worker  
**Depends on:** Increment 3 accepted and approved static bundle/configuration  
**May run with:** Task 4.1  
**Exclusive paths:**

- Modify `backend/src/imports/issue_1115.rs`
- Modify `backend/src/imports/manifest.rs`
- Modify `backend/src/bin/import_redmine.rs`
- Create `backend/tests/import_issue_1115_apply.rs`
- Create `backend/tests/sql/issue_1115_reconciliation.sql`

- [ ] **RED**

```bash
cd backend
cargo test --test import_issue_1115_apply -- --nocapture
```

Test one transaction under project/root advisory lock, snapshot revalidation, parent-first WBS/task writes, explicit phase/assignee/dependency mapping, exact counts/effort, issue 1139, rerun idempotency, source/local conflict policy, and rollback on every hard-gate failure.

- [ ] **Implement minimal apply path**

No live scraping or browser credentials. Unknown status/priority/date/timezone/assignee/dependency mappings block. Importer-owned fields only; source headings remain non-task metadata.

- [ ] **GREEN**

```bash
cd backend
cargo test --test import_issue_1115_dry_run -- --nocapture
cargo test --test import_issue_1115_apply -- --nocapture
cargo check --bin import_redmine
```

## Task 4.3 — Increment 4 GraphQL and compatibility integration

**Owner:** Increment 4 GraphQL integration worker; sole schema and existing-plan-resolver owner for this task  
**Depends on:** Tasks 4.1 and 4.2  
**Exclusive paths:**

- Modify `backend/src/graphql/schema.rs`
- Modify `backend/schema.graphql`
- Modify `backend/src/graphql/resolvers/schedule_projection/**`
- Modify existing files under `backend/src/graphql/resolvers/plans/**`
- Create `backend/tests/contract/increment4_graphql.rs`
- Create `backend/tests/contract/plan_schedule_compat.rs`
- Modify `web/src/graphql/__tests__/w3-contract.test.ts`
- Modify `web/src/graphql/__tests__/w3-sdl-fixture.test.ts`

- [ ] **RED**

```bash
cd backend
cargo test --test increment4_graphql -- --nocapture
cargo test --test plan_schedule_compat -- --nocapture
```

Require meeting CRUD/range reads, meeting projection overlays, authorized import status/apply boundary, legacy plan CRUD/selection preservation, server-produced compatibility `plan_data`, and rejection of client-authored authoritative allocation fields when scheduler mode is active.

- [ ] **Implement and GREEN**

```bash
cd backend
cargo test --test increment4_graphql -- --nocapture
cargo test --test plan_schedule_compat -- --nocapture
cd ../web
npx jest src/graphql/__tests__/w3-contract.test.ts src/graphql/__tests__/w3-sdl-fixture.test.ts --runInBand
```

## Task 4.4 — Meeting overlays and final Timeline integration

**Owner:** Increment 4 frontend integration worker; sole Timeline/locales owner for this task  
**Depends on:** Task 4.3  
**Exclusive paths:**

- Create `web/src/components/timeline/MeetingOverlay.tsx`
- Create focused meeting GraphQL/hooks/types files under `web/src/graphql/`, `web/src/hooks/`, `web/src/types/`
- Create `web/src/components/timeline/__tests__/meeting-overlays.test.tsx`
- Modify `web/src/components/timeline/Timeline.tsx`
- Modify only meeting/scheduling keys in `web/src/i18n/locales/{en,vi,ja}/*.json`

- [ ] **RED**

```bash
cd web
npx jest src/components/timeline/__tests__/meeting-overlays.test.tsx src/components/timeline/__tests__/capacity-segments.test.tsx --runInBand
```

Test recurring/fixed/ad hoc visual distinction, no task modal/drag/resize behavior, attendee capacity diagnostics, mode parity, and zero phase effort contribution.

- [ ] **Implement and GREEN**

```bash
cd web
npx jest src/components/timeline/__tests__/meeting-overlays.test.tsx src/components/timeline/__tests__/capacity-segments.test.tsx src/components/timeline/__tests__/increment1-modes.test.tsx --runInBand
npx tsc --noEmit
npm run build
npm run lint
```

## Task 4.5 — Final acceptance and independent review

**Owner:** Independent final reviewer; no implementation ownership  
**Depends on:** Tasks 4.1–4.4  
**Exclusive paths:**

- Create `web/e2e/project-scheduling-wbs.spec.ts`
- Create `docs/testing/project-scheduling-wbs-acceptance.md`
- Create `docs/reviews/2026-09-01-project-scheduling-wbs-review.md`

- [ ] **Run full evidence matrix**

```bash
cd backend
cargo test --all-targets --all-features
cargo check --all-targets
cd ../web
npx jest --runInBand
npx tsc --noEmit
npm run build
npm run lint
npx playwright test e2e/project-scheduling-wbs-increment1.spec.ts e2e/project-scheduling-wbs.spec.ts
```

Also run live throwaway-Postgres migration/bootstrap/checksum evidence and issue-1115 reconciliation SQL. Never use production/non-throwaway databases.

- [ ] **Review semantic invariants**

Prove phase/source heading/group/company/meeting objects never become tasks, hierarchy nodes, dependency endpoints, assignments, or task allocations. Prove each real task contributes once to Master Schedule and both modes use the selected projection source.

- [ ] **Review rollout and fallback**

Demonstrate feature flags, Increment 1 current-field projection fallback, capacity projection switch, meeting disable behavior, and legacy plan read/selection preservation without reversing migrations or deleting domain rows.

- [ ] **Issue verdict**

Return `ACCEPT` only when every increment gate is green and all issue-1115 hard gates reconcile. Otherwise return `REWORK` with exact failing command, invariant, and owner path.

---

## Requirement traceability

| Requirement | Primary tasks |
|---|---|
| Exact phase CRUD/seed/i18n | 1.1, 1.3, 1.4, 1.5 |
| Arbitrary hierarchy independent from phase | 1.1, 1.4, 1.5 |
| Immediate WBS Detail + Master Schedule from current fields | 1.3, 1.4, 1.5 |
| Safe 1115 dry-run/provenance | 1.2, 1.3, 1.5 |
| Placeholder members/groups/company | 1.2, 1.3, 1.5 |
| Exact per-member effort and bulk edit | 2.1, 2.3, 2.4, 2.5 |
| Explicit FS dependencies | 2.2, 2.3, 2.4, 2.5 |
| Replaceable schedule projection | 1.3, 2.3, 3.3 |
| Capacity scheduler and segments | 3.1–3.5 |
| No mandatory schedule history/scenarios | Global constraints, 3.1–3.3 |
| Meetings/overlays | 4.1, 4.3, 4.4, 4.5 |
| Issue-1115 transactional apply/reconciliation | 4.2, 4.3, 4.5 |
| Legacy Timeline/plan preservation | 1.4, 3.4, 4.3–4.5 |
| Forward-only migration safety | 1.1, 1.2, 2.1, 3.1, 4.1, every gate |
| Dirty-worktree/shared-hotspot safety | Global constraints and all ownership blocks |

## Ready state

Start Tasks 1.1 and 1.2 in parallel after targeted dirty-path inspection. Do not start Task 1.3 until both producer handoffs pass. Do not start Task 1.4 until the checked SDL and web contract fixtures are green. Increment 1 is the first release gate and must not absorb Increment 2–4 scope.
