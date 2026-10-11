# GANTT-ROW-BOUNDARY-FIX

**Status: DONE — scoped candidate frozen; independent fresh review required, not release approval.**

Worktree: `C:/Users/TienVNV/Documents/prjmngr/worktrees/gm-20260907`  
Branch: `codex/gantt-members-resource-20260907`  
Unchanged HEAD/base: `704d5221b227a2a8491e54a236b8b980108e4c63`  
Window: 2026-09-07 17:15–17:29 Asia/Bangkok. Durable checkpoint written **17:22**, before eight minutes. Freeze **17:27:40**.

Read primary AGENTS, docs/README → PDR → code standards → architecture → roadmap, active plan/acceptance/decision ledger, GANTT-CLOSURE-REVIEW and GANTT-INTEGRATION-FIX. Read complete owned Timeline, row helper/relevant tests, actual projection adapters and cited read-only members backend evidence. Loaded installed `ak-debug`, `ak-test`, their debugging/verification/test-execution references, and ponytail. Root README/local rules absent; primary docs and global development rules used. No nested agents.

## Exact reproduction

Unchanged retained reviewer source:
`C:/Users/TienVNV/AppData/Local/Temp/gantt-closure-review-260907-1653/tests/section-boundary.test.tsx`

SHA-256: `ee9032eee18a995a275577b319a8ece36d8d50647a7580cfb8a1f8c81b7b5730`.

From worktree root:

```powershell
$source = 'C:/Users/TienVNV/AppData/Local/Temp/gantt-closure-review-260907-1653/tests/section-boundary.test.tsx'
$target = 'web/src/components/timeline/__tests__/gantt-closure-review-temp'
New-Item -ItemType Directory -Force $target
Copy-Item $source "$target/section-boundary.test.tsx"
Set-Location web
node node_modules/jest/bin/jest.js --config jest.config.js --reporters=default --runInBand --silent --no-cache src/components/timeline/__tests__/gantt-closure-review-temp/section-boundary.test.tsx
```

Exact copy hash verified before execution/removal. Before fix: **1 failed/1**, exit **1**, **38.87s**; failure reaches intended ordered-label assertion at line 64, not harness setup.

```text
Before: Project heading, Section A, A root, A child, Section B, B root
Action: collapse A root
Old:    Project heading, Section A, A root,                    B root
Fixed:  Project heading, Section A, A root,          Section B, B root
```

Fresh unchanged retained test passes after fix. Original reviewer artifact never modified. Reproduction copy removed after validation; permanent new suite retains its assertions.

## Cause and bounded fix

`Timeline.tsx:932–953`: old shared collapse stack compared **task-relative depth** (root 0) with **source-heading depth** (sibling section 1). The next heading became a false descendant of the preceding task. The real adapter owner is `web/src/lib/scheduling/build-wbs-rows.ts:123`, imported by `useScheduleProjection.ts`, not a guessed filename. It preserves backend mixed depths. Read-only `members-20260907/backend/src/scheduling/projection.rs:282–359` confirms nested headings and task subtrees use different depth origins after Timeline's authoritative task reconstruction.

Replaced depth-only collapse with one kind-aware ancestry traversal:
- Tasks compare depths only against task ancestors; their existing heading/phase section remains enclosing context.
- A heading closes the preceding task tree; only a shallower **heading** can parent it.
- A phase closes the preceding section.
- Child affordances and hidden rows derive from this same traversal; both grids still consume the same `gridRows`.

`Timeline.tsx:1530–1545`: heading/phase rows previously had an empty control slot. Added accessible collapse/expand controls using existing state/icons, only for rows with children. Nested headings can therefore be hidden by enclosing heading collapse; this is **not** blanket heading immunity. Empty phases retain rows and have no false toggle. No task callbacks or drag semantics added to headings.

Only two product/test paths owned here:

```text
web/src/components/timeline/Timeline.tsx
web/src/components/timeline/__tests__/gantt-integration/section-boundary.test.tsx
```

Task assembly, authoritative DFS order/depth, existing WBS/Master associations, row helper, allocations/resource totals, dates, reorder, lifecycle, parser and network contracts untouched. No accepted GF2/GF3/ID1/all-depth delta reopened.

## Commands and fresh results

All Jest executions use existing local binary from `gm-20260907/web`, prefix:

```powershell
node node_modules/jest/bin/jest.js --config jest.config.js --reporters=default --runInBand --silent --no-cache <targets>
```

| Run | Result |
|---|---|
| Exact retained pre-fix counterexample | **1 failed/1**, 1 suite, exit 1, 38.87s |
| Exact retained + permanent regression suite, post-fix | **4 passed/4**, 2 suites, exit 0, 20.395s |
| Unchanged original133 + permanent new3 | **136 passed/136**, **15 suites**, exit **0**, 52.919s, zero snapshots |
| `git diff --check 704d5221` | exit **0** |
| `git diff --exit-code 704d5221 -- web/jest.config.js web/src/components/timeline/__tests__/schedule-mode-control.test.tsx` | exit **0** |

Exact original14 targets loaded directly from reviewer's `test-command.txt`; one permanent suite appended. Full executable command retained as `full-final-command.txt`; no assertions weakened, suites skipped or repeats of unchanged broad gates. No build/typecheck/lint rerun: no public contract change; final combined integration owns those. No clean typecheck claim.

New3 = retained boundary case + WBS/Master parameterized actual-adapter DOM regressions. Execute actual Timeline, Redux normalizer and WBS/Master adapters; surrounding lifecycle/capacity/query boundaries deterministic mocks. Cover depth3 task collapse/expand, sibling preservation, nested/outer heading collapse, nested collapsed-state retention, populated phase/Unphased collapse, real empty phase, exact row ordering/depth, and matching label/bar/heading-wrapper top positions throughout. Collapse performs no reorder mutation. DOM evidence is not live browser/backend persistence proof.

## Preservation and frozen artifact

All startup **26** hashes matched reviewer/producer. Final **25 other files unchanged**, including every existing test, row helper and frozen `tasksSlice.ts`, query/mutation documents, `useTasks.ts`, `planLifecycle.ts`. Only Timeline changed among original26; one new suite makes **27**. Git status delta is only the new suite path; own Timeline-only diff retained separately.

Manifest: [GANTT-ROW-BOUNDARY-FIX-manifest.txt](./GANTT-ROW-BOUNDARY-FIX-manifest.txt).

```text
Before26 aggregate: 2263a415f5862292519312ec6e9c9aadfdbbcb464c636df7aeb61402b8de00e6
Final27 aggregate:  b62827b2461dc4e01aadad2807f8a42f58cf31be83563b54c9790d32574ec500
Timeline:          8ea39643b8be7a01a0c40274e9bc2e049bcb1c91979903794454b69589558746
New test:          4e29618b1c22b8265b4de8e25f1c941b4edcd01a6e676493a03b51ff139327d0
```

Encoding: sorted lowercase SHA + two spaces + relative path, UTF-8 LF, no final LF.

## Evidence, cleanup, remaining gates

Evidence root: `C:/Users/TienVNV/AppData/Local/Temp/gantt-row-boundary-fix-260907-1715/`. Retains before/final manifests, `preservation.json` (including raw log hashes), `Timeline.before.tsx`, `timeline-own.diff`, statuses, exact command files, UTF-8 stdout/stderr, timestamps/numeric exit results, runners and cleanup evidence.

All runner/Jest children synchronous and exited. Process inspection **17:27:40**: **zero** owned runner/Jest processes. Own temporary test directory removed; original reviewer evidence retained. No server/browser/DB/SSH/dependency/config/plan/ledger writes, commit/push/deploy or secret access. Primary writes only this report and its requested manifest.

Remaining: independent fresh GF1 review; separately owned List ProjectDetailView refresh/empty-live integration; final combined tests/build/typecheck, mounted backend/persistence and browser/release gates. Preserve final Gantt shared files during imports. None is claimed closed by this bounded DOM fix.

## Unresolved questions

None.
