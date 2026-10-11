# GANTT-REVIEW — independent final source review

**Verdict: REJECT Gantt source integration.** Five reported failures fixed; remaining confirmed wiring/acceptance defects below. No whole-release approval.

**Status: DONE_WITH_CONCERNS**

- Task: `GANTT-REVIEW`; independent reviewer, no implementation ownership.
- Worktree: `C:/Users/TienVNV/Documents/prjmngr/worktrees/gm-20260907`.
- Branch: `codex/gantt-members-resource-20260907`; HEAD/base: `704d5221b227a2a8491e54a236b8b980108e4c63` plus frozen working diff/untracked files.
- Date: 2026-09-07, Asia/Bangkok. Startup 14:38; checkpoint saved 14:43:58; source end-hash 14:48:17 +07:00. Final completed within 20-minute boundary.
- Report: `C:/Users/TienVNV/Documents/prjmngr/task-scheduler/plans/reports/herdr-pm-260907-gantt-members-resource/GANTT-REVIEW.md`.

## Authority, scope, method

Read current primary AGENTS, mandatory docs in order, active plan/acceptance/decision-ledger, DESIGN §§7–8, GANTT-TEST first 110 lines, GANTT-REGRESSION-FIX and GANTT-FINISH. Root README absent in both primary/worktree; primary `docs/README.md` used. Applied `ak-code-review`: spec compliance first, evidence-based defect review, fresh verification. No scope-cut review.

Read complete 11-file tracked scoped diff against base, all four untracked Gantt files, complete scoped implementations and six focused suites. Also read/run two existing Timeline mode suites; direct task/plan/projection/taxonomy types and only `TaskOrderItem` declaration at `taskOrderStore.ts:8–24`. No broad rescout.

**Evidence distinction:** tests below were executed. Finding repros below are deterministic source/data-flow reproductions, **not** claimed browser/API executions. They identify exact input/action sequences for the PM's next regression tests. Some defects are inherited seams now exposed by the unified feature, not necessarily introduced by the last five-failure fix.

## Confirmed integration blockers

Paths below relative to the reviewed worktree. P1 = material authority/accounting/workflow failure; P2 = remaining explicit acceptance/compatibility failure. Fix within these contracts, not by removing requested controls or restoring duplicate task lists.

### R1 — P1: sole New Plan path ignores current task selection

**Evidence:** `web/src/components/timeline/Timeline.tsx:705–726`; `web/src/hooks/usePlanLifecycle.ts:124–130`; `web/src/utils/planLifecycle.ts:96–98,127–143`.

`planLifecycleScheduling.tasks` receives **all** `orderedTasks`; neither matching IDs nor filter state enter `newPlan`. The removed legacy Save path was filter-aware (`Timeline.tsx:1297–1300` remains as unreachable legacy handler).

**Repro:** tasks parent P, children A/B, unrelated U. Filter to A; P appears only as ancestor context. Click New Plan, then Save. Snapshot contains P/A/B/U and allocates their direct effort, not just selected A with non-accounting ancestry. With zero matches, it still drafts the full task set. Matrix totals for that draft consequently include excluded work.

**Disposition:** preserve filter-aware New Plan membership before collapse; keep Recalculate based on saved IDs, not current filters.

### R2 — P1: explicit saved null resource assignment can still inherit live user assignment

**Evidence:** `web/src/components/timeline/Timeline.tsx:744–775,1185–1191`; `web/src/utils/member-daily-effort.ts:41–55`. `SnapshotTask` permits either identity field to be absent (`web/src/utils/planLifecycle.ts:34–35`).

Resource null is preserved, but when `assigneeUserId` is absent, `assignee` falls back to `live.assignee`. Aggregation then treats resource null as a user-only assignment and resolves that **live** user.

**Repro:** valid saved task has `assigneeResourceMemberId: null`, no `assigneeUserId`, and Sep 7 hours 8. Current full Task has `assignee: { userId: 'u1', username: 'Member' }`; canonical member rm1 links u1. Hydration produces resource null plus live u1; matrix charges rm1 8h instead of the unassigned diagnostic row. With both saved identities null, this branch does not occur.

**Disposition:** distinguish absent legacy metadata from explicit saved unassignment across both identity fields. The existing null-assignment fixture passes, but does not disprove this explicit branch/input combination; no claim that this repro was executed.

### R3 — P1: lifecycle sequencing protects loads only, not newer user intent

**Evidence:** `web/src/hooks/usePlanLifecycle.ts:124–157,159–183,203–234,245–250`.

Load/load and load/project-switch guards exist. New Plan does not invalidate a pending load; save and recalculate continuations have no request/project/mode guard.

**Repros:**
1. Start slow Load A → click New Plan → A resolves. Request ID remains current; load clears the new draft and selects A.
2. Start Save draft A → click New Plan B while saving → A resolves. Save clears draft B and replaces its view.
3. Start Recalculate saved A → select saved B or return Live → metadata A resolves. A becomes the draft despite the newer selection. On a reused component with changed project ID, the same continuation can install old-plan state using new scheduling inputs.

**Disposition:** latest intent/project must govern every async completion, not just load/load. Preserve last valid view on failures. No server race execution claimed.

### R4 — P1: legacy actions still target a second lifecycle authority

**Evidence:** `web/src/components/timeline/Timeline.tsx:1197–1210,1365–1381,1467–1475,1543–1551`; `web/src/components/timeline/PlanLifecycleBar.tsx:137–155,171–193`.

The sole selector changes `planLifecycle`, but the green Recalculate still calls the old live-store scheduler in every mode. Trash/confirmation/delete still target Redux `activePlan`, not the displayed `loadedPlan`.

**Repro:** load saved B through the new selector. Click green Recalculate: current order store is processed and success toast appears, while B stays saved; no B draft is created. If Redux active plan is A, Trash opens an A confirmation and deletes A, although displayed plan is B. If no Redux active plan exists, saved B has no delete action. Confirmation naming A avoids a silent delete, but does not make the controls a coherent selected-plan workflow.

**Disposition:** mode-aware, explicitly labelled actions on the intended plan. Keep intentional set-active/delete semantics distinct from local selection; do not merely disable requested behavior.

### R5 — P1: auto-sort still moves hidden siblings and can undo closed-last ordering

**Evidence:** `web/src/components/timeline/Timeline.tsx:1385–1414,664–687`; `web/src/utils/ganttRows.ts:56–88`.

Manual DnD passes matching IDs; auto-sort passes the entire selected collection to a helper with no matching-slot boundary. After live sort, `autoSort=true` also invokes the older flat render sort, whose completed check recognizes DONE but not CLOSE.

**Repros:**
- Siblings `[A(MEDIUM), H(LOW), B(CRITICAL)]`; filter matches A/B only. Auto-sort yields `[B,A,H]`, moving hidden H out of its original middle slot instead of `[B,H,A]`. This applies to draft ordering too.
- Initial persisted root order `[closed(CRITICAL,CLOSE), open(MEDIUM)]`, auto-sort off and no legacy active plan. Click Auto sort: sibling helper changes order to `[open,closed]`, so the live handler proceeds and sets autoSort true. The older `orderedTasks` sort then puts critical CLOSE first again. Display/allocation order differs from intended persisted order.

**Disposition:** one sibling/hidden-slot/closed-last ordering contract through helper, rendered collection and persistence. Existing pure manual-reorder tests are not the problem.

### R6 — P1: projection-backed modes bypass the new hierarchy/order contract

**Evidence:** `web/src/components/timeline/Timeline.tsx:898–947,950–1009`.

Only fallback/non-live rows call `buildGanttTaskRows`. Live WBS emits `projectionWbsRows` in projection order; live Master emits `group.task_ids` and assigns **every task depth 1**, regardless of its parent.

**Repros:**
- A valid nonempty projection returns sibling A/B; local selected order becomes B/A after a reorder. While that projection remains unchanged, row construction still emits A/B; changed ordered tasks do not control displayed order.
- Projection group contains P and child C. Switch to Master: both depth 1, P has no child-toggle, and P cannot collapse C. Hierarchy depends on mode/query availability.
- Existing mode test supplies an empty Review phase and empty Unphased group. New `if (taskIds.length === 0) continue` at line 932 drops both even without filters; the executed regression fails looking for Review.

**Disposition:** normalize projection/fallback/master through authoritative task hierarchy/order while retaining presentation headings. Empty-group behavior also needs regression disposition; no basis to restore the removed duplicate PriorityTaskList.

### R7 — P1: allocation vectors do not fully own Start/End and live clipping

**Evidence:** `web/src/components/timeline/Timeline.tsx:1613–1624,1781–1841`; `web/src/utils/taskAllocations.ts:105–137`; `web/src/utils/planLifecycle.ts:133–135,169–172`.

Columns test that *some* positive hours exist, then display allocation span endpoints. Allocation `start` is the requested start, not necessarily the first positive day. Live bar clipping still calls `calculateTaskSchedule` without capacity/leave and can return before positive segments are rendered.

**Repros:**
- Existing allocation fixture reserves all Monday capacity, giving Tuesday 8h and Wednesday 2h. `TaskAllocation.start` remains Monday; row Start says Monday although first positive bar is Tuesday. A valid saved span Sep 7–9 containing only Sep 8:8 similarly displays Sep 7/Sep 9, not Sep 8/Sep 8.
- Live 10h task starting Sep 7, member capacity 4h/day: explicit vector Sep 7:4, Sep 8:4, Sep 9:2. View Sep 9 only. Legacy clipping calculates default 8h/day end Sep 8 and returns null at line 1838, hiding the valid Sep 9 segment while matrix still counts 2h.

**Disposition:** derive positive-work bounds and viewport clipping from the same explicit vectors. Prior saved-bar clipping fix is real but did not fix this live branch.

### R8 — P1: matrix and Gantt dates separate after horizontal scrolling

**Evidence:** `web/src/components/timeline/MemberDailyEffortMatrix.tsx:95–97`; `web/src/components/timeline/Timeline.tsx:1146–1152,1685,1932–1940`.

Matrix owns an independent `overflow-x-auto` element with no scroll handler/ref contract. Timeline synchronizes only its grid to its header. Passing identical dates/dayWidth does not synchronize scroll positions.

**Repro:** show 30 days so both overflow; scroll Gantt right by one dayWidth. Gantt header/bars advance one day; matrix remains at day zero. Reverse by scrolling matrix alone. Same horizontal screen position now denotes different dates.

**Disposition:** shared scroll owner or deterministic synchronization, preserving common day width/origin. This is a concrete wiring blocker, not a request for visual redesign or a claim of browser verification.

### R9 — P1: no-live-tasks guard hides saved history and zero-member matrix

**Evidence:** `web/src/components/timeline/Timeline.tsx:1444–1452`, before toolbar/matrix render.

**Repro:** project has canonical members and an older saved snapshot with historical tasks; all current tasks are deleted, so `tasks=[]`. Timeline returns “No tasks scheduled”; no saved selector or member matrix is reachable. If current tasks become empty after loading a saved snapshot, the same guard hides that valid selected history. A genuinely empty live project also cannot show its zero-allocation members.

**Disposition:** empty current task list must not suppress lifecycle controls, selected historical membership or canonical zero-member rows.

### R10 — P1: unavailable scheduling data can be frozen into a normal draft

**Evidence:** `web/src/hooks/useProjectSchedulingConfig.ts:135–145,200–209,237–241`; `web/src/components/timeline/Timeline.tsx:705–726,1160–1175`; `web/src/components/timeline/PlanLifecycleBar.tsx:65–73`; `web/src/hooks/usePlanLifecycle.ts:124–130`.

Config exposes loading/error but still returns default resolvers. Only matrix rendering checks readiness; New Plan/live allocation do not. Draft creation receives no readiness state.

**Repro:** tasks load before capacity/leave/member queries. Click New Plan while those reads are pending, or after a query error. Default 8h/no-leave schedule becomes the draft. Real config then returns Monday leave or zero capacity; the already-created draft stays frozen and can be saved with invented availability. Matrix may show loading/error or later contradictory current capacity, but draft creation was accepted normally.

**Disposition:** prevent authoritative calculations from treating unavailable config as confirmed absent rows. Preserve frozen draft semantics after a valid calculation; no permanent removal of New Plan.

### R11 — P2: legacy incompleteness is lost at the matrix boundary

**Evidence:** `web/src/utils/planLifecycle.ts:235–244`; `web/src/components/timeline/PlanLifecycleBar.tsx:210–213`; `web/src/components/timeline/Timeline.tsx:1185–1191,1932–1940`; `web/src/components/timeline/MemberDailyEffortMatrix.tsx:108–124,138`.

Legacy adapter correctly invents no hours and toolbar warns globally. Matrix receives empty vectors but no completeness metadata; every affected historical cell is shown as ordinary `A 0h`/under-budget, with an accessibility label asserting 0h assigned.

**Repro:** load legacy task assigned to u1 with stored Sep 7–8 span and no daily vector. Its current canonical member's Sep 7/8 cells look identical to a genuinely known-zero member. Missing historical effort becomes apparent spare capacity in the detailed accounting view.

**Disposition:** keep known-zero members distinct from affected unknown/incomplete historical totals. Do not distribute legacy effort or manufacture hours.

### R12 — P2: legacy adapter bypasses strict corruption/version validation

**Evidence:** `web/src/utils/planLifecycle.ts:220–247,249–276`.

Any non-v2 object with at least one recognized task ID takes an early return before the duplicate/date/order/identity validation. The v2 strictness added by the producer does not apply there.

**Repros:**
- `{tasks:[{task_id:'x',priority_order:1},{task_id:'x',priority_order:2}]}` is accepted with duplicate IDs; later row/bar/effort consumers silently choose first entries rather than reject conflicting snapshot membership/order.
- `{version:3,tasks:[{taskId:'x',startDate:'2026-09-07',endDate:'2026-09-07',hoursPerDay:{'2026-09-07':8},priorityOrder:1}]}` is silently reinterpreted as legacy, discarding the vector, instead of rejecting unsupported version. This is an input-validation repro, not a request to implement v3.

**Disposition:** narrowly recognize supported legacy forms, then validate adapted identity/order/date integrity. Preserve compatibility and explicit unknown hours.

## Five prior tester failures: disposition

| Prior failure | Current evidence | Disposition |
|---|---|---|
| Saved bars clipped by current task dates | `Timeline.tsx:1781` now reads `displayedBarsOverride`; saved Sep 7/8 wiring test passes | Fixed for reported path; R7 is separate live/bounds gap |
| Duplicate selector/New/Save toolbar | Removed legacy selector/New/Save render; one `PlanLifecycleBar` at lines 1462–1465; selector test passes | Fixed; R4 concerns remaining distinct legacy actions |
| Draft auto-sort unavailable | Draft branch calls `reorderDraft` and returns before mutation at lines 1387–1389; test passes | Fixed availability/locality; R5 is ordering semantics |
| Legacy camelCase rejected | Adapter recognizes `taskId` at `planLifecycle.ts:222`; regression passes | Fixed recognized form; R11/R12 remain |
| Numeric optional assignee identity accepted | Assignee-ID validation at `planLifecycle.ts:261–265`; regression passes | Fixed reported input; not proof of all optional metadata |

All 41 tests execute; no skipped snapshots/tests reported. Current source has real handlers/validation, not replacement stubs. No reviewer test edits or fixes.

## Fresh verification

### Required six-suite gate — PASS

Executed from `web` with existing local binary (no install):

```powershell
.\node_modules\.bin\jest.cmd --config jest.config.js --reporters=default --runInBand --silent --no-cache src/components/timeline/__tests__/gantt-hierarchy.test.tsx src/components/timeline/__tests__/gantt-lifecycle-wiring.test.tsx src/utils/__tests__/gantt-rows.test.ts src/utils/__tests__/plan-lifecycle.test.ts src/utils/__tests__/member-daily-effort.test.ts src/utils/__tests__/task-allocations.test.ts
```

**6 suites passed; 41 tests passed; 0 snapshots; 14.356s; exit 0.**

### Existing adjacent mode regressions — FAIL, fully reported

Same flags, targets:

```text
src/components/timeline/__tests__/increment1-modes.test.tsx
src/components/timeline/__tests__/schedule-mode-control.test.tsx
```

**1 suite failed, 1 passed; 2 tests failed, 14 passed; 0 snapshots; 26.715s; exit 1.**

- `increment1-modes.test.tsx:170`: missing title `Select plan`. Test also expects old PriorityTaskList/legacy controls. **Obsolete expectation under accepted single-list/single-lifecycle decisions**; update test contract, do not restore duplication. Not a product blocker by itself.
- `increment1-modes.test.tsx:219`: missing empty `Review` phase, explained by R6's new unconditional empty-group skip. Real existing presentation behavior change, not an environment error.
- WBS headings, mode switching, task modal and standalone mode-control checks in these existing fixtures pass. They do not exercise reordered nonempty projections, master nested hierarchy or real pointer/keyboard operations.

`git diff --check 704d5221`: **PASS**, including final source check.

### Accepted baseline — not reopened

GANTT-TEST independently established current **303 source TS diagnostics vs 304 base**, sole removed test-error difference; configured `jest-junit` missing at base; build passes while existing config skips type/lint checks. Accepted that attribution. No fresh type/lint/build claim; none rerun here. Reporter override is explicit and hides no test failure.

## Nonissues and bounded verification gaps

- One left task column and shared `gridRows`/48px row positions exist; fallback collapse and positive-hour/no-title segment fixtures pass. Do not reintroduce PriorityTaskList or continuous fallback bars.
- Pure manual sibling DnD preserves hidden slots, rejects foreign/context/missing/orphan targets and carries subtrees. Live mutation and rollback code exist; draft mutation remains local; saved dragging is disabled with explicit Recalculate guidance.
- Matrix pure aggregation initializes canonical MEMBER rows, includes unlinked/zero members, counts direct parent/child effort once, excludes PHASE/HEADING and deduplicates task IDs. Explicit **string** resource IDs correctly beat legacy user mapping; R2 is the null/hydration branch.
- C/R/B/A, 8h comparison, day-off reasons, overload text and current-capacity label exist. No arithmetic double-add of recurring reservations to finite-task A found in scoped matrix utility/component. Actual leave/group/override/recurrence precedence and readable released layout remain separate verification gates.
- Only the live allocation path lacks the explicit full-task resource enrichment present in New Plan (`Timeline.tsx:707–713` versus `1162–1165`); `TaskOrderItem` carries only user identity. **Not promoted to a separately proven defect:** conversion implementation was outside this read scope. Real unlinked live-to-draft capacity/assignment coherence needs integration coverage.
- No generic file-size/refactor/style findings, new dependency requests, requested-feature cuts, or claims that passing mocked tests prove persistence.

## Separate gates / handoff

PM to assign bounded product fixes plus real regressions for R1–R12, then independent Gantt re-review. Current source is not approved for integration.

Still unverified here:

1. Actual GraphQL save/load/revision round trips; hard reload; live reorder full-set/concurrency conflict and failure refetch/rollback; in-flight project switching.
2. Pointer/keyboard DnD with filtered/context rows and actual projection refresh, saved/draft behavior, task navigation.
3. Released Chrome horizontal alignment/readability, capacity states, unknown legacy cells, historical-only/zero-task projects, full selected-plan conservation across hidden/offscreen tasks.
4. Canonical Members/List/Excel/clone API integration, remote migration rehearsal, backups, deployment/rollback, production readiness and whole-release acceptance — independently owned, not approved by this review.

No product/tests/config/ledger/plan changes. Wrote only this primary report (checkpoint then complete replacement). No nested agents, server/browser, DB/SSH, install, commit/push/deploy. Both Jest commands completed; no owned server/process remains.

## Freeze evidence

15 changed/untracked scoped files hashed at **14:40:19 +07:00** and again **14:48:17 +07:00**; all hashes identical, file set unchanged. Sorted manifest SHA-256, UTF-8 lines `hash + two spaces + relative path`, LF separators/no trailing LF:

`c7679b70b80aa35b1e4151a0c60581e084259beea90852563c300de50d3f7192`

Initial aggregate attempt used unavailable .NET `SHA256.HashData`; per-file hashes succeeded. Recomputed aggregate read-only with `SHA256.Create().ComputeHash()`; final comparison returned `MATCH_START True`.

```text
1bd1dfdff670dfa6ee93fea0df7e45cc3a5c79f4e12e5a490ef905f11a8d2db9  web/src/components/timeline/__tests__/gantt-hierarchy.test.tsx
ca017b0b2ec6b44e0a470512bb823ac7de1319c7907cb8929912fbfb97dff9f9  web/src/components/timeline/__tests__/gantt-lifecycle-wiring.test.tsx
71077b158ab28f92cc2acfcc02e7ff3eae8263cd9971c33d7cdde42e2d34be4b  web/src/components/timeline/MemberDailyEffortMatrix.tsx
444ecc98c61c29bd1ff251a79a7dd623ae5d2896c1e23dcab25b0abe8954aad7  web/src/components/timeline/PlanLifecycleBar.tsx
540b9e306e6494c4e736765eaf46dfd5379da66d3d5a185c9e4ea695c31d0e59  web/src/components/timeline/Timeline.tsx
af61a28f6f886966a8bf71e1843307f17ea269c77f9ed707ac414750c7c72641  web/src/hooks/usePlanLifecycle.ts
1ead7e0a3148552a8ceaa7e02cce63b33eeca944d0af3583aa1c8f8f85e863a0  web/src/hooks/useProjectSchedulingConfig.ts
d34df41a71442e910472a4388eba99a17af4b4bb7d1e57a9050ed3946bbef14e  web/src/utils/__tests__/gantt-rows.test.ts
7efd742733e898cd5a39bd204333033de5fa3795afa5cf11ef7fee517812e137  web/src/utils/__tests__/member-daily-effort.test.ts
400ec475d0475c3882970b8713aaf34912ea300f8c74b2928809134a51b121ad  web/src/utils/__tests__/plan-lifecycle.test.ts
9ebe877b4c072b8c2bcaea8f6be3d8b6e5b816b815ea1c12092bc3ea90df8b22  web/src/utils/__tests__/task-allocations.test.ts
6fc78a6723688bd77af65cc71e830cf7358b054fa70d00bed17d6f0a662d01ab  web/src/utils/ganttRows.ts
c842b17e1062c73eb3b84c8de0323da5843b2793606ca08d32af3a0e302d0f80  web/src/utils/member-daily-effort.ts
5ab154896c5c5b409749fe0088ee2105f34ea18762b15c661ad2aabea563d2b7  web/src/utils/planLifecycle.ts
fe80c2240368149eb3885bacb8420489d55e663782e66db24a0acfd30a09d34f  web/src/utils/taskAllocations.ts
```

Four untracked files are included above: `MemberDailyEffortMatrix.tsx`, `gantt-lifecycle-wiring.test.tsx`, `member-daily-effort.test.ts`, `member-daily-effort.ts`.

Supplemental direct types and two existing mode tests matched their first scoped hash at final check; all supplemental files also `git diff --exit-code 704d5221` clean. Only declaration read in `taskOrderStore.ts`; its whole-file end hash additionally recorded, no implementation audit claimed.

```text
a7f1594fd9f69dfb23b35c9d811e185db3fafc457aed4be710118acabf29f9a0  web/src/types/task.ts
987b4df80a991b3db055e2530fb10b484466b703eda9bab8cea00d6c3f2f21f5  web/src/types/plan.ts
ca74acc4c9d13126aa8322ea80d7ce00adbf1481b4ce38497ee3cf7ca718e1b7  web/src/types/schedule-projection.ts
56d9897a237b37ab0c681b2d007d1ea3e542f28b22418b038317999c1b58e8bf  web/src/types/taxonomy.ts
2fc413a4b075105b8561abf864ea20edc71060d7456edc9a5371a1a63ad1559c  web/src/components/timeline/__tests__/increment1-modes.test.tsx
515a0a5cfb40b87a8f55c15e1478fe51cdda5ca5a21d446bbe2523ef9a332d06  web/src/components/timeline/__tests__/schedule-mode-control.test.tsx
a2cddfea1669e50a80407003baaaf1cc9daac2db5a8ee1b1d980d593e0a1ef72  web/src/redux/features/taskOrderStore.ts
```

## Unresolved questions

None requiring reversal of user decisions. Remaining work is defect remediation and separately owned verification.

**End Status: DONE_WITH_CONCERNS**
