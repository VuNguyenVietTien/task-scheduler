# STATUS-VISIBILITY-0908

## Result

- Added shared task status visibility rule.
- Default List, Kanban, Gantt hide terminal statuses: `DONE`, `CLOSE`, `REJECTED`, `ARCHIVED`.
- Explicit status selections show selected status only.
- List/Gantt retain required ancestor context and prune unrelated descendants.
- Kanban status selector now exposes all statuses while default columns remain unfinished-only.
- Removed List's separate completed toggle; status filter is sole visibility authority.

## Files

- `web/src/utils/task-status-visibility.ts`
- `web/src/utils/__tests__/task-status-visibility.test.ts`
- `web/src/components/tasks/TaskListView.tsx`
- `web/src/components/tasks/KanbanBoard.tsx`
- `web/src/components/timeline/Timeline.tsx`

## Verification

- PASS: status visibility unit tests, 6/6.
- PASS: focused status + Gantt hierarchy tests, 11/11.
- PASS: `git diff --check`.
- Typecheck remains red from pre-existing repository-wide errors; no errors referenced changed files.
- ESLint unavailable because existing config extends missing `next/typescript`.

## Concerns

- Kanban's pending descendant-rendering branch still owns visual descendant hierarchy. Shared tree helper is wired now for that merge.

## Unresolved questions

- None.
