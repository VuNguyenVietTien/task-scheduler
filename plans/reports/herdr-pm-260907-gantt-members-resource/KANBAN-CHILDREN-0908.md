# KANBAN-CHILDREN-0908

## Outcome

- Kanban now flattens the authoritative nested task forest once in parent-first order and emits each task identity once.
- Every parent and descendant is grouped by its own status; malformed/missing status falls back to Todo.
- Closed, rejected, and archived tasks have matching columns instead of disappearing.
- Child cards show parent context and depth metadata.
- Drag, external status updates, and task-detail updates patch nodes in place without flattening or dropping descendants.
- Confirmed drag results retain the existing tree passed to `onTasksReorder`.

## Files

- `web/src/components/tasks/KanbanBoard.tsx`
- `web/src/components/tasks/kanban-tasks.ts`
- `web/src/components/tasks/__tests__/kanban-tasks.test.ts`

## Verification

- PASS: `cd web && npx jest --config jest.config.js --reporters default --runInBand src/components/tasks/__tests__/kanban-tasks.test.ts src/redux/features/__tests__/tasks-realtime.testRut.ts`
   - 2 suites, 6 tests passed."
