# Gantt plan UX root-cause report

## Root causes

- Saved-plan selection had no one-time initialization, so Gantt stayed in No plan despite saved revisions being available.
- Snapshot parsing treated absent legacy `hoursPerDay` as corruption. Deleting/selecting around such history could fail instead of preserving known data.
- Allocation eligibility excluded only DONE/CLOSE. REJECTED/ARCHIVED tasks could still create resource demand and an unassigned 2h row even though WBS hid them.
- Master rows bucketed tasks before proving authoritative allocation. Unknown-hour, unscheduled tasks therefore fabricated a current-day Unclassified row.
- Member cells exposed implementation-heavy labels/colors instead of assigned-versus-capacity status.

## Fixes

- Initialize once per project to the first returned saved plan; preserve explicit No plan; corrupt newest falls back visibly to No plan and never selects an older revision.
- Parse absent legacy `hoursPerDay` as unknown allocation, while rejecting malformed supplied values.
- Share terminal-status eligibility across allocations, resource cells, and Master rows.
- Build Master rows only from eligible positive allocations, or from a valid saved start/end span when legacy hours are unknown. Date-only legacy spans retain empty `hours_per_day` and no `total_hours`; phase metadata remains unclassified when absent.
- Reduce member cells to Assigned/Working with white/yellow/green/red capacity states; localize No plan, fallback, and delete UX.

## Newest-first evidence

`backend/src/graphql/resolvers/plan_lifecycle.rs:347-356` documents saved plans as newest-first and executes:

```sql
SELECT ... FROM plans
WHERE project_id = $1
ORDER BY created_at DESC, revision DESC
```

The frontend can therefore select index 0 without client-side reordering.

## Verification

- PASS: 39 focused tests across plan lifecycle hook/parser, allocation eligibility, and Master-row construction.
- PASS: 22 selected Timeline wiring tests, including live/saved Master layout, legacy unclassified history, no-task views, unknown historical cells, saved authority, and localized fallback.
- One unrelated assertion failed in the same Timeline file: `R5 live auto-sort preserves hidden slots...` expected `mockReorderMutation` to be called, received 0. No production or test changes in this slice touch that reorder path.
- `git diff --check` and locale JSON parsing passed.

## Unresolved questions

None.
