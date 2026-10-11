# LIST-FINAL-REVIEW

Status: **DONE_WITH_CONCERNS**
Frontend source verdict: **REJECT frozen candidate; FR-H4 and FR-M3 not fully closed.**

## Boundary / identity

- Source: `C:/Users/TienVNV/Documents/prjmngr/worktrees/clone-dialog-20260907`.
- Verified HEAD/base: `704d5221b227a2a8491e54a236b8b980108e4c63`.
- Producer aggregate identifier: `93b7e6a592b9370ca8f6cd795fbf1f586eeaed890166a8b198643d74c774fe86`. All **17 individual SHA-256 values independently match** the producer manifest; all remain identical at end. Producer aggregate serialization unspecified; not independently reproduced. Reproducible reviewer aggregate: `02dffc1cf4f07ff52409308534f0aa3e58ebe18b0af4e4adb3fbeb7dee229bc1` (manifest order below; lowercase hash, two spaces, path, LF after every row).
- Start hashes: **2026-09-07 16:20:43.550 +07:00**. End hashes: **2026-09-07 16:36:31.452 +07:00**.
- Read primary AGENTS/startup docs, active plan/acceptance/decisions, DESIGN member/assignment contracts, FINAL-REVIEW, CLONE-SPEC, LIST-AUTHORITY-FIX. Root README and local development rules absent; used prescribed primary docs and global development rules. Activated `ak-code-review`, `ak-test` and their verification references.
- Inspected exact 17 files; bounded actual-parent/client context: `ProjectDetailView.tsx`, `lib/apollo-client.ts`, installed Jest/package setup. Original TaskList typed member fields compared with `git show 704d5221:...`.
- No product/config/existing-test edits, backend/Gantt source review, DB/SSH/browser/server/subagent/commit/push/deploy. Three reviewer-owned temporary test files retained below. This report is the authorized primary-tree exception.

## Confirmed findings

All source paths below relative to the reviewed worktree. Tests use controlled API responses, **not database persistence evidence**.

### LFR-H1 — FR-H4 still fails in the rendered Excel source

**Evidence:** `web/src/components/tasks/TaskListView.tsx:229-236,414-442,1148-1162,1429-1433`; `TaskExcelGrid.tsx:139-157,277-307`; `web/src/lib/apollo-client.ts:135-144`.

Assignment success updates local hierarchy and Redux, but Excel consumes `taskTreeRowsQ.data.task_tree_rows` directly. Neither assignment save updates/refetches that flat query. Once the grid deletes the successful staged value it renders the old row again. Default `InMemoryCache` has no Task `task_id` key policy, so a mutation response does not repair the independent embedded query rows.

**Executed counterexamples, real TaskList + Excel + assignment hook + Redux reducer:**
- Clear root assignment: outgoing pair is explicitly null/null; Redux becomes unassigned and retains description/child; dirty marker disappears; cell displays **"Linked Member"**, expected empty.
- Set child to unlinked member: outgoing canonical pair and Redux are correct; dirty marker disappears; cell becomes **empty**, expected **"Unlinked Member"**.

Failing checks: `web/src/components/tasks/__tests__/list-final-review-counterexamples.test.tsx:136-158`; raw `counterexamples-run-1.log`. Existing assignment suite asserts Redux, not these post-Save displayed cells.

**Required:** propagate canonical results into the actual flat rendering source, or refresh it with truthful error handling; preserve all row fields/hierarchy. Verify set/clear after staged cleanup and mode switch/refetch, not only Redux.

### LFR-H2 — actual project parent destroys FR-M3 recovery state during refresh

**Evidence:** `TaskListView.tsx:171-175,1044-1074,1080-1108,1867-1874`; `web/src/redux/features/tasksSlice.ts:382-386,402-410`; `web/src/components/projects/ProjectDetailView.tsx:56,246,264-273,333-345`.

`refreshClonedTasks()` dispatches the real `fetchProjectTasks` thunk. Its pending action sets `loadingTasks=true`; the actual project parent replaces TaskList with LoadingState, **unmounting List and its dialog/recovery state**. A failed flat-tree refresh then stores the committed/unknown recovery message on that abandoned List instance. A successful Redux refresh remounts a fresh List without the failure/lock. Redux failure instead displays the generic project task error; clone commit context is lost there too.

**Executed actual-parent counterexample:** mounted real `ProjectDetailView`, real TaskList/dialog and Redux thunk/reducer; clone returns a committed ID; flat refetch rejects; delayed Redux query succeeds. List remounts; reopening Clone exposes enabled Create with no retained recovery. `list-final-review-parent-recovery.test.tsx:100-116` fails the disabled assertion. No second write was executed; this proves the lost guard, not a production duplicate count.

Additional source path: Cancel/open resets `cloneRecovery` (`:1038-1041,1870-1873`), even without parent unmount. Recovery is modal-local rather than durable across ordinary close/reopen.

**Required:** retain commit/recovery truth across the real parent's background refresh/unmount boundary and prevent reopening from bypassing unresolved recovery. Test actual parent for both committed and unknown outcomes and each refresh failure. Do not introduce blind mutation retry or claim rollback.

### LFR-M1 — real assignment hook still accepts errors/missing results as success

**Evidence:** `web/src/hooks/useTaskFieldMutations.ts:439-456,480-482`; `TaskListView.tsx:229-235,1151-1162,1281-1288`.

With `errorPolicy: 'all'`, GraphQL errors throw only when the entire `response.data` is falsy. Partial data plus errors is formatted as success. Missing `update_task` returns `{task_id, assignee: undefined}`; `applyCanonicalAssignment` converts absent resource ID to null, clearing the local pair despite no confirmed assignment result.

**Executed:** partial mutation data plus an assignee-resolution error silently removes Excel's staged edit; missing mutation result clears previously linked Redux resource ID. Two failing tests at `list-final-review-counterexamples.test.tsx:160-176`. These are injected transport/response-contract cases, not claims that production SQL emitted malformed data.

**Required:** reject any assignment GraphQL errors and missing task result before changing canonical local state; retain failed staged edit and prior pair. DESIGN §6 explicitly requires this. Existing five suites replace the hook, missing this boundary.

### LFR-M2 — canonical member query failures masquerade as empty success

**Evidence:** `web/src/components/projects/SchedulingConfigPanel.tsx:134-155,173,200,218,440,479-484`; `TaskListView.tsx:182-186,290,305-310,1675-1687`.

The sole Members surface never renders `membersQ.loading/error`; failed initial query becomes `resource_members=[]` and **"No resource members yet"**. No error/retry UI. Member refetch promises after create/link/access are fire-and-forget, so failed refetch is not handled by the surrounding mutation catch. List likewise treats failed canonical mapping load as empty options, displaying assigned normal rows as "Chưa gán" rather than mapping-load failure.

**Executed real MembersView/SchedulingConfigPanel:** query error `members offline` displays the successful-empty message; `web/src/components/projects/__tests__/list-final-review-members.test.tsx:43-51` fails. Mutation create/link errors have catch/toast handlers; that does not cover query/refetch failures.

**Required:** distinguish loading, confirmed empty and error; explicit retry and caught refetch failures; do not present a missing mapping as an unassigned task.

### LFR-M3 — all-depth normal/Redux reload contract remains incomplete in these bytes

**Source evidence:** `web/src/graphql/queries/tasks.ts:3-57` selects only one `child_tasks` level; `web/src/redux/features/tasksSlice.ts:52-70` still fetches that document; `TaskListView.tsx:188-192,414-442` uses all-depth flat rows only for Excel/clone.

The recursive local updater now reaches every **present** descendant and preserves unrelated fields on assignment. It cannot update a grandchild absent from the production Redux query. A parent→child→grandchild reload drops the grandchild from normal List/Redux; flat Excel can display it, but Redux update has no target. Existing test named "deep-child" supplies only root + immediate child, not this case.

This is a source-verified accepted-contract gap, **not an executed API/DB reload claim**. PM reports Gantt owner importing the shared read-model files and adding all-depth/reorder in another worktree: that is a separate final-delta integration gate; it does not change this frozen candidate's verdict.

## Passed / partial dispositions

| Area | Disposition / evidence |
|---|---|
| Frozen identity | PASS: 17/17 bytes match at start/end; no product edits. |
| Existing focused tests | PASS: **5 suites, 41 tests**, 18.298s, no snapshots. Independently rerun. |
| One canonical Members form | PASS source + mounted component: one create control, trimmed name-only create with null email; later existing-email link targets same resource handle; no access mutation called by create/link. Account resolution and role persistence are backend gates. |
| Canonical options | Source: one resource-key option per assignable member, resource-first lookup, duplicate-name disambiguation, unused unlinked members included. Query-failure handling fails as above. |
| Normal assignment local fix | Existing real-Redux component checks pass for root clear and immediate-child unlinked set; returned assignment pair only is spread into existing task/tree. Shared normalizer retains resource ID. No unrelated field/child deletion introduced by this assignment patch found. Full all-depth/refetch acceptance not established. |
| Excel hierarchy | Flat parent-first rows retain descendants/depth of visible roots; fallback recursively flattens available children. Query success assumed; query error currently falls back without an explicit incomplete-tree warning. Post-save actual-source failure above blocks acceptance. |
| Selection/quantity | Existing real dialog/helper tests pass: mandatory root, default all, ancestor closure, subtree uncheck, partial state, invalid quantity prevention, parent-only, pending double-submit guard. Positive safe integers remain uncapped by product-specific max. |
| Atomic request wiring | Additional test mounts **actual ProjectDetailView + TaskList + dialog**, selects 3 of 6 children, quantity 3: exactly one mutation with `{source_task_id:'root',selected_descendant_ids:['c0','c2','c4'],quantity:3}`. PASS. Does not prove 12 persisted rows. |
| FR-M3 isolated List | Existing initial-query-error presentation, CONFLICT reselect, committed-refresh-failure lock and unknown-network/failed-refresh wording tests pass while List remains mounted. Source handles NOT_FOUND through same branch; its independent runtime path/retry completion was not exhaustively tested. Actual-parent lifecycle invalidates full closure. |
| Source hygiene/type baseline | `git diff --check` PASS. Fresh `tsc --noEmit --pretty false --incremental false`: exit 2, **297 diagnostics**, none in frozen 17 files. Original base confirms camelCase UserInfo use; producer's five-field correction is consistent. No unrelated type/lint remediation requested. |

## Independent execution / preserved raw evidence

Evidence directory: `C:/Users/TienVNV/AppData/Local/Temp/list-final-review-260907-1618/`.

| Log | Result |
|---|---|
| `existing-five-suites.log` | Original PowerShell UTF-16 output: 5/5 suites, 41/41 tests PASS. `existing-five-suites-utf8.log` is a readable conversion, not a rerun. PowerShell wraps native stderr as NativeCommandError text; actual Jest exit was 0. |
| `counterexamples-run-1.log` | 4/4 assertion failures described above; no product fixes/relabeling to green. |
| `members-parent-run-1.log` | Members 1 pass/1 real failure; parent suite did not run due missing Jest alias mapping. Harness failure retained. |
| `members-parent-run-2.log` | Parent 1 pass/1 real failure with in-memory alias mapping. Members encountered a harness document-shape mismatch under that mapping, not counted as a product finding. |
| `parent-final.log` | Isolated corrected parent runner: 1 pass / 1 real failure, 8.893s. |
| `members-final.log` | Original mapping, isolated member runner: 1 pass / 1 real failure, 9.637s. |
| `typecheck.log` | Full raw 297 diagnostics, exit 2. Run before final two reviewer test files were added; scoped 17-file filter empty. |
| `start-hashes.txt`, `end-hashes.txt` | Independently recorded exact 17-file hashes. |

Final reviewer-owned checks: **8 tests: 2 pass, 6 fail** (four assignment counterexamples, one parent recovery failure, one member query failure). Not a replacement for the original 41. One preliminary `node -e` quoting attempt to generate a new test failed before file creation/test execution; piped-stdin generation succeeded; tool transcript retains that failure.

### Exact reviewer-owned temporary test paths (retained)

1. `C:/Users/TienVNV/Documents/prjmngr/worktrees/clone-dialog-20260907/web/src/components/tasks/__tests__/list-final-review-counterexamples.test.tsx`
2. `C:/Users/TienVNV/Documents/prjmngr/worktrees/clone-dialog-20260907/web/src/components/tasks/__tests__/list-final-review-parent-recovery.test.tsx`
3. `C:/Users/TienVNV/Documents/prjmngr/worktrees/clone-dialog-20260907/web/src/components/projects/__tests__/list-final-review-members.test.tsx`

No existing tests modified. Parent test uses real project parent, task List/dialog and Redux task thunk/reducer; unrelated Gantt/reports/plans/member loaders and API transport are mocks. Assignment test uses real field mutation hook, List/Excel and reducer; API/query boundary and unrelated controls mocked. Members test mounts both real member components with controlled Apollo hooks.

### Reproduction

From source `web/`, execute this JS through Node stdin (avoids Windows `node -e` quote stripping), choosing the files above or the original five:

```js
(async () => {
  const config = await require('./jest.config.js')();
  config.reporters = ['default']; // installed jest-junit unavailable
  config.watchPlugins = [];
  config.cache = false;
  config.collectCoverage = false;
  // ONLY for parent-final: resolve app/redux imports exactly as TS aliases.
  // config.moduleNameMapper['^@/(.*)$'] = '<rootDir>/src/$1';
  const files = ['src/components/tasks/__tests__/list-final-review-counterexamples.test.tsx'];
  const { results } = await require('jest').runCLI({
    config: JSON.stringify(config), runInBand: true, runTestsByPath: true,
    watch: false, watchAll: false, $0: 'jest', _: files,
  }, [process.cwd()]);
  process.exitCode = results.success ? 0 : 1;
})();
```

All changes above are in-memory test-runner settings, not repository config edits.

## Separate gates / no inferred pass

- **Backend clone persistence:** read final API-TEST report as independent prior evidence: actual mounted Rust GraphQL/PostgreSQL flow reports exact 3 roots + 9 children, IDs/parent mapping, nested selection and injected rollback; 29 contracts + 1 mounted flow. This reviewer made no DB connection and did not rerun/review backend source. Its older manifest is not proof of the newly fixed backend bytes; final backend owner must bind current tests to current artifact.
- **Gantt:** no source review, no tests or duplicate ownership. PM's new shared read-model/all-depth/reorder delta requires separate integration review.
- **Chrome/build/release:** not run under this bounded role. No full lint/build claim. Existing ignored type/lint build settings are not validation, but **do not establish that build is blocked**; the 297 diagnostics establish only a non-clean typecheck.
- Real deployed query/refetch timing, permission matrix, link/config persistence, exhaustive all-depth set/clear/omit, browser accessibility and final combined artifact remain separate gates. Parent/transport mocks do not replace those gates.

## Final 17-file manifest

Each hash identical at start/end and matches producer per-file manifest:

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

## Required next action / unresolved questions

Fix actual rendering/recovery/error boundaries; preserve accepted functionality, uncapped positive quantity and existing permission policy. Re-freeze affected bytes and rerun original suites plus retained concrete failures, then review the separately integrated shared read-model delta. No new product question; frontend closures and final combined backend/Gantt/Chrome gates remain outstanding.
