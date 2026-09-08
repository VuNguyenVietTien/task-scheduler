# MEMBER-OPTIONS-0908 Report

## Summary

Implemented canonical resource-member loading for owned active assignment surfaces. Unlinked/no-email project members now participate in Kanban filtering and standalone task-detail assignment. List filter modal now accepts canonical stable keys; `TaskListView.tsx` wiring/predicate remains with Excel worker by ownership.

No backend, schema, permission, timesheet, `TaskListView.tsx`, or `TaskExcelGrid.tsx` edits.

## Commits

- `920c1b0 fix(tasks): use canonical members in filters`
- `c5fe4fd fix(tasks): retain canonical detail assignees`

## Coverage Matrix

| Surface | Classification | Result |
|---|---|---|
| List filter modal | Fixed here | `TaskFilterModal.tsx` renders canonical `{key,label}` options; maps legacy saved user ID to `option.userId` |
| List filter wiring/predicate | Integration-owned | Excel worker must pass canonical options and match `assignee_resource_member_id`, then `option.userId` fallback; this branch did not edit `TaskListView.tsx` |
| List normal assignee editor | Already correct | Existing canonical resource options include unlinked members |
| List Excel assignee editor | Already correct / Excel-owned | Existing canonical options; no edits here |
| List inline subtask assignment | Already correct | Uses canonical List assignment options |
| Clone assignment | Already correct | Existing task clone/resource-member contract retained |
| Kanban assignee filter | Fixed here | Loads `RESOURCE_MEMBERS_QUERY(... only_assignable: true)`, uses stable resource keys, matches legacy user-only tasks/filters |
| Kanban task modal | Already correct | Uses canonical `TaskDetail` assignment query |
| Gantt member filter/matrix | Already correct | Uses `useProjectSchedulingConfig().resourceMembers` and resource IDs |
| Gantt task modal | Already correct | Uses canonical `TaskDetail` assignment query |
| Create task/subtask route | Already correct | `NewTaskForm` merges canonical resources, including unlinked rows |
| Standalone task detail route | Fixed here | Loads canonical resources, edits linked/unlinked assignments, sends atomic resource assignment mutation, retains resource ID through route and Redux normalization |
| Member management/capacity/groups | Already correct | Canonical resource-member surface |
| Ownership transfer/access/linking | Account-only | Linked `user_id` requirement preserved |
| Timesheet member selector | Account-only | Timesheet API targets `user_id`; linked-only behavior preserved |
| Mentions/account permissions | Account-only | Linked-user behavior preserved |

## Verification

- Focused Jest: 3 suites, 7 tests passed.
  - `task-filter-modal-member-options.test.tsx`
  - `kanban-member-options.test.ts`
  - `task-detail-subtasks.test.tsx`
- TypeScript syntax transpile: 5 changed source files passed.
- `git diff --check`: passed before both commits.
- Staged secret-pattern checks: passed before both commits.
- Targeted ESLint unavailable: isolated config could not resolve `@eslint/eslintrc` through external dependency path. No broad install/lint attempted after PM checkpoint.

## Integration Notes

- `TaskFilterModal` now requires `Array<{ key: string; label: string; userId?: string }>`.
- Excel worker should pass `assigneeOptions` with null normalized to omitted `userId`, and update List predicate in its owned `TaskListView.tsx`.
- `TaskListView.assignment.test.tsx` intentionally untouched because Excel worker had concurrent edits. Add/retain the List filter integration case during rollup.
- Feature branch alone has the expected caller contract mismatch until Excel worker's `TaskListView.tsx` integration lands.

## Unresolved Questions

- None in owned code. PM rollup must combine the Excel-owned List wiring before integrated type/test verification.
