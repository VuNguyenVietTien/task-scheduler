# LIST-AUTHORITY-FIX

Status: DONE_WITH_CONCERNS

## Scope / frozen source refresh

- Refresh source: `C:/Users/TienVNV/Documents/prjmngr/worktrees/members-20260907`, frozen base `704d522`.
- Refreshed 14 changed/untracked canonical `web/src` source/test files byte-for-byte before edits; SHA-256 mismatch list empty. Excluded node_modules, env, AGENTS/CLAUDE, reports. Members/release untouched.
- Refreshed files: `MembersView`, `SchedulingConfigPanel`, `TaskCloneDialog`, `TaskExcelGrid`, `TaskListView`, clone/Excel tests, `graphql/{mutations,mutations/tasks,queries/tasks,scheduling}`, `useTaskFieldMutations`, `cloneTask` + test.

## Fixed

- FR-H4:
  - successful normal/Excel assignment applies returned canonical resource/user pair to local hierarchy and Redux tree;
  - Redux updater now finds all-depth children; normal lookup does too;
  - query normalizer retains `assignee_resource_member_id`, including unlinked members after refresh;
  - Excel `Delete` stages explicit clear; unrelated fields remain spread-preserved.
- FR-M3:
  - tree-query error renders retryable error, not permanent Loading;
  - CONFLICT/NOT_FOUND refresh both tree and Redux then close stale selection for reselect;
  - committed clone plus failed refresh locks Confirm and requires refresh;
  - unknown network outcome says refreshed only after confirmed refresh; failed refresh locks mutation and has no false message/automatic retry.
- Baseline correction: original `704d522` uses typed `member.user.{userId,fullName,avatarUrl}`. Frozen member source changed those to snake_case, adding five TaskList TypeScript errors. Restored typed fields; no affected-file diagnostics remain.

## Focused verification

```text
PASS focused Jest, 5 suites / 41 tests
- clone helpers, TaskCloneDialog, TaskExcelGrid
- mounted TaskList + real Redux normalizer/tree: resource ID retention; normal root clear + deep unlinked assignment; Excel root clear + deep unlinked assignment
- mounted TaskList clone recovery: initial query error, CONFLICT reselect, committed refresh failure lock, unknown-network failed-refresh lock

PASS git diff --check

npx tsc --noEmit --pretty false: FAIL exit 2, 297 repo-wide existing diagnostics
- frozen member had 302; five TaskList snake_case UserInfo errors fixed
- affected-file diagnostic filter: empty
```

Build not run: full typecheck remains nonzero outside scope. No browser/server/DB/dependency/config/commit/push/deploy.

## Final web manifest (SHA-256)

Aggregate: `93b7e6a592b9370ca8f6cd795fbf1f586eeaed890166a8b198643d74c774fe86`

```text
39a9cde5df8f3e2fc63d39ec38a464c8ce861f10081cf1050f1b24f18f7131ea  web/src/components/projects/MembersView.tsx
71e349098b5a96a61486c3a1767fc63b527b15eada2226f6f1ce5c6636c156cc  web/src/components/projects/SchedulingConfigPanel.tsx
362d04385328cc0f213b65e789696c465d8792a552e4f4159eeb8d407fe8bddc  web/src/components/tasks/TaskCloneDialog.tsx
a2e1978dec2551ae051f302f1038412ffe040b552b8758a3708d3d4c61b6b524  web/src/components/tasks/TaskExcelGrid.tsx
51a67a09cd5a0deecb99b1fcb7a21bdaa987a962aa3fe1860090252358d5bff1  web/src/components/tasks/TaskListView.tsx
27baae2a8bb119c857b2c69d4a3a6f261cb76749f835d2312b3ad4021bf1919d  web/src/components/tasks/__tests__/TaskCloneDialog.test.tsx
bd21288ed61ee4eefa3afb3f60222ffd814d0f3a31188175039e09108c871967  web/src/components/tasks/__tests__/TaskExcelGrid.test.tsx
02e1ca96ccae4df363be66ffecebc16cfa994d50dc2337a495dc86138ce37393  web/src/components/tasks/__tests__/TaskListView.assignment.test.tsx
5cc3452a150439887094510af439f35a31c667affd868b1101fbb27ac051226a  web/src/components/tasks/__tests__/TaskListView.clone-recovery.test.tsx
4b07b2b37b84bb059d797e41abf13b50ead1d2fdd0d7059945f0f51bfbe7316b  web/src/graphql/mutations.ts
b7180d4a376731addeda7433ee5cca1f5a594a1d454f7f9087d077d8d53c13b3  web/src/graphql/mutations/tasks.ts
cc091a289cca96401345aba061285ae5f52ba5d3a7a62f3af87ea8084e57c955  web/src/graphql/queries/tasks.ts
d3ca5ce5dcbcde83a89a36a9336114cd78021f151879b91c424427eb75d38b1c  web/src/graphql/scheduling.ts
1f87365e34b708ed6fc5320c3512341b9556bc2c6c9de8b20458fb679ef26029  web/src/hooks/useTaskFieldMutations.ts
44eac5a019bb62930d39072fad38d40601548d6f09759e2efae4592fa293eb6c  web/src/redux/features/tasksSlice.ts
079c237fc4c38db885c5f3ace6d5a7b2efbb2b42aa8d518041bfff5eefb0ef52  web/src/utils/__tests__/cloneTask.test.ts
4e476aa169c576b2465da1f5aeb4f00ef4d6cc16dbf0b2045098c9afec836498  web/src/utils/cloneTask.ts
```

## Own deltas from frozen members

```text
51a67a09cd5a0deecb99b1fcb7a21bdaa987a962aa3fe1860090252358d5bff1  TaskListView.tsx
 a2e1978dec2551ae051f302f1038412ffe040b552b8758a3708d3d4c61b6b524  TaskExcelGrid.tsx
362d04385328cc0f213b65e789696c465d8792a552e4f4159eeb8d407fe8bddc  TaskCloneDialog.tsx
44eac5a019bb62930d39072fad38d40601548d6f09759e2efae4592fa293eb6c  redux/features/tasksSlice.ts
02e1ca96ccae4df363be66ffecebc16cfa994d50dc2337a495dc86138ce37393  TaskListView.assignment.test.tsx (new)
5cc3452a150439887094510af439f35a31c667affd868b1101fbb27ac051226a  TaskListView.clone-recovery.test.tsx (new)
```

## Cleanup

- Test/typecheck processes exited; final process check found no owned Jest/tsc process.
- Removed local typecheck logs.

## Remaining concerns

- 297 unrelated repo TypeScript diagnostics still prevent a clean full typecheck/build.
- No live browser/API/DB validation by task constraint; Astra/release integration still required.

Unresolved questions: none.
