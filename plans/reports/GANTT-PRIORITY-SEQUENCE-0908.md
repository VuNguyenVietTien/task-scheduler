# GANTT-PRIORITY-SEQUENCE-0908

## Delivered
- `computeTaskAllocations` now carries a per-member planning cursor through its stable, priority-ordered input.
- Lower-ranked work starts no earlier than that member's preceding allocated work, while other assignees remain independent.
- Explicit task start dates remain minimum constraints; existing capacity, reservations, weekends, leave, effort, and exhaustion behavior remain unchanged.

## Same-day capacity
A following task may consume unused hours on its predecessor's final workday. This is sequential in the existing daily-capacity model: combined allocation never exceeds available hours; the UI has day-level, not time-of-day, granularity.

## Validation
- Passed: 31 tests / 2 suites: `task-allocations.test.ts`, `capacity-scheduling.test.ts`.
- Added coverage for future-dated blocking, assignee independence, weekend/leave handling, stable order, and daily-capacity non-overlap.
- Tests ran with a temporary minimal Jest config because repository configs are currently unusable as-is: automatic config selection finds both `jest.config.js` and `jest.config.mjs`; the MJS config references absent `ts-jest`; JS config references absent `jest-junit`.

## Scope
- No backend, List/create, deployment, schema, migration, or production-data changes.

## Unresolved questions
- None.
