# GANTT-FINAL-REVIEW — independent final source/test verdict

**Status: DONE_WITH_CONCERNS**  
**Verdict: REJECT frozen `gm-20260907` Gantt acceptance.** R6 section association and R12 legacy-alias validation remain open; frontend reorder concurrency/refetch wiring also incomplete. This is **not a release review or release approval**.

- Task: `GANTT-FINAL-REVIEW`; separate independent reviewer, not producer/self-approval.
- Source: `C:/Users/TienVNV/Documents/prjmngr/worktrees/gm-20260907`.
- Branch: `codex/gantt-members-resource-20260907`; HEAD/base `704d5221b227a2a8491e54a236b8b980108e4c63`, plus frozen working files.
- Session: 2026-09-07 15:54–16:18, Asia/Bangkok. Concrete conversational checkpoint before ten minutes; durable report checkpoint at 16:12. Durable checkpoint was later than requested; not concealed.
- **19 original changed/untracked Gantt files identical before/after.** No product/config/existing-test changes.

## 1. Authority and boundary

Read primary AGENTS, startup docs in prescribed order (including deployment), active plan/acceptance/decision-ledger, DESIGN, GANTT-REVIEW, GANTT-AUTHORITY-FIX and FINAL-REVIEW. GANTT-TEST read **first 110 lines only**. Root README/worktree development-rules absent; primary docs/README and available global development rules used. Applied required `ak-code-review` spec/verification workflow and `ak-test` execution workflow. No requested scope cut or policy reversal.

Read nine complete changed Gantt product files, changed focused suites and bounded direct callers: task Redux normalization/fetch, reorder hook/GraphQL documents, ProjectDetailView mounting, schedule projection, allocation scheduler/capacity. No broad repository rescout. The directly called task query was inspected only to understand payload shape; no backend authorization/migration re-review.

Executable evidence is Jest pure functions, real hooks with mocked clients, and **actual Timeline DOM with real Redux reducer**. It is not browser pixel, GraphQL persistence, hard-reload, or database proof. No backend/member/List fixes, DB/SSH/browser/server/deploy/commit/push/install/nested agents.

## 2. Confirmed remaining findings

Paths relative to frozen worktree. P1 = material requested workflow/data correctness; P2 = bounded corruption-validation gap.

### GF-1 / R6 — P1: WBS headings lose their task-section association

**Source:** `web/src/components/timeline/Timeline.tsx:880-885` extracts every SOURCE_HEADING then returns `[...headings, ...taskRows]`. Task hierarchy normalization itself is valid; the heading placement is not.

**Independent actual DOM result:**

```text
Projection/input: Heading A, A root, A child, A grandchild, Heading B, B root
Rendered rows:   Heading A, Heading B, A root, A child, A grandchild, B root
```

Executed `independent-wiring.test.tsx:56-65`; exact ordered-label assertion fails. This resolves the producer's admitted concern with source **and DOM evidence**, not a hypothetical visual objection. Both left and right grids share the wrong association.

**Required invariant:** headings continue to identify their own task sections while each task subtree retains authoritative order/depth/collapse. Normalize tasks without detaching section boundaries. Do not remove headings, flatten descendants, restore PriorityTaskList, or drop real empty phases. Existing Master parent/child collapse and empty Review/Unphased tests now pass and must remain.

### GF-2 / reorder integration — P1: new client never sends expected order; failure refetch targets the wrong data owner

**Source:** Timeline manual request `Timeline.tsx:1024-1033`; auto-sort request/rollback `:1367-1377`. Both send only `projectId` and `taskOrders`. `web/src/hooks/useTasks.ts:30-40,53-67,93-130` maps only `project_id/tasks`, with no `expected_order` input or forwarding.

**Executed Timeline counterexample:** filtered siblings `[Match closed, Hidden, Match open]`; auto-sort calls mutation exactly once. The assertion that intended task IDs include **all three**, including hidden sibling, passes. The assertion that the complete pre-edit expected IDs accompany them fails: `expectedOrder` is **undefined**. Independent test `:67-76`; source mapper proves no alternative expected-order field reaches GraphQL.

**Rollback/refetch source proof:** Timeline restores optimistic local order on rejection; the hook restores its React Query cache. But `onSettled` only invalidates `['tasks']`, whose hook in this file uses `mockTasks`. Timeline consumes Redux; real fetch is `tasksSlice.ts:53-69`, mounted by `ProjectDetailView.tsx:85-88,356-359`. No rejected reorder path invokes that network thunk or updates Redux from an authoritative response. Thus a CONFLICT cannot refresh the real task list/version through this wiring.

**Required bounded integration:** next Gantt owner needs explicit `useTasks.ts` ownership (PM confirmed). Forward the **complete pre-optimistic server order**, separately from complete intended IDs, as optional `expected_order`; after failure restore and network-refetch the actual project task owner. Coordinate with **BACKEND-AUTHORITY-FIX** for accepted optional-field/auth/shared-lock contract. Backend optionality preserves old clients; it does not make this new client's missing concurrency guard complete.

**Related existing read boundary:** `web/src/graphql/queries/tasks.ts:3-58` GET_PROJECT_TASKS omits `priority_order` for roots/children; reducer reads `apiTask.priority_order` at `tasksSlice.ts:318`. Server-order reload/version fidelity needs this field propagated through the integrated data source. This is existing caller debt relevant to requested persistence, not a new SQL/backend redesign.

### GF-3 / R12 — P2: supported legacy resource/parent aliases can contradict without rejection

**Source:** `web/src/utils/planLifecycle.ts:256-269`. Conflict checks cover task/date/order and `assigneeId` pairs, but the newly accepted resource, user and parent aliases are resolved with `??` without checking agreement.

**Two executed parser counterexamples** with otherwise valid legacy task/date/order:

```json
{"assigneeResourceMemberId":"resource-a","assignee_resource_member_id":"resource-b"}
{"parentTaskId":"parent-a","parent_task_id":"parent-b"}
```

Both are accepted; independent `toThrow()` assertions fail. The adapter silently chooses one resource/parent, so the strict v2 validation after adaptation can no longer detect the conflict. No claim that current stored plans contain this corruption.

**Required invariant:** all supported aliases describing one identity/hierarchy value must agree before adaptation; conflicting data produces an explicit load error. Keep valid camel/snake legacy compatibility, empty plans, recorded spans and honest missing-hours state. Do not invent daily vectors or implement unsupported versions.

## 3. Separately owned integration dependency — do not duplicate its fix

### ID-1: live canonical resource assignment is removed upstream of Timeline

**Source:** real `tasksSlice.ts:301-340,377-387` normalizes API tasks without preserving `assignee_resource_member_id`. Timeline's enrichment (`Timeline.tsx:657-672,683-697,715-720`) cannot recover a value already discarded from Redux.

**Executed actual Timeline + real reducer result:** API task assigned to unlinked `placeholder`, 10h starting Sep 7; that member capacity 4h/day:

```text
Required: member Monday A 4h; bars 4h, 4h, 2h
Observed: member Monday A 0h; bars 8h, 2h (unassigned/default scheduling)
```

Saved-null identity tests pass; they do not exercise live resource propagation. This test does, and also covers the New Plan input boundary from that same Redux source.

**Ownership/status update from PM:** already source-confirmed/fixed by active **LIST-AUTHORITY-FIX**, `clone-dialog` worktree, with recursive reducer/normalizer work. Classify **pending integrated dependency until final hashes and this regression pass**, not an additional Gantt-owner edit. This reviewer has not reviewed/hashed that other candidate and does not approve it by report assertion. Preserve every task depth in the integrated real payload, not only flat test fixtures.

## 4. R1–R12 dispositions on frozen bytes

“Closed” below means the named source defect and focused executable regression close; not an API/DB/browser gate.

| ID | Disposition | Evidence / remaining boundary |
|---|---|---|
| R1 | **Closed, scoped** | Matching IDs supplied before collapse; New Plan schedules only matches; ancestor context saved separately, not accounted. Actual Timeline filter-input and pure zero-match tests pass. Recalculate uses saved membership, not current filters. |
| R2 | **Closed for saved identity defect** | Presence of either snapshot identity blocks live fallback. Six actual Redux-normalized saved-identity DOM cases pass, including explicit null. Live identity integration is separate ID-1. |
| R3 | **Closed, scoped** | One intent/project generation guards load/save/recalculate success/error/finally; New/Live/reorder/project changes invalidate old continuations. Deferred real-hook regressions pass. No persisted server-race claim. |
| R4 | **Closed, scoped** | One rendered mode-aware Recalculate; delete/activate target selected B, not Redux A. Exact mutation document/ID hook assertions and DOM handlers pass. Legacy dead handlers/dialog state remain unreachable; not raised as redesign work. |
| R5 | **Sorting defects closed; persistence integration open** | Hidden matching slots preserved, CLOSE-last/rendered/API intended order agree; draft sorting remains local; manual sibling/subtree/context/orphan rejection tests pass. GF-2 blocks concurrency/refetch/persisted-order acceptance. |
| R6 | **PARTIAL / OPEN** | Normalized WBS/Master tasks preserve hierarchy/collapse; existing empty Review/Unphased behavior passes. GF-1 independently proves lost WBS multi-heading association. |
| R7 | **Closed, scoped** | First/last positive keys own columns; no competing render scheduler/deadline clip. Padded saved span and reserved-first-day cases pass; 10h at 4h/day visible on third day passes with valid member inputs. ID-1 blocks real unlinked input integration, not this clip fix. |
| R8 | **Closed DOM wiring; pixels unverified** | Same dates/dayWidth and w-96 name origin; grid/header/matrix scrollLeft synchronize in both directions. Actual rendered scroll-event assertions pass. No browser geometry claim. |
| R9 | **Closed, scoped** | No live-task early return; empty live/saved fixtures retain lifecycle, historical tasks and zero members. |
| R10 | **Closed, scoped** | Loading/error/missing config payloads block calculations; confirmed empty arrays allow defaults. Real hook and Timeline input/readiness regressions pass. No mock described as persisted configuration proof. |
| R11 | **Closed, scoped** | Legacy missing vectors propagate affected member/date unknown/incomplete status and accessible text; unrelated canonical cells remain known zero. No fabricated hours. |
| R12 | **PARTIAL / OPEN** | Version/duplicate/date/order/identity corruption cases and empty legacy compatibility pass on final parser; new GF-3 alias conflicts still accepted. |

### Original-scope cross-check

- One left task hierarchy; shared `gridRows`, row keys, 48px positions, collapse labels/bars; all supplied task depths preserved (pure test through depth 6 plus grandchild DOM). Cycle/orphan/dedupe regressions pass. End-to-end source completeness still requires integrated API/reducer proof; no arbitrary stack-depth guarantee.
- Positive daily segments only; 10h → 8+2, weekend/leave/interruption gaps, no zero/missing continuous title fallback, saved membership/order/date vectors pass. No title text inside positive bars. Real task modal/mode tests pass; pointer/keyboard DnD remains a later integration gate.
- Matrix initializes canonical MEMBER rows including unlinked/zero members; direct parent effort counted once, children once, PHASE/HEADING and duplicate task occurrences excluded. Shared selected allocations, not collapsed/filter rows, feed totals. Pure conservation/legacy resource precedence pass; ID-1 prevents claiming live canonical integration complete.
- C/R/B/A and baseline 8h are separately represented; B=max(0,C−R), recurring R not added into finite-task A; zero/day-off/overload states and current-capacity label present. Capacity source retains leave-over-override/default precedence. No exhaustive real configuration/form or released pixel acceptance claimed.
- Saved viewing remains frozen; explicit recalculation follows existing accepted current-config/current-task behavior. No reversal of existing draft-order-only allocation policy or deleted-task recalc behavior based on abstract concerns.

## 5. Fresh executable checks and honest limits

Existing local Jest binary; no installation. All tests run from `gm-20260907/web` with:

```powershell
node node_modules/jest/bin/jest.js --config jest.config.js --reporters=default --runInBand --silent --no-cache <targets>
```

### Final combined gate — PASS

**11 suites; 105/105 tests passed; 0 snapshots; 45.989s.** Complete final-source run, including last parser hardening (not just the previous 26-test rerun).

Targets:

```text
src/components/timeline/__tests__/gantt-hierarchy.test.tsx
src/components/timeline/__tests__/gantt-lifecycle-wiring.test.tsx
src/components/timeline/__tests__/increment1-modes.test.tsx
src/components/timeline/__tests__/schedule-mode-control.test.tsx
src/hooks/__tests__/plan-lifecycle-authority.test.ts
src/hooks/__tests__/scheduling-config-authority.test.ts
src/utils/__tests__/gantt-rows.test.ts
src/utils/__tests__/plan-lifecycle.test.ts
src/utils/__tests__/member-daily-effort.test.ts
src/utils/__tests__/task-allocations.test.ts
src/utils/__tests__/gantt-authority.test.ts
```

### Independent counterexamples — FAIL as required by unchanged source

**2 suites; 5/5 tests failed; 0 snapshots; 9.277s.** Final combined independent run reaches the intended assertions: heading order, missing expected IDs (after confirming one complete intended-order call), live unlinked resource/day allocation, and two legacy-alias rejection cases.

Tests mock query/lifecycle boundaries for deterministic DOM inputs, but do **not** mock Timeline, row builder, allocation/matrix implementation or Redux normalizer. Parser tests invoke actual parser. Passing helper-only tests were not used to overrule these real wiring failures.

### Execution issues retained

- First required 105-suite invocation hit 120s harness timeout after one suite reported pass (77.642s). Not a successful combined result; raw `combined-105.log` retained. No owned node remained. Retried with direct Node process and captured separate stdout/stderr; full 105 summary above completed normally. Detached launchers did not retain numeric process exit codes; outcomes come from complete Jest summaries, not launcher success.
- Initial independent test harness failed before tests: dynamic `jest.mock('@/contexts/AuthContext')` not mapped by existing Jest configuration. Corrected **only own temporary test** to existing relative import convention.
- First reorder counterexample fixture was already auto-sorted during initialization, yielding no mutation; did not count this as missing-field proof. Replaced only own fixture with the established CLOSE/hidden/open trigger. Final run reaches missing expected-order assertion; all original assertions preserved.
- Several read calls timed out in `scout-block.cjs`; retried smaller reads without bypass/config changes.
- `git diff --check 704d5221`: **PASS**, including after own test cleanup.
- No redundant build, type or lint rerun. Producer/INTEGRATE already build-passed same frozen source; existing build skips types/lint. Known 303 baseline web source diagnostics plus generated-route diagnostics remain distinct, **not** attributed as new failures or re-proven. No coverage percentage claimed.

All raw evidence under:
`C:/Users/TienVNV/AppData/Local/Temp/gantt-final-review-260907-1554/`.

Key logs:
- `combined-final.stderr.log`: complete 105 gate; SHA-256 `aa4393cf79beedd1fc2d9cdc52c7fcc538cc1fd8cb48bf56296b548d1e5194df`.
- `counterexamples.stderr.log`: final five counterexamples; SHA-256 `befe6f734026d7a1c95c6e6282179883d6fdc689e88efdc906ea123be9ce11c9`.
- Earlier `combined-105.log`, `independent.stderr.log`, `independent-final.stderr.log`, `independent-parser.stderr.log` retained; failures not hidden. Initial PowerShell log is UTF-16; final direct-process logs readable normally.

## 6. Test retention / own cleanup

Added only own temporary directory `web/src/components/timeline/__tests__/gantt-final-review-temp/` with two regression files. **Existing tests/assertions and source/config unchanged.** Corrected own harness/fixture as described; never changed product to force pass.

Final tests copied to the evidence directory and removed from frozen worktree (directory absence verified at 16:14:22). Retained for next fixer:

```text
b8e5c5c7c4cf11bc3257a1329b60e1374c59e895c415e8e5cbbecb9e81a6dc71  tests/independent-parser.test.ts
44873aecae59cb92589919874f1401fcdf205102fb04f448ee3a7d2662c5bc01  tests/independent-wiring.test.tsx
```

To reproduce, copy these files back into that exact temporary relative directory, then run common Jest command targeting `src/components/timeline/__tests__/gantt-final-review-temp`. Exact location preserves the relative auth mock. Tests are deliberately red until controlled owner fixes; do not weaken assertions.

Owned node PIDs 33588/25984/37556/12252/19708 all finished; final process inspection found none. No persistent server, browser, DB connection or worker. Logs/test copies retained; no temporary worktree. Only primary write is this requested report (checkpoint then final rewrite).

## 7. Exact frozen source manifest

Captured **15:57:26 +07:00** and **16:13:38 +07:00**. File set and all 19 hashes identical after own temporary tests removed; `MANIFEST_MATCH=True`. Git status same original source/test set. Aggregate SHA-256 both times:

`52ab31786ecf87318bf1aefe11717b78c13573dfd55e3404ecceb6acf4f342f4`

Encoding: UTF-8, lowercase SHA + two spaces + relative path, sorted as below, LF separators, **no trailing LF**. Raw `manifest-before.txt` and `manifest-after.txt` retained.

```text
eba456c741e8b5b11550d8a0e2e6dfcd2fa35eeefcadee753d2597877bbd6225  web/src/components/timeline/__tests__/gantt-hierarchy.test.tsx
ebdb7cbee87e3853a0b680c30fba4baa8b53d02a8280d5674b270277802c9fcd  web/src/components/timeline/__tests__/gantt-lifecycle-wiring.test.tsx
9cde3821fd07846009de1782b1c9a50b26ff920e09fe20b12376348abe6b391b  web/src/components/timeline/__tests__/increment1-modes.test.tsx
3aeb83896fb4c2032026cc9e762245b27aab6b7692eca107c26807945c7f0329  web/src/components/timeline/MemberDailyEffortMatrix.tsx
31a17c3b3dd83cf5d759b9d51ad1b01ce24a4c57a3363f2876a02aeff8967f47  web/src/components/timeline/PlanLifecycleBar.tsx
cbfd3c2997dd55d643d0b2f8e3bd48a5bfa340442f34c333ce4b0a6abfab3159  web/src/components/timeline/Timeline.tsx
d91e7481e45a49875b0c1f27c0262dbba99d3de85c89f94da6b6cd5801a868aa  web/src/hooks/__tests__/plan-lifecycle-authority.test.ts
3bc798c77ebba66eac573c98fe2465b8ead5f35e9d61d73e574c6aa4b56e39e6  web/src/hooks/__tests__/scheduling-config-authority.test.ts
3642f000746c378014a9e0ac7309dba570668b9ed4fd2d43c9eed6c7383aab0b  web/src/hooks/usePlanLifecycle.ts
66dd82178529d072cc68a92a0fd83ee21ea5414e205f8a3bf3d88dafe4851917  web/src/hooks/useProjectSchedulingConfig.ts
0d9ed7a0c246640cfa0cd6d82781abc36db3a1f03c5c1fcbb3fc8a7a59756f1a  web/src/utils/__tests__/gantt-authority.test.ts
d34df41a71442e910472a4388eba99a17af4b4bb7d1e57a9050ed3946bbef14e  web/src/utils/__tests__/gantt-rows.test.ts
7efd742733e898cd5a39bd204333033de5fa3795afa5cf11ef7fee517812e137  web/src/utils/__tests__/member-daily-effort.test.ts
400ec475d0475c3882970b8713aaf34912ea300f8c74b2928809134a51b121ad  web/src/utils/__tests__/plan-lifecycle.test.ts
9ebe877b4c072b8c2bcaea8f6be3d8b6e5b816b815ea1c12092bc3ea90df8b22  web/src/utils/__tests__/task-allocations.test.ts
77a19868d75765b7f82b28e8e5ed09975a6cf2029feed4a6830ba2c4d6d7638a  web/src/utils/ganttRows.ts
ddbb8c025b47296bd38515fc5f5b42678de7ca2b95264eb8906c1260f57ae739  web/src/utils/member-daily-effort.ts
f2ecfb82191465f3bee54239b23b28bbc37c98d34cc5133f808b0ea1e9c1ce26  web/src/utils/planLifecycle.ts
797f496112af2cf935a3f263f851751af6a151f8614e9af497c5fd1881644ddc  web/src/utils/taskAllocations.ts
```

Supplemental direct-call files: hashes measured **at end only**, all also unchanged against base via `git diff --exit-code`; not claimed before/after hashes:

```text
582d333f9f186685bb6d201b4527b1f70afa2f68ca67f1314d3652450742f7bf  web/src/hooks/useTasks.ts
fcd8ba406b3406b4fc2a5fa9478b9d969331fdb5af9a79ff11791f7a03ea2d94  web/src/redux/features/tasksSlice.ts
34dd20d082ac118e60f658c4f2959e176b61974d666d3aa951baa3fadee31209  web/src/graphql/queries/tasks.ts
fc2bcf27622538240232f555043187bebfda91a250089d4d1a1e03536053a881  web/src/graphql/mutations/tasks.ts
00c1ee49a590ad70b6f6ddd2def7f2b2b08d02563d1188ce04ccda006987682d  web/src/components/projects/ProjectDetailView.tsx
5fe35f66bb2b5aea5d317e1ac93f68459f707a4f56773a645cc5926ac131f0bb  web/src/hooks/useScheduleProjection.ts
112d8b36ec4db3215f21ac615cbc44c15c56cc84c08aafd3a50d15b64e3f80b1  web/src/utils/taskScheduler.ts
6e0b390fe38e73be83bc18d6b6183061b06d050a0cf505767c451ce6d726c58c  web/src/utils/capacity.ts
c45baffc928cccfdca27208153dc564ebffc43ce10fed046acb5c6ab291fd3b1  web/jest.config.js
```

## 8. Handoff / unreviewed gates

1. Next authorized Gantt writer: GF-1, GF-3 and explicit `useTasks.ts` frontend GF-2 integration. Preserve existing 105 checks, empty phases and all hierarchy depths; run retained red regressions, re-freeze and obtain separate independent review.
2. LIST-AUTHORITY-FIX owns ID-1; integrate reviewed final hashes, then rerun real-reducer unlinked 4h regression. Do not duplicate edits. BACKEND-AUTHORITY-FIX owns optional expected_order/auth/shared-lock implementation; not inspected/approved here.
3. Final integrated source/read model must prove complete depth/ID/order and resource propagation, failure rollback+actual refetch, reload persistence; this frozen worktree cannot prove other active worktrees' fixes.
4. Real GraphQL plan save/load/revisions/delete/activate, backend reorder conflict/authorization, persisted hard reload, current config refresh, pointer/keyboard DnD and released browser scroll/pixels remain independent gates. Hook/DOM mocks do not substitute for them.
5. No migration artifact/DB/SSH/deploy/security/release approval. Known baseline type/lint debt remains; build's skips do not discharge it.

## Unresolved questions

No new product decision. Owner fixes, final integrated hashes and later executable integration/release gates remain outstanding.

**Final Status: DONE_WITH_CONCERNS**
