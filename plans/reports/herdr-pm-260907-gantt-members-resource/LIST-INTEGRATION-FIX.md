# LIST-INTEGRATION-FIX

Status: **DONE_WITH_CONCERNS**
Source fix disposition: **LFR-H1/H2/M1/M2 closed by focused integration checks.** LFR-M3/final real-Gantt integration remains separately owned.

## Boundary / checkpoint

- Worktree: `C:/Users/TienVNV/Documents/prjmngr/worktrees/clone-dialog-20260907`.
- HEAD verified: `704d5221b227a2a8491e54a236b8b980108e4c63`. Started from inherited frozen 17-file candidate `93b7e6a592b9370ca8f6cd795fbf1f586eeaed890166a8b198643d74c774fe86` plus three retained reviewer tests. No checkout/revert/import of another writer's changes.
- Read primary AGENTS/startup docs, active plan/acceptance, DESIGN, CLONE-SPEC, LIST-AUTHORITY-FIX and complete LIST-FINAL-REVIEW. Root README/local development rules absent; used primary docs/global rules. Activated ak-debug, ak-test, frontend-development, ponytail. Direct callers inspected, not broad repo rescout.
- First checkpoint saved after assignment group: original four real-hook/rendered-cell failures reproduced, then 4/4 passed; actual-parent failure also reproduced. This final report replaces that checkpoint; its raw evidence remains below.
- No nested agents, DB, SSH, browser, server, backend, migration, dependency/config edits, commit, push or deployment. PM-authority documents untouched except this explicitly assigned report.

## Exact dispositions

### LFR-H1 — CLOSED (frontend integration)

`TaskListView.tsx`: successful canonical pair now updates local hierarchy, Redux, **embedded Apollo flat query**, and a narrow assignment patch used by actual Excel rows until query acknowledgment. Apollo clear writes `assignee: null`, not an omitted field. Only assignment fields spread into existing rows; descriptions/children/depth preserved. Failed flat refresh shows last-available-row warning and explicit retry, not confirmed refresh. Grid remains mounted when switching modes, preserving unrelated staged edits.

Proof: real List + Excel + assignment hook + reducer cells stay clear/assigned after Save removes dirty marker; mode round trips; failed refresh; confirmed query acknowledgment; unrelated title draft and child hierarchy retained. API/query responses controlled: not persisted database proof.

### LFR-H2 — CLOSED (actual-parent integration)

`ProjectDetailView.tsx` owns recovery keyed by project; TaskList keeps standalone fallback for other callers. Mutation/refresh busy phase and committed/unknown/reselect message stored **before** task refresh can unmount List. Cancel/open does not reset recovery. Explicit refresh waits for both flat query and Redux using `allSettled`; only confirmed success clears guard and closes the initiating stale selection. Failed retry retains original commit/outcome truth. No mutation retry is automatic.

Actual-parent proof covers committed AND unknown outcomes, each tree/Redux refresh failure, ordinary close/reopen, real List unmount via Members-tab navigation, failed then successful explicit retry/reselect, unrelated project enabled while original project's guard survives return, and in-flight mutation guard across tab unmount. Original one-request 3-of-6 children × quantity-3 assertion retained. No false rollback claim.

Parent background refresh now preserves loaded List/Gantt rather than replacing the view with loading/error. Initial loading/error remains separate. Per later PM authorization: empty live tasks do not prevent Gantt mounting/history selection; other empty-tab behavior remains. Stateful Gantt **boundary sentinel** proves selected history survives pending/failed/successful background refresh. This is not a real Gantt lifecycle test.

### LFR-M1 — CLOSED (real-hook and rendered-cell integration)

`useTaskFieldMutations.ts`: any GraphQL errors reject even with partial data; absent/wrong-ID/incomplete `update_task` rejects before broadcast/return. Removed optimistic assignment publication and missing-result success fallback. Explicit null pair remains valid. Failed Excel edits remain dirty; normal editor and prior resource/user pair remain intact. Added hook event checks and actual normal/Excel cells; original failure assertions retained.

### LFR-M2 — CLOSED (Members/List integration)

`SchedulingConfigPanel.tsx`: loading, confirmed empty, query error and refresh error distinct; explicit retry. Create/link/access awaits caught member refetch. Successful operation followed by failed refresh says **“Member change saved, but refresh failed”**. Create form clears; Add remains disabled until a new name is entered. Link input clears; confirmed returned member is merged into embedded member query so link state need not revert on refresh failure. Refresh retry never repeats mutation. Access refresh now refreshes its changed canonical member query, not unrelated capacity/group/commitment queries.

List mapping loading/error/empty distinct, explicit caught retry; assigned normal/Excel cells never become “unassigned” merely because mapping failed. Assignment writes are guarded while mapping unavailable. No permission-policy changes; one form, trimmed name-only create, null optional email, and link without access grant retained.

### LFR-M3 — NOT OWNED / COMBINED GATE OPEN

Did **not** edit/import `web/src/redux/features/tasksSlice.ts`, `web/src/graphql/queries/tasks.ts`, or `web/src/graphql/mutations/tasks.ts`. Their frozen hashes remain identical. Gantt owner's reported 26-file artifact / 133 tests not independently imported or verified here. PM must integrate final shared all-depth read model, then test parent→child→grandchild assignment set/clear/omit and reload through normal List/Excel/Redux plus real Gantt saved-history/background-refresh behavior. No combined-depth pass inferred.

## Retained tests renamed (assertions preserved)

Paths under `web/src/components/`:

| Retained name | Permanent behavior name |
|---|---|
| `tasks/__tests__/list-final-review-counterexamples.test.tsx` | `tasks/__tests__/task-list-assignment-integration.test.tsx` |
| `tasks/__tests__/list-final-review-parent-recovery.test.tsx` | `tasks/__tests__/project-task-view-recovery.test.tsx` |
| `projects/__tests__/list-final-review-members.test.tsx` | `projects/__tests__/member-query-recovery.test.tsx` |

Removed audit prefixes from descriptions, no weakened assertions. Members harness accepts string/DocumentNode source text so alias mapping does not cause document-shape failures. Original five suites unchanged.

## Commands / fresh results

Evidence directory: `C:/Users/TienVNV/AppData/Local/Temp/list-integration-fix-260907/`.

Jest runner from `web/`, piped JS to Node stdin:

```js
(async () => {
  const config = await require('./jest.config.js')();
  Object.assign(config, { reporters: ['default'], watchPlugins: [], cache: false, collectCoverage: false });
  // Parent-containing groups only; no repository config edit:
  // config.moduleNameMapper['^@/(.*)$'] = '<rootDir>/src/$1';
  const { results } = await require('jest').runCLI({
    config: JSON.stringify(config), runInBand: true, runTestsByPath: true,
    watch: false, watchAll: false, $0: 'jest', _: files,
  }, [process.cwd()]);
  process.exitCode = results.success ? 0 : 1;
})();
```

| Group / raw log | Files / result |
|---|---|
| Before fixes: `red-assignment-members.log`, `red-parent.log`, `red-members-isolated.log` | Assignment 4 real failures; parent 1 pass/1 real failure; isolated Members 1 pass/1 real failure. **Retained 8: 2 pass, 6 fail reproduced.** Combined Members attempt hit documented DocumentNode harness mismatch, not counted as product failure. |
| `assignment-green-1.log` | First fixed group: retained 4/4 PASS. |
| `final-original-plus-assignment.log` | `utils/__tests__/cloneTask.test.ts`; tasks `TaskCloneDialog.test.tsx`, `TaskExcelGrid.test.tsx`, `TaskListView.assignment.test.tsx`, `TaskListView.clone-recovery.test.tsx`, `task-list-assignment-integration.test.tsx`: **6 suites / 53 tests PASS**, exit 0. Includes original 41 unchanged. |
| `final-members-parent.log` | `member-query-recovery.test.tsx` + `project-task-view-recovery.test.tsx`, full alias in-memory: **2 suites / 15 tests PASS**, exit 0. |
| `final-parent-message.log` | Last pending-message wording adjustment: parent integration + original isolated clone recovery: **2 suites / 11 tests PASS**, exit 0. |
| Final nonduplicated total | **8 suites / 68 tests PASS.** Controlled transport, real components/hooks/reducer; no DB claim. |
| `typecheck-final.log` | `node node_modules/typescript/bin/tsc --noEmit --pretty false --incremental false`: exit 2, **297 diagnostics**, none in owned source/tests. |
| `typecheck-base-704d5221.log` | TypeScript compilerHost read overlay from original Git base; current unchanged tsconfig/options, original tracked root files, original versions of changed source, excludes new untracked tests: **304 original-base diagnostics**. No source checkout/mutation. |
| `type-diagnostic-comparison.txt` | Compare path + TS code/message, normalize shifted line/column: **0 added diagnostics**, 304 original → 297 final. No unrelated cleanup. |
| `git diff --check` | PASS. Existing LF/CRLF Git warnings retained, not errors. |

Initial UTF16 PowerShell logs retained alongside UTF8 conversions. First conversion attempt failed on non-ASCII regex encoding; corrected ASCII-only conversion succeeded. First multi-edit call for List mapping rejected ambiguous text before writing; corrected exact regions succeeded. No hooks/config bypass.

Build/lint/browser not executed within deadline/scope; no claim that nonzero typecheck blocks build or that build would validate types/lint. Independent highest-model review, final real-Gantt/all-depth artifact, backend persistence and release/browser gates remain unexecuted here.

## Manifest — inherited versus owned

Full **17 inherited paths, original SHA-256 and final SHA-256**: `C:/Users/TienVNV/AppData/Local/Temp/list-integration-fix-260907/inherited-17-final.json`. Original values bind to LIST-FINAL-REVIEW's manifest. **14/17 unchanged**; only inherited SchedulingConfigPanel, TaskListView and useTaskFieldMutations changed here. MembersView, TaskExcelGrid, TaskCloneDialog, original five tests, GraphQL documents, clone utility and shared Redux retained.

**Original-scope frozen changed paths (7)**; ProjectDetailView additional source change, three renamed/extended test artifacts. The approved count addendum below supersedes three hashes; this original freeze and its 68-test evidence remain preserved. No shared-read-model writes:

```text
aaf7cf6c98849cf763de70126384ac7775e823734fad584d5cdf7fea58105152  web/src/components/projects/ProjectDetailView.tsx
8a0973d37fddda54aca3fc31fe4859bd93a795a1bb3947ebbccdd600c7b4c4d1  web/src/components/projects/SchedulingConfigPanel.tsx
0af2c40505870fcca746d6257a9c34eb6dc8be3420d31dc12d9bde5dd5078f22  web/src/components/tasks/TaskListView.tsx
14bf3c3a962c0287d1fb57a43d2eeba5761467aba9d7bf094dc0e30f4765d6ff  web/src/hooks/useTaskFieldMutations.ts
f056c7eb5a19778ebe0b96bc53fae59fe978ecf7533d824297badaaaf83a2598  web/src/components/tasks/__tests__/task-list-assignment-integration.test.tsx
ca63125f74d8e97c2ad33a669a02b0ab8687079169fcb48744d59c7fd68b076c  web/src/components/tasks/__tests__/project-task-view-recovery.test.tsx
b2d8b408cde24fd1c36ef31bb2718ef84e4198aeb55e36f763177bdca8c87b3a  web/src/components/projects/__tests__/member-query-recovery.test.tsx
```

Read-only shared hashes unchanged:

```text
44eac5a019bb62930d39072fad38d40601548d6f09759e2efae4592fa293eb6c  web/src/redux/features/tasksSlice.ts
cc091a289cca96401345aba061285ae5f52ba5d3a7a62f3af87ea8084e57c955  web/src/graphql/queries/tasks.ts
b7180d4a376731addeda7433ee5cca1f5a594a1d454f7f9087d077d8d53c13b3  web/src/graphql/mutations/tasks.ts
```

## Cleanup / unresolved gates

All own test/typecheck commands synchronous and exited. Process inspection found no worktree Jest/TypeScript Node process; no background server started and no foreign process stopped. Temp raw evidence intentionally retained. Source/final focused checks frozen around 17:10 +07; final report saved 17:12 +07. No extension used.

Unresolved product questions: none. Concerns: independent review and PM-owned combined all-depth/real-Gantt/persistence/browser gates above; original-scope repository typecheck remained non-clean with no new diagnostics.

## Approved ten-minute extension — descendant totals (final addendum)

PM approved this bounded extension after original-scope handoff. **DONE_WITH_CONCERNS**, source edits confined to `ProjectDetailView.tsx`, `TaskListView.tsx`, and their existing actual-parent integration test. H1/H2/M1/M2 preserved. No report/dashboard/shared-model source edits.

### Same-table verification / count semantics

- Source schema confirmed: `backend/migrations/20250319000000_create_initial_schema.sql:98-101` defines `tasks.task_id` and `tasks.parent_task_id UUID REFERENCES tasks(task_id)`. Descendants are rows of the same tasks table, not a separate child-task table. Source verification only; no DB connection.
- List's former status summary iterated roots only. Now iterative identity-deduplicated traversal counts every available descendant exactly once, including collapsed and completed children. Visible labels explicitly distinguish **Total tasks: N (including descendants)** from **Displayed roots: R**. Counting does not flatten/mutate the rendering forest or introduce rows.
- Project pagination intentionally remains root-based; parent passes `rootTasksOnly: true`. Pagination visibly states **Pages count parent tasks only; total tasks above includes descendants**. A single 13-task subtree does not acquire extra root pages. Existing row/render/pagination behavior otherwise unchanged.
- PM's separate Gantt read-model supplies the all-depth forest. Current fix counts all provided depths; final combined API reload gate remains open, not replaced by mocked payload depth.

### Focused proof / deadlines

- `counts-parent-regression.log`: actual parent **9/9 PASS** (7 retained recovery/Gantt-boundary checks + 2 new count tests).
- New proof: one root + 11 children + grandchild = **13 total / 1 displayed root**, status sum 11 TODO + 1 DOING + 1 DONE. Collapsed/expanded/Excel/mode-switch totals unchanged; 13 unique rendered task IDs, no duplicate rows; no second root page. Separate 11-root + one-child case = **12 total / 11 roots**, explicitly root-only pagination with two root pages.
- `counts-original-assignment-regression.log`: original five suites + real-hook/assignment suite **53/53 PASS**, exit 0.
- `counts-members-regression.log`: Members **8/8 PASS**, exit 0.
- Updated nonduplicated total: **8 suites / 70 tests PASS**. Original 68-test logs untouched.
- Same Node-stdin Jest runner/aliases as above. `git diff --check` PASS.
- Post-count full typecheck attempted twice: first combined command timed out at 100s after Jest had passed; isolated retry timed out at 110s. Logs `typecheck-counts.log`, `typecheck-counts-retry.log` retained. **No completed post-count typecheck claim**; original completed 297-diagnostic/zero-added baseline remains historical. No unrelated type cleanup. Further reruns stopped to preserve extension deadline.
- Process inspection after timeouts found no remaining Jest/TypeScript Node processes. No foreign process stopped. No build/lint/browser/server/DB run. Source/manifest frozen before extension expiry; no additional extension requested.

### Exact external owners — PM follow-up, not edited

1. **Confirmed report root-only owner:** `web/src/components/reports/ProjectReportView.tsx:81-85` reads `state.tasks.tasks` directly; `processTasksForOverview()` at `:130-229` iterates that root forest for status/priority/overdue/on-schedule. Overview Total at `:564-565` is `tasks.length`; Completed at `:568-570` filters roots. `processTasksForDailyReport()` starts `:233` and shares this source. This is the exact Overview aggregator, not an unidentified report hook.
2. **Confirmed daily hook owner:** `web/src/components/reports/daily-report-view.tsx:34-35` exports `useDailyReportData`, reads the same Redux roots; root-only filters/maps at `:54-143`; `totalTasks: tasks.length` at `:150`; metrics at `:183-186`. Used by ProjectReportView and DailyReportView. A count-consistency worker should normalize identities once for all these aggregations, not patch only the card text.
3. **Dashboard follow-up seam (not separately proved by browser here):** `web/src/hooks/use-dashboard-tasks.ts:19-68` (`useDashboardTasks`) consumes `GET_DASHBOARD_TASKS` and derives counts by filtering `data.tasks`; `web/src/components/dashboard/member-dashboard-view.tsx:39-42` labels `activeTasks.length` as total/status counts. Query owner: `web/src/graphql/queries/dashboard.ts`. `dashboard/pm-dashboard-view.tsx:42-45` shares derived-array counters; `dashboard/UserDashboard.tsx:94` displays supplied `stats.totalTasks`; `dashboard/dashboard-task-table.tsx:106-108` displays array counts. Separate bounded worker must establish each query/caller's root-versus-flat semantics before changing them.
4. Shared `web/src/components/common/Pagination.tsx` renders supplied counts, not a project aggregator. This task labels the existing parent-root usage at its owned call site; other call sites remain separately owned.

PM-reported Chrome baseline: active project's `?tab=report` Overview **Total 24 / Completed 0 / On schedule 23 / TODO 23 / REJECTED 1**, despite descendants. Consistent with source root-only Overview aggregation. **User/PM-supplied live evidence, not browser execution by this worker.** No claim to have fixed that tab.

### Updated final manifest

All seven final owned hashes: `C:/Users/TienVNV/AppData/Local/Temp/list-integration-fix-260907/counts-final-manifest.txt`.
All inherited 17 before/final hashes: same directory `counts-inherited-17-final.json`. Shared read-model files still **0 changes**. Four owned hashes unchanged from original manifest above; these three supersede it:

```text
71c0884585098ef8e21d914f61e3cf0272e157100b7e331c488431aab8076134  web/src/components/projects/ProjectDetailView.tsx
ec08f10a878d4db96a4c9743bedec48c5c19c03155f512778f97f8ceceaea84c  web/src/components/tasks/TaskListView.tsx
c3f23d5512b64966a5e03bae2717c3ffa4b61c5799bcfa76870708f83653279a  web/src/components/tasks/__tests__/project-task-view-recovery.test.tsx
```

Unresolved questions: none. Remaining gates: post-count full typecheck, independent strongest-model review, final combined all-depth/real-Gantt/browser/persistence checks, and separately dispatched report/dashboard count consistency.

