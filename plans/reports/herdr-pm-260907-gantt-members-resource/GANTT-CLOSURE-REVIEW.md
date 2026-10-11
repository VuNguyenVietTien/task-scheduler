# GANTT-CLOSURE-REVIEW

**Status: DONE_WITH_CONCERNS**  
**Scoped source verdict: REJECT GF1 closure; PASS GF2/GF3/ID1/all-depth read-model deltas.** One new concrete Gantt-owned collapse defect remains. Not release approval; not rejection for the separately owned List integration gate.

## Scope / authority

Independent reviewer, not producer. Source: `C:/Users/TienVNV/Documents/prjmngr/worktrees/gm-20260907`; branch `codex/gantt-members-resource-20260907`; HEAD/base `704d5221b227a2a8491e54a236b8b980108e4c63` plus frozen working files. Recorded startup 16:53:49; durable finding checkpoint **17:02:15**, later than requested eight-minute target; final review bounded before 17:10, 2026-09-07 Asia/Bangkok.

Read primary AGENTS/startup docs, active plan/acceptance/decisions, DESIGN ordering/modes, GANTT-FINAL-REVIEW, GANTT-INTEGRATION-FIX and relevant authority report. Root README and worktree development rules absent; primary docs/README and global rules used. Applied `ak-code-review`, `ak-test`, then scoped `ak-debug` for the counterexample. Inspected all nine integration paths and direct callers; did not reopen unchanged authority dispositions or backend security review.

## Confirmed finding — GF1/R6, P2: task collapse hides a sibling source heading

**Source:** `web/src/components/timeline/Timeline.tsx:892-911,934-978`.

Section assembly inserts authoritative task rows with root depth **0**, but keeps source subheading depth **1**. The shared depth-only collapse stack therefore treats a following sibling heading as a descendant of the preceding task root.

Independent actual Timeline + actual Redux reducer + actual `wbsRowsFromProjection` result:

```text
Before: Project heading, Section A, A root, A child, Section B, B root
Action: collapse A root
Wanted: Project heading, Section A, A root, Section B, B root
Actual: Project heading, Section A, A root,            B root
```

Pre-collapse exact labels, A-child disappearance, and B-root survival all pass. Final ordered-label assertion fails at retained `tests/section-boundary.test.tsx:64`. Both grids consume the affected `gridRows`; B's heading disappears although B's task remains, visually associating it with A.

This is a supported projection, not arbitrary malformed depth: backend owner `members-20260907/backend/src/scheduling/projection.rs:282-318,343-359` emits sibling subheadings at depth 1 and their tasks at depth 2+. Existing `web/src/lib/scheduling/__tests__/build-wbs-rows.test.ts:20-25` also records nested headings. The five new producer DOM cases use only depth-0 headings, missing this boundary.

**Required bounded fix:** prevent task-collapse ancestry crossing source-section boundaries; preserve headings, authoritative task subtree/order and real empty phases. Do not flatten descendants or remove heading metadata. Authorized Gantt owner only; rerun retained red test plus unchanged 133, re-freeze and independently review.

## Other delta dispositions

| Delta | Independent evidence / disposition |
|---|---|
| GF1 ordinary WBS / Master | Flat-heading association, reversed projection task order, depth-3 hierarchy, task collapse/expand, Empty Review and Unphased pass. Nested-heading boundary above prevents complete GF1 acceptance. |
| GF2 request authority | `Timeline.tsx:230-242,673-678,1012-1024`: flatten all Redux descendants; global `priority_order` then task-ID expected order captured before optimistic override, distinct from intended DFS order. Matches backend `tasks/mutation/reorder.rs:28-32`. `useTasks.ts:30-70,92-94` forwards optional `expected_order` through actual mutation; legacy omission retained. |
| GF2 completion / recovery | `Timeline.tsx:1015-1041`: latest reorder intent/project guards, returned ranks through real recursive Redux updater, failure drops override then dispatches actual network thunk `.unwrap()`, no unrelated React Query cache invalidation or lifecycle reset. Manual/auto each call once; hidden slots, stale mutation outcomes, newer intent and same/other-project/reset fetch tests pass. |
| All-depth read model | `tasksSlice.ts:55-84,316-361,383-430`; `graphql/queries/tasks.ts:61-97`: authenticated flat TaskTreeRows → guarded forest → preserved recursive normalization. Existing roots/child_tasks thunk contract remains; metadata/resource/ranks survive depth-3 fetch, mutation, fixture reload/remount. Public GET_PROJECT_TASKS remains compatible and selects ranks at roots/children. |
| ID1 | Actual Redux-normalized unlinked 10h task at 4h/day passes **4/4/2**, Monday **A 4h · C 4h · R 0h · B 4h**. Imported canonical normalizer and recursive local updater compare exactly equal to List source after newline normalization. |
| GF3 | `planLifecycle.ts:256-281`: all four user aliases plus resource/parent pairs compared before adaptation, including explicit null; contradictions rejected. Valid legacy/null/empty plans retain stored spans/order and honest missing-hours state; no fabricated hours. Eleven new parser cases pass. |

Actual network suite executes client documents through an in-memory GraphQL fixture, real hook/thunk/reducer/Timeline. Independently also ran `graphql.buildSchema/parse/validate` against current `members-20260907/backend/schema.graphql`: **TASK_TREE_ROWS, GET_PROJECT_TASKS, REORDER_TASKS: zero validation errors**. Read mounted TaskQuery forwarding and schema registration. No mounted-server/DB claim; backend review remains independently owned.

## Commands / actual results

From `gm-20260907/web`, existing local binary:

```powershell
node node_modules/jest/bin/jest.js --config jest.config.js --reporters=default --runInBand --silent --no-cache <targets>
```

- Original 105 + new 28: **133 passed / 133, 14 suites, exit 0, 29.111s, zero snapshots**. Exact 14 targets/command: evidence `test-command.txt`; original eleven from GANTT-FINAL-REVIEW §5 plus producer's three integration suites.
- Independent nested-section counterexample: **1 failed / 1, one suite, exit 1, 12.276s**. Exact target/command: `counterexample-command.txt`. Failure reaches intended assertion, not harness setup. No assertion changes or retries needed.
- `git diff --check 704d5221`: **exit 0**. Jest config and base schedule-mode-control test unchanged (`git diff --exit-code`, exit 0).
- No redundant build/type/lint rerun. Producer's exact original baseline **304 source → 303 source + four generated**, **zero introduced source diagnostics**, remains reported prior evidence—not a fresh clean typecheck claim.

## Frozen bytes / retention / cleanup

Before **16:56:11**, after **17:03:56**: all **26 hashes identical** to each other and producer. Aggregate SHA-256:

`2263a415f5862292519312ec6e9c9aadfdbbcb464c636df7aeb61402b8de00e6`

Full manifest: [GANTT-CLOSURE-REVIEW-manifest.txt](./GANTT-CLOSURE-REVIEW-manifest.txt). Producer's nine integration paths:

```text
web/src/components/timeline/Timeline.tsx
web/src/utils/planLifecycle.ts
web/src/hooks/useTasks.ts
web/src/redux/features/tasksSlice.ts
web/src/graphql/queries/tasks.ts
web/src/graphql/mutations/tasks.ts
web/src/components/timeline/__tests__/gantt-integration/independent-wiring.test.tsx
web/src/utils/__tests__/gantt-integration-parser.test.ts
web/src/hooks/__tests__/gantt-reorder-integration.test.tsx
```

Original **17 remaining hashes unchanged**, including original authority tests; only Timeline/planLifecycle differ from original19. `preservation.json` records comparison. Existing assertions not weakened.

Evidence root: `C:/Users/TienVNV/AppData/Local/Temp/gantt-closure-review-260907-1653/`. Contains before/after manifests, git statuses, command files, UTF-8 stdout/stderr, numeric test outcomes, schema validation, preservation and `closure-summary.json` (log/test hashes).

Retained test: `tests/section-boundary.test.tsx`, SHA-256 `ee9032eee18a995a275577b319a8ece36d8d50647a7580cfb8a1f8c81b7b5730`. Reproduce by copying to `web/src/components/timeline/__tests__/gantt-closure-review-temp/section-boundary.test.tsx` (same relative auth import), then run recorded command. Own temporary directory removed; git status matches before exactly. No owned process remains. No product/config/existing-test edits, dependencies, nested agents, DB/SSH/browser/server, commit/push/deploy or hook bypass. Only requested report/manifest and retained temporary evidence written.

## Remaining integration gates

1. **LIST-INTEGRATION-FIX owns ProjectDetailView refresh/clone-state preservation and empty-live Gantt access.** Existing parent gate at `ProjectDetailView.tsx:333-359` remains outside this candidate. Required combined test: actual ProjectDetailView + final Gantt, reject reorder/refetch while preserving selected saved plan B, complete hierarchy/resource state; empty-live saved history remains visible. Do not duplicate List's edit. This gate is **not** the reason for this rejection.
2. Final importer must preserve Gantt's final tasksSlice/query/mutation files after remaining List imports. Separate backend mounted/persistent reorder, hard reload, pointer/keyboard DnD, browser alignment and release gates remain; DOM fixtures do not discharge them.

## Unresolved questions

No new product decision. One Gantt-owned GF1 fix and separately owned combined/release gates remain.
