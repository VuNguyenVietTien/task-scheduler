# TASK-REDUX-NULL-HIERARCHY-0908

## Status

DONE

## Root cause

- Task mutation resolvers expose unloaded `child_tasks` as `null`; frontend normalization converted that to `[]`, so a normal parent edit erased Redux children and collapsed the visible hierarchy.
- Excel rows render from a separate flat query. Successful bulk mutations updated Redux but did not retain every authoritative returned field, so staged clears disappeared and stale query values returned.
- Native effort number input consumed arrow keys as numeric increments and rejected a fully blank value.

## Changes

- Preserve existing `child_tasks` for omitted/`null` mutation relationships; accept an explicit array, including `[]`, as authoritative.
- Redux tree merge preserves omitted/`undefined` fields and applies explicit `null` for parent/catalog/task type/category/progress/assignee/effort/date values.
- Excel saves retain authoritative status, priority, effort, due-date, title, catalog, and assignment patches per row; `null` values remain visible immediately without reload.
- Blank Excel effort stages as empty and saves as `0`, matching the current backend numeric update contract.
- Effort/date editors commit before ArrowUp/Down/Left/Right or Enter navigation; Enter moves down. Native increment behavior is prevented.
- Existing fixed column widths and rectangular row-major TSV copy/paste remain intact.

## Focused tests

PASS:

```text
cd web && npx jest --config jest.config.js --reporters default --runInBand --silent \
  src/redux/features/__tests__/tasks-realtime.test.ts \
  src/components/tasks/__tests__/TaskListView.assignment.test.tsx \
  src/components/tasks/__tests__/TaskExcelGrid.test.tsx

3 suites passed, 38 tests passed
```

Coverage added for:

- parent/child relationship preservation after normal parent edit;
- omitted parent preservation versus explicit null clears;
- explicit null catalog/task type/category/progress/assignee/effort/date merge;
- multi-row Excel authoritative null clear;
- blank effort-to-zero save and immediate render;
- arrow/Enter commit-before-navigation;
- rectangular row-major copy and clipped/validated TSV paste.

`git diff --check`: PASS.

Full `tsc --noEmit`: remains blocked by pre-existing unrelated repository errors; no new diagnostics were reported in changed production/test files.

## Constraints

- No deploy or production mutation.
- No backend/database changes.

## Tooling notes

- MemPalace startup failed because the configured executable path was unavailable.
- Requested reviewer/debugger delegation unavailable in this runtime (`Available: none`); focused local review and tests used instead.

## Unresolved questions

- None.
