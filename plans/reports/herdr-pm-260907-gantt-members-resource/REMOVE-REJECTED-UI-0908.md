# REMOVE-REJECTED-UI-0908

## Status
COMPLETE

## Delivered
- Removed `REJECTED` from List, Excel validation, task detail/modal/page, bulk actions, and create/edit task status choices.
- Retained `REJECTED` as a historical status and explicit List/Gantt/Kanban filter; rejected Kanban tasks are read-only and cannot be dragged into or from that column.
- Added explicit Excel row Delete action; existing List selected-task and task detail Delete actions remain.
- Delete confirmation states the task and all descendants are permanently deleted and cannot be recovered; includes loaded descendant count. Cancel returns before dispatch.
- Confirmed delete calls `delete_task` once. Redux removes every returned `deleted_task_id`; List/Excel local trees remove the same IDs.

## Backend verification
- `backend/src/graphql/resolvers/tasks/mutation/delete.rs` already performs one authorized transaction: locks the project/subtree, recursively gathers same-project descendants, deletes dependent references and the full task subtree, checks deleted count, commits, and returns `project_id` plus `deleted_task_ids`.
- No backend semantics, schema, migration, or data changed.

## Verification
- PASS: 4 focused Jest suites, 32 tests.
- Covered editor status exclusions, Excel REJECTED rejection, retained historical filters, parent/standalone irreversible warnings, delete GraphQL payload, and returned-subtree Redux removal.
- PASS: `git diff --check`.
- Full TypeScript remains red from pre-existing repository errors; changed TaskExcelGrid status typing was verified during focused run.

## Deployment
- Not deployed.

## Unresolved questions
- None.
