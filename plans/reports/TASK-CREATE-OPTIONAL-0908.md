# TASK-CREATE-OPTIONAL-0908

## Status

DONE

## Delivered

- Updated active shared `NewTaskForm`, used by both `/projects/[id]/add-task` and `/projects/[id]/tasks/[taskId]/create-subtask`.
- Title trims whitespace and is the only user-required field.
- Description, assignee, resource-member assignee, start date, due date, effort, catalog fields, and tags accept blank values and map to `null` rather than fabricated values.
- Added optional Start Date field. Supplied `start_date` is sent unchanged as canonical task `start_date`; blank emits `null`.
- Preserved parent linkage from the subtask route and validation for supplied due dates/effort.
- Backend unchanged: current `CreateTaskInput` and create resolver already accept optional values and retain project/auth/parent validation.

## Validation

- PASS: `new-task-form.test.ts` and `w3-contract.test.ts`
- 2 suites, 22 tests passed.
- No migration, deployment, or production-data mutation.

## Unresolved questions

- None.
