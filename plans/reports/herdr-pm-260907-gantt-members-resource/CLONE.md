# CLONE

Status: DONE_WITH_CONCERNS

## Implemented

- Atomic `clone_task_subtree` mutation and exact input/payload SDL.
  - Authenticates, derives source project, checks transactional project write auth.
  - Locks source/root/tree in one transaction; cycle-safe recursive CTE; validates source parent, project, selection IDs, duplicate/root IDs, ancestor closure, current canonical assignments.
  - Parent-first deterministic sibling ordering `(priority_order, created_at, task_id)`.
  - Fresh UUID per row/copy; nested remap per copy; child-source clone preserves original parent.
  - Preserves/reset fields per CLONE-SPEC, validates resource-first assignment / user mirror, clears import provenance, no partial writes.
- Authorized `task_tree_rows(project_id)` returns active flat arbitrary-depth rows once, deterministic parent-first; handles corrupt orphan/cycle rows without duplicate output.
- Added SDL contract checks in `backend/tests/contract/main.rs`.
- Imported released UI worker files after destination-clean and producer-diff check:
  - `TaskCloneDialog.tsx`, pure `cloneTask.ts`, `TaskCloneDialog.test.tsx`, `cloneTask.test.ts`.
- Removed legacy sequential browser `create_task` clone path/partial-success helper/tests.
- List/Excel now open same dialog; deep Excel uses `TASK_TREE_ROWS`; nested normal child Clone button added; one mutation then tree + Redux `fetchProjectTasks` refresh. Transport ambiguity wording matches spec.

## Files

Backend: `backend/src/graphql/types/task.rs`, `types/mod.rs`, `resolvers/tasks/{mod.rs,query/{mod.rs,tasks.rs},mutation/{mod.rs,clone.rs}}`, `schema.graphql`, `backend/tests/contract/main.rs`.

Web: `web/src/graphql/{queries/tasks.ts,mutations.ts}`, `web/src/components/tasks/{TaskListView.tsx,TaskCloneDialog.tsx}`, `web/src/utils/cloneTask.ts`, released focused helper/dialog tests.

## Validation

- PASS before final cleanup: explicit transient-reporter Jest command (repository default needs unavailable `jest-junit`): 3 suites / 34 tests: clone helper, dialog, Excel grid.
- `npx tsc --noEmit`: ran unfiltered; fails on extensive existing repo type debt. No observed new clone-specific error. Full output retained by harness temp log.
- Local `cargo` absent; `cargo fmt --check` unavailable.
- Final repeat Jest/diff-check attempts were blocked by `privacy-block.cjs` timing out; no fake green reported.

## Remaining proof

- Mounted isolated PostgreSQL tests not added/run: exact 3+9 count/persistence, nested remap, linked/unlinked canonical assignment, auth/invalid selection, `task_tree_rows`, and injected mid-transaction rollback.
- Independent remote scratch compile/migration/bootstrap proof pending. Did not touch the frozen MEMBERS migration, restored baseline, or production.
- No commit/push/deploy/browser/process created.

## Process

- `mempalace wake-up` unavailable; GitNexus reports repository not indexed. No source edits outside assigned clone ownership; member edits retained.

## Unresolved questions

None.
