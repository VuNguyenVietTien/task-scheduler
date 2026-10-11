# TASK-COUNT-CONSISTENCY

Status: **DONE_WITH_CONCERNS — final frozen handoff (17:40 +07)**

## Source / cause

Reproduced before fix with actual `useDailyReportData`: nested fixture returned `totalTasks: 2`, `delayedTasks: 0`, `totalBugs: 0` instead of distinct all-depth `3/1/1`; 1 test failed, empty case passed. Raw: `%TEMP%/task-count-consistency-260907/red-report.log`.

Root cause confirmed: both report owners consumed Redux root forest directly. Added one iterative identity-deduplicating all-depth population helper; both report aggregate populations memoize/use it once. Overview Total, Completed, status/priority/schedule/assignee aggregates and all daily filters now consume the same population. No storage, effort, filter, permissions or plan semantics changed. Empty transition now clears/recomputes overview state rather than retaining stale counts.

## Import manifest / current hashes

```text
26e59f1726f85a251d8facb3a613abbdcbe7a5948364b3a5a9415b97e6509a4d  web/src/components/reports/ProjectReportView.tsx
91c657e1e8ce9dadaa50f29134d267653430fd51b6713831b51a6dbe10b95c7d  web/src/components/reports/daily-report-view.tsx
25ee2671537af756f250d020280915d7d8b9f599c664dab3a4466cacbeebdd0c  web/src/components/reports/task-population.ts
706b1b08c2a33e502d2c6fac6248da71da7427687c5a40f19bb11a0b9770f6e6  web/src/components/reports/__tests__/daily-report-view.test.tsx
```

Imports: both report sources import `distinctTaskPopulation`; Overview additionally imports `countTasksByStatus`. Test imports hook plus both helpers.

## Checks now

- Final focused post-fix: **1 suite / 2 tests PASS**. Nested root→child→grandchild plus nested/flat duplicate overlap: total 3, completed 1, delayed 1, on-schedule 1, bug 1, statuses TODO/DONE/BLOCKED each 1; empty forest 0. Raw `green-report-frozen.log`.
- Full TypeScript completed non-clean: exit 2 / 382 output lines; **0 diagnostics in four owned paths** after test correction. Raw `typecheck-final.log`. Known baseline non-clean; no further broad rerun.
- `git diff --check`: PASS (only inherited LF/CRLF warnings).

## Dashboard disposition

**No dashboard edit.** `GET_DASHBOARD_TASKS` calls `Query.tasks`; resolver delegates to `taskService.getTasks`, whose Supabase query selects every non-deleted row from the same `tasks` table and has no `parent_task_id IS NULL` condition. Optional member filter is direct assignee filtering. Therefore dashboard receives flat root+descendant rows already; its array-derived totals/status filters retain correct semantics. `UserDashboard` is a separate supplied-stats component, not called by current dashboard page.

## Frozen owner hashes unchanged

```text
71c0884585098ef8e21d914f61e3cf0272e157100b7e331c488431aab8076134  web/src/components/projects/ProjectDetailView.tsx
ec08f10a878d4db96a4c9743bedec48c5c19c03155f512778f97f8ceceaea84c  web/src/components/tasks/TaskListView.tsx
c3f23d5512b64966a5e03bae2717c3ffa4b61c5799bcfa76870708f83653279a  web/src/components/tasks/__tests__/project-task-view-recovery.test.tsx
44eac5a019bb62930d39072fad38d40601548d6f09759e2efae4592fa293eb6c  web/src/redux/features/tasksSlice.ts
cc091a289cca96401345aba061285ae5f52ba5d3a7a62f3af87ea8084e57c955  web/src/graphql/queries/tasks.ts
b7180d4a376731addeda7433ee5cca1f5a594a1d454f7f9087d077d8d53c13b3  web/src/graphql/mutations/tasks.ts
```

Frozen hashes above re-confirmed after final test; no owned process remains. Assembled owner still owns all-depth network model, combined Gantt/List/report tests, stronger review, release and Chrome persistence/acceptance. Browser must replace production baseline 24-root count with real distinct all-depth count. No browser/DB/server mutation.

Unresolved questions: none.
