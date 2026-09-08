# KANBAN-RUNTIME-0908

Status: DONE

## Source
- Branch: `codex/kanban-runtime-0908`
- Implementation commit: `b06681d`
- Integrated dev commit: `6e06435`
- Base commit: `e43556a`

## Root cause
`KanbanBoard.tsx` removed `useTaskStatusUpdate()` while switching status writes to the Redux `updateTaskStatus` thunk, but two render expressions still dereferenced the removed `updateTaskStatusMutation`. Rendering any task card therefore threw `ReferenceError: updateTaskStatusMutation is not defined`.

## Fix
- Track the active status-update task ID locally around the existing Redux thunk.
- Use that state for drag disabling and pending-card pulse styling.
- Preserve canonical member options, descendant rendering, status rendering, optimistic update, success handling, and rollback.
- Add direct render and pending-state regressions.

## Focused evidence
Command:

```text
NODE_PATH=<dev web dependencies> jest --config jest.config.js --reporters=default --runInBand src/components/tasks/__tests__/kanban-board-render.test.tsx src/components/tasks/__tests__/kanban-tasks.test.ts src/components/tasks/__tests__/kanban-member-options.test.ts
```

Result in isolated worktree: 3 suites passed, 7 tests passed, 0 failed.

Post-integration result in `dev-0908/web` at `6e06435`: 3 suites passed, 7 tests passed, 0 failed in 6.104s.

Also: `git diff --check` passed; no `updateTaskStatusMutation` references remain in `KanbanBoard.tsx`.

## Known gaps
- No full lint/build/browser sweep per fast-fix scope.
- Default Jest config references unavailable `jest-junit`; focused run overrode reporters with `default`.

## Unresolved questions
- None.
