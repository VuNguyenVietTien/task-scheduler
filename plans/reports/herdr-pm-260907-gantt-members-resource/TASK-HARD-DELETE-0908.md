# TASK-HARD-DELETE-0908

## Delivered

- `delete_task` now requires project write access, locks project/task subtree in one transaction, deletes descendants, clears/preserves dependent references safely, and returns `project_id` plus all `deleted_task_ids`.
- `REJECTED` is blocked from create/update/status persistence. UI confirmation routes REJECTED to hard delete; `ARCHIVED` still uses normal status update.
- Added explicit Delete in task detail and selected List actions. List/Excel/Kanban/detail show irreversible descendant impact; cancel/failure retains task. Redux removes returned IDs recursively, covering List/Kanban/Gantt.
- Updated generated backend schema and focused backend/frontend contract/unit tests.

## Validation

- PASS: `cd web && npm test -- --config jest.config.js --reporters=default --runInBand src/redux/features/__tests__/tasks-realtime.test.ts src/utils/__tests__/task-deletion.test.ts`
- PASS: `git diff --check`
- Blocked locally: `cargo`/`rustfmt` unavailable, so Rust contract test was not executed here.

## Data safety

- No migration, deployment, or production-data mutation.

## Unresolved questions

- Run `cd backend && cargo test --test contract` in CI or a Rust-enabled environment.
