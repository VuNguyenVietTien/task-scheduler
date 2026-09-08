# EXCEL-INTERACTION-0908

## Status

DONE

## Commit

- Branch: `codex/excel-interaction-0908`
- Implementation: `0e98301771776277273b98ac37936e708912f20c`
- Base: `357fdaa78da0e2bdcef5362f0c42410ff31fd945`

## Delivered

- Excel single click now selects only; double click opens the field-appropriate text, number, date, or select editor.
- Status and priority use validated staged dropdowns. Status options retain the existing no-`REJECTED` editor contract.
- One-cell clipboard values broadcast over the selected rectangle. Every target still uses direct-edit validation; read-only/invalid cells report errors and do not stage writes.
- Existing ordered multi-cell TSV paste, keyboard navigation, drafts, dirty count, explicit bulk Save, leave guard, fixed widths, hierarchy, null/clear handling, and authoritative save flow remain in place.
- Normal List and Excel parent effort render read-only sums of descendant leaf efforts. Nested parent effort is not double-counted; canonical task effort and mutation payloads remain untouched.
- Excel parent totals react immediately to staged leaf effort edits; Normal totals react to authoritative leaf saves.
- No Gantt, scheduler, assignee loader, Redux/API contract, backend, schema, dependency, deployment, or production-data change.

## Files

- `web/src/components/tasks/TaskExcelGrid.tsx`
- `web/src/components/tasks/TaskListView.tsx`
- `web/src/components/tasks/__tests__/TaskExcelGrid.test.tsx`
- `web/src/components/tasks/__tests__/TaskListView.assignment.test.tsx`

## Focused tests

Final verification ran from the integrated `dev-0908/web` dependency installation:

```text
npm test -- --config jest.config.js --reporters=default --runInBand \
  src/components/tasks/__tests__/TaskExcelGrid.test.tsx \
  src/components/tasks/__tests__/TaskListView.assignment.test.tsx

2 suites passed; 44 tests passed; 0 failed
```

The suite emits existing React `act(...)` warnings and expected error-path logging; Jest exits successfully. `git diff --check` passed before implementation commit.

## Limitations

- Parent totals use the hierarchy loaded by each List mode; missing/unloaded descendants cannot be included.
- List member-filter wiring is not part of this commit. It remains a separate coordinated change after the member worker's canonical modal-prop update; assignee loaders were intentionally untouched.

## Unresolved questions

- None.
