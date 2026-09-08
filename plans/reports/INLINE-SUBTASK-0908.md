# INLINE-SUBTASK-0908

## Status

DONE

## Scope

- Inline subtask drafts in Normal and Excel List rows at arbitrary hierarchy depth.
- Multiple drafts, optional create fields, partial-failure retention/retry, authoritative Redux insertion.
- Missing Normal editors for Progress, Actual start, Actual end, and Tags.
- No backend/schema, Gantt, Kanban, deployment, or environment changes.

## Implementation checkpoint

- Extracted inline draft input builder and table-row editor.
- Reused `buildCreateTaskInput`, project catalog labels, canonical resource-member options, and `CREATE_TASK`.
- Create mutation now reuses the complete shared `TaskFields` response contract.
- New child upserts attach by `parent_task_id` at arbitrary depth.
- Successful drafts are removed independently; failed drafts retain values/errors for retry.
- Normal/Excel switches preserve drafts; navigation/unload guards warn.
- Added Normal authoritative editors and clear paths for Progress, Actual dates, and Tags.

## Focused tests

Executed with `--config jest.config.js --reporters=default` using the existing sibling dependency installation because the isolated worktree has no `node_modules`.

- `TaskListView.assignment.test.tsx`: 15 passed
  - arbitrary parent/child creation
  - multiple same-parent drafts
  - partial failure retention and duplicate-free retry
  - authoritative hierarchy insertion
  - Normal Progress/Actual dates/Tags null clears
- `TaskExcelGrid.test.tsx`: 24 passed
  - add action on every Excel row
  - immediate draft placement after selected parent
  - existing staged edit/navigation/paste coverage retained
- `inline-subtask.test.ts`: 2 passed
  - trimmed title validation and canonical parent
  - optional fields and unlinked resource assignment mapping
- Total focused tests: 41 passed
- `git diff --check`: passed

## Limitations

- Inline create exposes all fields supported by backend `CreateTaskInput`; actual dates are update-only because create schema does not accept them.
- Optional fields are compacted under a native `details` section.

## Unresolved questions

None.
