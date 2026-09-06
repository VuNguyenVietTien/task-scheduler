# PM Corrective Implementation Plan Report — Project Scheduling/WBS

**Date:** 2026-09-01  
**Scope:** Documentation-only corrective pass  
**Final verdict:** **ACCEPT**

## Authorized deliverables

Updated only:

1. `docs/superpowers/specs/2026-09-01-project-scheduling-wbs-design.md`
2. `docs/superpowers/plans/2026-09-01-project-scheduling-wbs.md`
3. `plans/reports/herdr-260901-1842-scheduling-wbs-implementation/reports/pm-impl-plan-1.md`

No product code, database, migration, deployment, browser state, or unrelated dirty-worktree content was changed.

## Corrections completed

### 1. Removed unauthorized version-control publishing steps

The implementation plan contains no staging, publishing, conditional publishing, or conventional-message steps. Worker guidance now permits targeted dirty-path inspection only and explicitly says publishing operations are not authorized.

Mandatory proof command:

```bash
rg -n -i 'git[[:space:]]+add|git[[:space:]]+commit|commit instruction|conditional commit|conventional commit' docs/superpowers/plans/2026-09-01-project-scheduling-wbs.md
```

Result: **PASS — no matches found.**

### 2. Made the requested vertical slice independent from the capacity scheduler

Increment 1 now immediately delivers:

- exact project phase/category CRUD, order, translations, and five-phase seed;
- `tasks.phase_id` and `tasks.category_id`;
- arbitrary-depth hierarchy correction with phase-preserving reparenting;
- GraphQL taxonomy/task assignment/current-projection contract;
- phase selector and filter;
- preserved WBS Detail behavior;
- Master Schedule phase rollups derived from current task dates, effort, and progress;
- explicit Unphased grouping;
- safe issue-1115 dry run/provenance;
- stable placeholder members plus non-assignable group/company classifications.

The slice is explicitly accepted as independently deployable and testable with no capacity/allocation/meeting/history tables.

### 3. Reframed delivery into exactly four practical increments

Proof from the plan:

```text
# Increment 1 — Foundations and immediately usable phase/two-mode slice
# Increment 2 — Exact work planning and current-date Gantt upgrades
# Increment 3 — Capacity-aware authoritative scheduler and segments
# Increment 4 — Meetings, import apply/reconciliation, and hardening
```

No fifth increment exists.

- **Increment 1:** phase/category CRUD+i18n, hierarchy, dry-run/provenance, placeholders/groups/company, and immediate two-mode Gantt.
- **Increment 2:** exact per-member effort, dependencies, list bulk effort, Gantt effort label/edit, and current-date Master rollups.
- **Increment 3:** capacity-aware Rust/Postgres scheduler and segmented allocations, upgrading both modes without changing task/phase semantics.
- **Increment 4:** recurring/fixed/ad hoc meetings, capacity overlays, transactional import apply/reconciliation, and final hardening.

Each increment contains small RED/implementation/GREEN tasks, explicit paths, exact commands, dependencies, and disjoint Herdr ownership.

### 4. Reduced scheduling abstraction

The design and plan define a replaceable `ProjectScheduleProjection`:

- Increment 1 producer: current task/plan fields.
- Increment 2 producer: current dates plus exact effort/assignments/dependencies.
- Increment 3 producer: authoritative capacity allocations and segments.
- Increment 4 extension: meeting overlays and capacity reservations.

New immutable schedule history/scenario infrastructure is deferred. It is not a prerequisite for phase CRUD, either Gantt mode, capacity scheduling, or import. Increment 3 may transactionally replace the current generated projection/allocation set with stale-revision protection. Additional history infrastructure requires separate evidence and approval.

### 5. Replaced worker-day estimates with agent-session estimates

The plan estimates focused 60–120 minute agent sessions:

| Increment | Estimate |
|---|---:|
| 1 | 8–12 sessions |
| 2 | 7–10 sessions |
| 3 | 9–13 sessions |
| 4 | 8–12 sessions |

Increment 1 is the immediate execution target; later increments cannot delay it.

### 6. Preserved shared-file and dirty-worktree safety

Sequential single ownership is explicit for:

- `backend/src/graphql/schema.rs`
- `backend/schema.graphql`
- web SDL contract fixtures
- `web/src/components/timeline/Timeline.tsx`
- `web/src/components/timeline/TaskBar.tsx` when touched
- shared locale files
- existing plan resolvers in final compatibility integration

Each worker inspects only owned paths before editing and reports `BLOCKED_COLLISION` when existing changes cannot be safely preserved. Destructive cleanup, broad formatting, and unrelated edits remain prohibited.

## Mandatory self-check results

| Check | Result |
|---|---|
| No forbidden staging/publishing instruction patterns in plan | PASS |
| Exactly four increment headings | PASS — 4 |
| `ProjectScheduleProjection` stated as replaceable interface | PASS |
| Increment 1 explicitly works without capacity scheduler | PASS |
| Increment 1 includes phase CRUD/seed, task phase, GraphQL, selector/filter, WBS Detail, Master Schedule | PASS |
| Capacity scheduler delayed until Increment 3 | PASS |
| Meetings and import apply delayed until Increment 4 | PASS |
| Shared GraphQL/schema owner serialized | PASS |
| Timeline owner serialized | PASS |
| Exact issue-1115 gates retained | PASS |
| Only authorized documentation paths changed by corrective pass | PASS |

## Final verdict

**ACCEPT**

All manager REWORK reasons are resolved. The corrected plan is practical, immediately executable at Increment 1, avoids making future scheduler/history infrastructure a dependency of requested phase and Gantt behavior, preserves exact file/command/TDD/ownership guidance, and contains no unauthorized publishing instructions.

## Unresolved questions

None for plan acceptance. Increment 4 import execution still requires the approved static issue-1115 bundle and explicit operator mapping policy; missing configuration blocks only import apply, not Increments 1–3.
