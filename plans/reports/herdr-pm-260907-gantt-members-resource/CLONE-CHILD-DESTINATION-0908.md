# CLONE-CHILD-DESTINATION-0908

## Outcome

- Clone dialog now permits unchecking source while retaining selected descendants.
- Orphaned selected child roots require one destination: active same-project parent outside source subtree, or no parent.
- Quantity preserves existing parent-tree behavior and creates N copies of each selected orphan root structure in stable task order.
- Backend rejects conflicting destinations, invalid/cross-project parents, source-subtree cycle targets, and broken ancestor selections.
- Clone completion still performs authoritative tree + Redux refetch before unlocking another clone.
- Task Detail now normalizes `child_tasks` from the shared task fragment and renders direct child title, status, and detail link; empty state uses authoritative direct-child data.
- Task update continues to refetch detail; clone refreshes project task state.

## Files

- Backend clone input/schema/resolver and contract assertion.
- Web clone selection helpers/dialog/tests.
- Task Detail query normalization, direct-subtask rendering, focused test.

## Verification

- PASS: 4 focused suites, 28 tests (`cloneTask`, `TaskCloneDialog`, `TaskListView.clone-recovery`, `task-detail-subtasks`).
- PASS: `git diff --check` (line-ending warning only).
- BLOCKED: Rust contract test/format unavailable because `cargo` is not installed in pane environment.
- BASELINE BLOCKED: broader project recovery suite cannot resolve pre-existing `@/app/projects/[id]/timesheet/page` mock target.
- BASELINE BLOCKED: full `tsc --noEmit` reports extensive pre-existing errors; changed clone/detail files introduced no additional reported error beyond existing `TaskDetailPage` errors.

## Unresolved Questions

- None for implementation. CI/Rust-capable environment should run `cargo test --test contract`.

Status: DONE_WITH_CONCERNS
