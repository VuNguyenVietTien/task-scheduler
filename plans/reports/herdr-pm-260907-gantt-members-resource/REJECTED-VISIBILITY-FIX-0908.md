# REJECTED-VISIBILITY-FIX-0908

- Status: RELEASE_READY
- Task: remove hidden DONE/CLOSE/REJECTED/ARCHIVED ancestors from default List/Kanban/Gantt visibility while promoting visible descendants.
- Root cause: `filterTaskTree` retained a non-matching ancestor whenever a descendant matched.
- Fix: non-matching nodes now return filtered child nodes directly; matching nodes retain only filtered children. Explicit status filters therefore return selected-status nodes only, without unrelated ancestor context.
- Scope: `web/src/utils/task-status-visibility.ts` and focused tests only. No editors, catalogs, or backend changes.

## Requirement mapping

- Rejected parent + active child: parent absent; active child promoted and visible.
- DONE parent + active child: parent absent; active child promoted and visible.
- Explicit REJECTED selection: rejected node visible; unrelated active ancestor omitted.
- List/Kanban/Gantt consumers: shared helper behavior updated without consumer changes.
- Production Chrome verification: latest production reload shows no rejected task row or `ETL-02-06` parent title; status dropdowns remain present.

## Verification

- Focused helper test: **1 suite, 7 tests passed**.
- Required focused command (`status`, Gantt, Kanban, List-related files): **4 suites, 25 tests passed**.
- Same command also included two unrelated existing suites; they failed before exercising this change:
  - `TaskList.test.tsx`: legacy `TaskStatus.IN_PROGRESS` fixture is undefined.
  - `TaskListView.assignment.test.tsx`: missing Apollo provider in existing test setup.
- `git diff --check`: passed.

## Commit and deployment

- Commit: `4ef144a9f8ee720925da393bfa39772459ca69c2 fix(tasks): remove hidden status ancestors`
- Commit identity: `xekobanh@gmail.com`
- Pushed: `dev` and fast-forwarded `main` to `4ef144a`.
- Vercel project: `task-scheduler`.
- Production deployment: `dpl_3JCtCeLrSYpxZgQqSKoX5ULZxohe` / `task-scheduler-ii10u60au-vunguyenviettiens-projects.vercel.app`.
- Deployment status: **Ready**.
- `https://prjmngr.vercel.app`: **HTTP 200**.

## Unresolved questions

- None.
