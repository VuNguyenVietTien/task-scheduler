# TASK-EDITORS-0908 — Frontend task editors

## Status
DONE_WITH_CONCERNS

## Delivered
- Normal List: title editor plus immediate project-scoped selectors for Progress type, Category, Task type, and canonical Assignee; unlinked members included; blank selections send `null`.
- Confirmed Normal mutations normalize authoritative task responses and upsert Redux/local trees immediately.
- Excel List: staged dropdowns for the same four fields, native number/date editors for effort/due date, stable catalog IDs, TSV copy/paste, dirty count, stable scroll, explicit bulk Save, and failed-edit retention.
- Excel Save performs no mutation while editing; confirmed full task responses flow through Redux upsert paths.
- Focused tests cover selectors, null clears, authoritative upserts, native input UX, bulk-save deferral, copy/paste, scroll stability, and failure retention.

## Verification
- PASS: `npx jest --config jest.config.js --reporters default --runInBand --silent src/components/tasks/__tests__/TaskExcelGrid.test.tsx src/components/tasks/__tests__/TaskListView.assignment.test.tsx src/components/tasks/__tests__/project-catalog-task-fields.test.ts src/components/tasks/__tests__/task-excel-grid-guard.test.tsx`
- Result: 4 suites, 31 tests passed.
- PASS: changed-file TypeScript diagnostic filter returned no `TaskExcelGrid`/`TaskListView` errors.
- PASS: `git diff --check`.
- Full `tsc --noEmit` remains red on numerous pre-existing unrelated repository errors.

## Files
- `web/src/components/tasks/TaskListView.tsx`
- `web/src/components/tasks/TaskExcelGrid.tsx`
- `web/src/components/tasks/__tests__/TaskListView.assignment.test.tsx`
- `web/src/components/tasks/__tests__/TaskExcelGrid.test.tsx`

## Unresolved questions
- None.
