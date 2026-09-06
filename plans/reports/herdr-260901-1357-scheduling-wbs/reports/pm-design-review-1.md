# Independent Corrective Design Review — Scheduling/WBS

**Verdict: ACCEPT**

The new authoritative clarification resolves the only material product ambiguity. The design is coherent if implemented with the architecture and acceptance gates below.

The controlling rule is:

> **Product phase is a project-scoped, customizable document workflow-stage attribute on each task/ticket. Phase is never a task, task-hierarchy node, WBS container, schedulable object, capacity consumer, meeting, or dependency endpoint.**

Redmine issue 1115, its root, and its 23 source `tracker-Phase` rows are source-structure metadata only. They are not product phases and do not enter phase rollups.

## 1. Approved architecture

The product has five orthogonal concepts. They must not be collapsed into one another.

### 1.1 Task hierarchy

- `Task.parent_task_id` represents arbitrary task/subtask hierarchy.
- Only real tasks may be parent or child tasks.
- Hierarchy is shown in **WBS Detail** mode.
- Re-parenting never changes `phase_id`.
- The existing recursive query may remain, but its clone-based tree construction must be corrected so arbitrary depth is preserved.
- Parent/child relationships do not imply prerequisites.

### 1.2 Product workflow phase

- Every task/ticket has one `phase_id` referencing a project-scoped phase.
- A phase has a stable ID/key, display order, active/archived state, and multilingual translations.
- Project owners may add, edit, archive, reorder, and translate phases.
- Phase order is workflow/display order; it does not by itself create task dependencies.
- Phase rollups are derived from tasks and allocations, never persisted as editable phase schedule fields.

Recommended minimum tables:

```text
project_phases
- phase_id
- project_id
- phase_key
- display_order
- is_active
- created_at
- updated_at
- UNIQUE(project_id, phase_key)

project_phase_translations
- phase_id
- locale
- name
- description?
- UNIQUE(phase_id, locale)
```

Tasks gain `phase_id`. Archive is allowed only when affected tasks are atomically reassigned or the caller explicitly accepts an Unphased result.

### 1.3 Prerequisites

- Prerequisites connect real work tickets through task-to-task finish-to-start edges.
- Dependencies are independent of hierarchy and phase.
- Endpoints must be distinct tasks in the same project.
- Self-edges, cycles, cross-project edges, source WBS headings, phases, meetings, companies, and groups are invalid dependency endpoints.
- Phase order may guide creation of explicit workflow-ticket prerequisites, but it never substitutes for persisted dependency edges.

### 1.4 Effort, members, capacity, and allocations

- Assignments and allocations target stable `project_member_id`, not groups or companies.
- A project member may be linked to a user or remain a display-name placeholder; email is optional.
- Explicit account linking preserves `project_member_id` and all task/allocation references.
- Per-member effort must be explicit and conserved. Recommended invariant:
  - each task assignment has `effort_hours`;
  - task effort equals the sum of assignment effort;
  - generated allocations for each member equal that assignment effort within decimal rounding tolerance.
- Capacity fallback is exactly:
  1. member/date exception;
  2. member default;
  3. project-calendar default;
  4. `8h`.
- Leave is effective capacity `0h` for the date.
- Overtime is an effective capacity greater than the normal default.
- Allocation segments represent actual member/date work and expose gaps caused by leave, weekends, meetings, prerequisites, or reassignment.
- Company and project-group membership are classification/filtering constructs only. They never create pooled capacity and are never task assignees.

### 1.5 Meetings

- Recurring, fixed, and ad hoc meetings are separate calendar entities.
- Required attendees are concrete project members.
- Meetings reserve attendee capacity before tasks are allocated.
- Meetings may be rendered as overlays but are never tasks, hierarchy nodes, dependency endpoints, or phase effort/progress contributors.
- Minimum scheduling may subtract daily meeting hours while preserving exact timestamps for display and future intraday scheduling.

## 2. Required default phase seed

Each project receives these five ordered workflow phases. Keys are immutable identifiers; owners may edit translations, archive phases, add phases, and reorder the active phase list.

| Order | Recommended key | Japanese (`ja`) | English (`en`) | Vietnamese (`vi`) |
|---:|---|---|---|---|
| 1 | `creation` | 作成 | Creation | Tạo tài liệu |
| 2 | `try-s-review-1` | Try-Sレビュー① | Try-S Review 1 | Đánh giá Try-S lần 1 |
| 3 | `address-review-comments-1` | 指摘修正① | Address Review Comments 1 | Sửa theo góp ý lần 1 |
| 4 | `try-s-review-2` | Try-Sレビュー② | Try-S Review 2 | Đánh giá Try-S lần 2 |
| 5 | `toshiba-review` | 東芝レビュー | Toshiba Review | Đánh giá Toshiba |

Required translation behavior:

- Labels are not identifiers.
- Read fallback is requested locale → project default locale → first available translation → immutable key.
- Reordering changes display/workflow order, not task hierarchy or existing dependency edges.
- Editing a translation immediately updates phase selectors, filters, phase headers, and Master Schedule labels without rewriting tasks.

## 3. Two-mode Gantt contract

The Gantt must expose two explicit modes with one authoritative schedule source. Switching modes changes grouping/presentation, not the underlying task, phase, dependency, effort, or allocation records.

### 3.1 WBS Detail mode

Purpose: detailed work planning and source-oriented navigation.

- Preserves the current arbitrary task parent/subtask hierarchy.
- Displays detailed task allocations and allocation gaps.
- Supports prerequisites, member assignment, per-member effort, visible effort labels, and inline effort editing.
- May show the Redmine root and 23 source `tracker-Phase` labels as non-interactive source/WBS headings when useful.
- Source headings are display metadata only:
  - no task ID;
  - no `parent_task_id` participation;
  - no `phase_id` role;
  - no effort or progress;
  - no assignee or allocation;
  - no capacity consumption;
  - no dependency endpoints;
  - no draggable/resizable task bar;
  - no contribution to Master Schedule rollups.
- Real task hierarchy remains task-to-task only. Source headings must not be stored as substitute task parents.

### 3.2 Master Schedule mode

Purpose: project-level workflow visibility.

- Groups all real task allocations by `task.phase_id` in project phase order.
- Includes an explicit **Unphased** group for tasks without a valid active phase during migration/reassignment.
- Does not group by Redmine root, source `tracker-Phase` row, WBS heading, task parent, company, or member group.
- Phase header rows are derived, non-editable schedule summaries and are never task bars.
- A task appears once under its own `phase_id`, regardless of hierarchy depth.
- Meetings may appear as overlays but never contribute task effort or progress.

Required phase rollups for the selected authoritative schedule:

```text
phase effort
  = sum of direct task effort for non-deleted tasks with the phase_id,
    counting each task exactly once

phase allocated effort
  = sum of task allocation hours for those tasks

phase remaining effort
  = max(phase effort - phase allocated effort, 0)

phase scheduled start/end
  = min/max allocation timestamp or date among those tasks;
    null when the phase has no allocated task work

phase progress
  = sum(task effort × task progress) / sum(task effort)
    for positive-effort tasks;
    null when all included tasks have zero effort
```

Unscheduled task effort remains part of phase effort but does not fabricate phase dates. Source headings and meetings contribute zero to every formula.

## 4. Issue 1115 import mapping

### 4.1 Source structure treatment

- Root issue `1115` (`Detailed Design`) is source-root metadata only.
- The 23 source `tracker-Phase` rows are source/WBS display metadata only.
- They are neither product phases nor tasks.
- The import creates exactly the 156 source `tracker-Task` tickets as task rows.
- A source task parent that is another real `tracker-Task` maps to `parent_task_id`.
- A source task whose source parent is the root or a `tracker-Phase` row has no phase-derived task parent. Its source root/heading/path/order are retained only in provenance/display metadata.
- Source metadata may include root ID, source heading ID/title, source parent ID, WBS path, sibling position, and source row. It is not authoritative scheduling data.

### 4.2 Workflow-name to product-phase mapping

The importer resolves workflow labels to the seeded phase IDs by immutable mapping configuration, not by translated display-name lookup at runtime.

| Redmine workflow name | Expected count | Product phase key | Product phase order |
|---|---:|---|---:|
| `Create` | 69 | `creation` | 1 |
| `Try-S Review 1` | 69 | `try-s-review-1` | 2 |
| `Address Review Comments 1` | 6 | `address-review-comments-1` | 3 |
| `Try-S Review 2` | 6 | `try-s-review-2` | 4 |
| `Toshiba Review` | 6 | `toshiba-review` | 5 |

Every imported task receives the resolved `phase_id`. Unknown or ambiguous workflow names are hard validation failures; they must not silently become categories, statuses, source headings, or Unphased tasks.

### 4.3 Workflow prerequisites

For each document/cycle, work tickets progress through the ordered chain:

```text
Creation
  → Try-S Review 1
  → Address Review Comments 1
  → Try-S Review 2
  → Toshiba Review
```

Dependency rules:

- Create explicit finish-to-start edges only between tickets proven to belong to the same document/cycle.
- Prefer explicit predecessor IDs from the extraction bundle.
- Otherwise require a stable approved `cycle_key` that uniquely pairs stage tickets.
- Never pair globally by title or workflow label.
- Do not infer a phase object as a dependency endpoint.
- When an intermediate stage is absent, report a partial chain and do not bridge the gap unless an explicit source predecessor says to do so.
- The count pattern means many cycles legitimately stop after Try-S Review 1; this does not invalidate the import.

### 4.4 Import hard gates

A dry run and apply must prove:

- source root is `1115`;
- 23 source `tracker-Phase` metadata rows;
- exactly 156 source `tracker-Task` rows;
- workflow counts `69 + 69 + 6 + 6 + 6 = 156`;
- imported task effort totals exactly `387.00h` after the approved decimal conversion;
- issue `1139` maps to `40.00h`, Shuichi Nakayama’s linked or placeholder project member, and source WBS row 5;
- every task has one of the five resolved product `phase_id` values;
- zero source phase/root rows become tasks, task parents, product phases, dependency endpoints, allocations, or capacity consumers;
- rerunning the same bundle creates no duplicate task/member/dependency identity;
- any hard validation or write error leaves no partial domain import.

## 5. Minimum coherent implementation increments

### Increment 1 — Phase taxonomy, hierarchy correctness, and import

- Add project-scoped phase and translation CRUD.
- Seed the five ordered ja/en/vi phases exactly as specified.
- Add `tasks.phase_id` and phase selection/filtering.
- Fix arbitrary-depth task tree projection and cycle-safe re-parenting.
- Add stable external source identity and provenance fields.
- Implement Issue 1115 dry run/apply with root/23 headings as metadata and 156 real tasks.

**Acceptance:**

1. A project is seeded with the exact five keys, order, and translations.
2. Owner can add, edit, archive, reorder, and translate phases.
3. Translation fallback works for ja/en/vi and a missing locale.
4. A five-level task hierarchy round-trips without losing descendants.
5. Parent/child tasks may have different phases; re-parenting preserves phase.
6. Issue 1115 dry run/apply passes all import hard gates above.
7. WBS Detail may display source headings, but database/API assertions prove they are not task hierarchy nodes or product phases.

### Increment 2 — Members, effort, bulk editing, and prerequisites

- Make project-member user/email nullable while keeping a stable display identity.
- Add explicit placeholder-to-user linking.
- Add company and project-group membership without assignment/capacity semantics.
- Migrate effort to exact decimal.
- Add per-member assignment effort and task-total conservation.
- Add FS dependencies with cycle validation.
- Wire List bulk effort.
- Add visible Gantt effort labels and inline effort editing in WBS Detail.

**Acceptance:**

1. A display-name-only placeholder can be assigned without email.
2. Linking later preserves project-member, assignment, and allocation identity.
3. A task with member A=`6.00h` and B=`10.00h` has task total `16.00h` and preserves both member totals.
4. Bulk effort is transactional; invalid input changes no selected task and UI rolls back.
5. Gantt shows effort on the bar when space permits and in a tooltip otherwise.
6. Inline effort editing validates non-negative decimals, persists through one canonical mutation, and refreshes rollups.
7. Dependency cycles and cross-project edges are rejected; returned diagnostics identify the offending path.
8. Company/group membership never makes a group assignable and never changes capacity.

### Increment 3 — Capacity-aware schedule and two Gantt modes

- Add project/member default capacity and date exceptions.
- Add concrete member/date allocations and segment gaps.
- Make server allocations authoritative in scheduling-enabled views.
- Implement WBS Detail and Master Schedule contracts.
- Derive phase rollups from the same selected schedule allocations.

**Acceptance:**

1. Capacity resolves exception → member default → project default → `8h`.
2. `20h` at `8h/day` allocates `8/8/4`.
3. A zero-hour leave date splits the visible allocation into separate segments.
4. An overtime date allows work up to, but never beyond, its explicit effective capacity.
5. A successor starts only after its predecessor completes.
6. WBS Detail preserves task hierarchy and detailed allocations.
7. Master Schedule displays the five phase groups in configured order plus Unphased.
8. Master rollups match fixture calculations and count each task once regardless of hierarchy.
9. Source root/headings and meetings contribute no phase effort, dates, progress, or capacity.
10. Switching modes does not mutate tasks, phases, dependencies, assignments, or allocations.

### Increment 4 — Meetings and hardening

- Add recurring series, fixed occurrences, ad hoc occurrences, attendees, cancellation, and timezone handling.
- Reserve attendee capacity before task allocations.
- Render meeting overlays in both modes without task or phase semantics.
- Add import/schedule reconciliation, contract tests, and indexes.

**Acceptance:**

1. Recurrence expansion is deterministic and idempotent across timezone/DST fixtures.
2. Fixed and ad hoc meetings reserve capacity only for their attendees.
3. Cancellation removes capacity consumption from the next schedule result.
4. Meetings never appear in task counts, hierarchy, prerequisites, or phase effort/progress.
5. No member/date exceeds effective capacity after meetings and task allocations are combined.
6. Full Issue 1115 fixture schedules successfully with 156 tasks and zero source phase/root schedule objects.

## 6. Corrections to the prior review findings

The prior REWORK findings are superseded as follows:

- The earlier phase-mapping blocker is resolved: product phase is the five-stage document workflow, not `Detailed Design` and not the 23 source `tracker-Phase` headings.
- Source headings may be retained for WBS Detail display, but not as product entities with task-hierarchy or scheduling semantics.
- There is no competing WBS-group rollup in Master Schedule.
- Groups remain member-classification objects and are not assignees.
- Per-member effort is explicit rather than represented only by assignment weights.
- Gantt modes now have an explicit presentation contract and share one authoritative allocation source.
- Phase CRUD, translations, import mapping, prerequisite creation, rollups, and no-phase-task invariants now have concrete acceptance tests.

## 7. Remaining blockers

**None.**

Status/priority aliases, source timezone, source/local overwrite policy, and exact predecessor/cycle data remain required import configuration inputs, but they are validation/configuration requirements rather than unresolved product-domain questions. Unknown values must block the individual import run rather than cause heuristic or fabricated mappings.
