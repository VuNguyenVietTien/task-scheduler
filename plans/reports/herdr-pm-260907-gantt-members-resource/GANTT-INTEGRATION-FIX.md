# GANTT-INTEGRATION-FIX

**Status: DONE_WITH_CONCERNS** — bounded candidate frozen 2026-09-07 16:46 Asia/Bangkok. **Independent review required; not release approval.**

- Worktree: `C:/Users/TienVNV/Documents/prjmngr/worktrees/gm-20260907`
- Branch: `codex/gantt-members-resource-20260907`; unchanged HEAD/base `704d5221b227a2a8491e54a236b8b980108e4c63` plus working files.
- Dispatch 16:21:30; first durable checkpoint created **16:26:27** (initial text used approximate ~16:28 label); final before 30-minute deadline.
- Read primary AGENTS/startup docs including deployment, plan/acceptance/decisions, DESIGN ordering/modes, full GANTT-AUTHORITY-FIX and GANTT-FINAL-REVIEW, exact sources and retained counterexamples. Root README/local development rules absent; primary docs/README and global development rules used. Required `ak-debug`/`ak-test` workflows applied. No broad rescout.

## 1. Imported prerequisites — not my inventions

FIRST copied these exact final LIST-AUTHORITY-FIX files from `../clone-dialog-20260907`; source and target SHA equality verified before edits:

```text
44eac5a019bb62930d39072fad38d40601548d6f09759e2efae4592fa293eb6c  web/src/redux/features/tasksSlice.ts
cc091a289cca96401345aba061285ae5f52ba5d3a7a62f3af87ea8084e57c955  web/src/graphql/queries/tasks.ts
b7180d4a376731addeda7433ee5cca1f5a594a1d454f7f9087d077d8d53c13b3  web/src/graphql/mutations/tasks.ts
```

Preserved imported canonical resource-ID normalizer and recursive `updateTaskLocally` implementation; complete blocks compare equal after line-ending normalization. Mutation document file remains byte-identical to import. Own tasksSlice edits only all-depth read/forest reconstruction and request/project freshness; query edits only add `priority_order` to existing public roots/child selection.

**RELEASE IMPORT RULE: take final `tasksSlice.ts`, `graphql/queries/tasks.ts`, `graphql/mutations/tasks.ts` FROM THIS candidate AFTER importing remaining final List files. Never overwrite these with older List versions.**

## 2. Exact findings and integrated source proof

| Finding | Resolution / executable evidence |
|---|---|
| GF-1 / R6 | WBS sections retain their source headings. Authoritative root/task subtrees are placed within their associated section, not appended after every heading. Exact `Heading A, A root, A child, A grandchild, Heading B, B root` DOM assertion passes. Additional reversed projection/depth3 tests cover WBS/Master and task collapse/expand; retain Empty Review and Unphased. No heading removal, descendant flattening, or second hierarchy. |
| GF-2 | One shared live persistence handler serves manual and auto-sort. Complete PRE-EDIT server IDs captured separately from intended IDs; expected order uses global `priority_order, task_id` ordering matching backend lock query, not DFS or optimistically sorted display. Actual `useTasks` mapper forwards optional `expected_order` inside existing `ReorderTasksInput`. Hidden matched sibling slots and subtree/no-reparent helpers retained. One mutation/action. Success applies returned ranks through imported recursive Redux updater. Failure drops optimistic override, then dispatches actual `fetchProjectTasks(...).unwrap()` network refresh; removes unrelated mock-backed React Query cache mutation/invalidation. Latest-intent/project guards suppress stale completions. No lifecycle reset on failure. |
| GF-3 / R12 | Legacy alias agreement checked BEFORE adaptation for resource, parent and all four supported user aliases (`assigneeUserId`, `assignee_user_id`, `assigneeId`, `assignee_id`), including explicit-null contradictions. Both retained red counterexamples and added cross-alias cases pass. Valid camel/snake/null, empty plan, stored dates/order and honest missing-hours compatibility retained. |
| ID-1 | Exact independent actual Timeline + actual Redux normalizer unlinked-member regression passes **from prerequisite import alone**: 10h work at 4h/day renders 4/4/2; Monday matrix `A 4h · C 4h · R 0h · B 4h`. No duplicate normalizer fix. Repeated in final combined gate. |
| Complete read model | `fetchProjectTasks` now requests existing authenticated flat `TASK_TREE_ROWS`, rebuilds a full forest using existing cycle/orphan-safe `buildGanttTaskRows`, then uses preserved recursive API normalizer. Public thunk return remains roots with `child_tasks`; public `GET_PROJECT_TASKS` operation/response stays compatible. Timeline flattens all Redux descendants, preserving canonical IDs/metadata, and uses Redux persisted ranks plus a separate optimistic override, not stale legacy/saved task-order state. Actual GraphQL document fixture → thunk → reducer → DOM test reaches depth3, verifies description/tags/type/actual dates/resource ID, guarded expected global order versus DFS, and rank/resource retention after a fresh network fixture reload/remount. |

### Backend read proof (read-only)

Canonical owner source `members-20260907/backend/src/graphql/resolvers/tasks/mod.rs:22-33` forwards mounted `tasks` and `task_tree_rows`; `graphql/schema.rs:28` mounts TaskQuery.

- `tasks/query/tasks.rs`: recursive DB rows assembled into a forest; return is **roots only**, children attached recursively. Original frontend selection requested one child level; GraphQL therefore omitted grandchildren despite backend materialization.
- Same file `task_tree_rows:164+`: authenticated project-read guard, selects every active project row without root predicate, includes priority and resource ID, emits flat parent-before-child rows with corruption guards. No arbitrary recursive query depth added.
- `tasks/mutation/reorder.rs`: current expected IDs ordered globally by `priority_order, task_id` under project lock. Frontend comparison ordering matches this, intentionally distinct from flat tree presentation order.

This is source + fixture document validation, **not actual mounted backend/DB/network persistence proof**. Backend freeze/review remains separately owned; gm backend was not imported/edited.

## 3. Fresh checks, failures retained

All Jest runs use existing local binary from `gm-20260907/web`:

```powershell
node node_modules/jest/bin/jest.js --config jest.config.js --reporters=default --runInBand --silent --no-cache <targets>
```

| Run | Result | Raw evidence |
|---|---|---|
| Restored retained independent counterexamples, before own fixes | **4 failed / 1 passed / 5**, 2 suites, 12.319s. GF-1/GF-2/both GF-3 reproduce. ID-1 already green because prerequisite import was required FIRST. | `red.stderr.log`, `red.stdout.log` |
| First cause fixes + existing lifecycle wiring | **28/28**, 3 suites, 31.182s | `first-green.stderr.log` |
| Expanded integration tests first run | **7 failed / 21 passed / 28**. Own new network DOM fixture omitted confirmed `daysOff: []`, causing matrix harness error before assertions. Fixed only fixture; no product workaround/assertion weakened. | `integration-focused.log` |
| Actual network document/thunk/reducer/Timeline suite rerun | **12/12**, 1 suite, exit **0**, 8.484s | `integration-network-final.log`, `.exit.txt` |
| FINAL original105 + new28 | **133/133**, **14 suites**, exit **0**, 0 snapshots, **36.093s** | `full-final.log`, `.exit.txt`, `.utf8.log` |
| `git diff --check 704d5221` | **exit 0** | `diff-check.exit.txt` |

Final targets: original 11 suites in GANTT-FINAL-REVIEW §5, unchanged, plus:

```text
src/components/timeline/__tests__/gantt-integration/independent-wiring.test.tsx
src/utils/__tests__/gantt-integration-parser.test.ts
src/hooks/__tests__/gantt-reorder-integration.test.tsx
```

New28 = 5 DOM counterexample/mode cases + 11 legacy parser cases + 12 network/reducer/reorder cases. Tests execute actual Timeline, actual useTasks mutation and mapper, actual Redux thunk/reducer, actual GraphQL query/mutation documents against a local in-memory schema fixture. Capacity/projection/lifecycle boundaries deterministic mocks. Manual test invokes captured real DndContext handler, **not browser pointer/keyboard sensor proof**. Rejected mutation success/error after project switch, newer live intent, latest same-project/project-switch/reset fetches, saved-selection preservation, hidden slots and imported recursive assignment update covered. No actual DB/hard-reload/browser claim.

### Typecheck against ORIGINAL baseline, not rejected producer

Commands: `node node_modules/typescript/bin/tsc --noEmit --pretty false --incremental false`.

- Original `704d5221` extracted with controlled `git -c core.autocrlf=false archive ... web` into own temporary directory; existing node_modules junction only, no install/config changes.
- Baseline: **exit 2, 304 source diagnostics**.
- Candidate: **exit 2, 303 source diagnostics**, plus **4 pre-existing generated `.next/types` route/timesheet diagnostics** (baseline archive has no generated build output).
- Compared diagnostic path/code/message, normalizing line/column shifts only: **0 introduced source diagnostics; 0 own-file diagnostics**. One inherited authority test diagnostic removed (`gantt-hierarchy.test.tsx` title mock typing). Not my unrelated debt cleanup. Existing `increment1-modes.test.tsx` diagnostic remains baseline debt.
- Full raw logs retained; `type-comparison.json` contains precise delta. No clean full typecheck claim. Build/lint not rerun or claimed.
- First detached baseline launcher produced empty logs, unusable as evidence; direct run above supersedes it. Some PowerShell stderr captures label PASS output `NativeCommandError`; retained numeric child exit files, not PowerShell formatting, establish exit status.

## 4. Frozen files / hashes

Only **Timeline.tsx and planLifecycle.ts** changed among original19 frozen Gantt paths; remaining **17 hashes unchanged**, including all original authority test files. Added/imported seven paths makes final26 candidate manifest.

Aggregate final26 SHA-256: `2263a415f5862292519312ec6e9c9aadfdbbcb464c636df7aeb61402b8de00e6`.
Encoding: sorted lowercase SHA + two spaces + relative path, UTF-8 LF, no final LF. Complete `manifest-final.txt`, `manifest-summary.json` retained in evidence directory.

Exact own edited/new/imported paths:

```text
15e88f8ad82912fbf9cafb33e3e04e0edafb130e874acd24149fde242cc632aa  web/src/components/timeline/Timeline.tsx
b83c0b694faf94d1ee502251b7954a2fc7774d274acba1b1f2b124fd737f9bfd  web/src/utils/planLifecycle.ts
53de3fe0da89774cd4e05f1af0f9071c407412da0e830680ccbfad81f60f478c  web/src/hooks/useTasks.ts
d94cd0cc78425690d959398e992b28b9404c1ded4432e24d17b39f9d04430117  web/src/redux/features/tasksSlice.ts
76683cf670049d51ce109586d8d818a6141385ae9a36aa8c5c9f17af82f0cf2d  web/src/graphql/queries/tasks.ts
b7180d4a376731addeda7433ee5cca1f5a594a1d454f7f9087d077d8d53c13b3  web/src/graphql/mutations/tasks.ts
23c6fdb6ac8557802e0d85353b81947e3da61cf9d97bd67c84ceed62a9199e6d  web/src/components/timeline/__tests__/gantt-integration/independent-wiring.test.tsx
ea8b1e52c284896631ed18db3e0b428bcb88336d5d350ce1c05d7f166d85488b  web/src/utils/__tests__/gantt-integration-parser.test.ts
6a5c4e1b9c39458459beb88204cc8e15fc1f5b07a816ff425bcc3330ca51c050  web/src/hooks/__tests__/gantt-reorder-integration.test.tsx
```

## 5. Remaining integrated dependency / handoff

1. **LIST-INTEGRATION-FIX owns ProjectDetailView parent refresh preservation.** PM reports real parent unmounts views while `loadingTasks`; source `ProjectDetailView.tsx:333+` gates Gantt behind loading/empty state. My mounted-Timeline selected-plan failure test passes, but cannot prove state retention through this real parent until List owner's fix is integrated. `ProjectDetailView.tsx` untouched. Final combined test must mount actual parent, force rejected reorder/refetch, retain selected saved plan B and complete hierarchy/resource state. Parent empty-task gate also remains outside this candidate; check empty-live/historical Gantt in final parent integration. Do not mislabel isolated DOM proof as end-to-end closure.
2. ID-1 canonical source imported and regression green. Remaining List/Excel/Clone/member files and new parent fix are **not** imported/reviewed by me. Final importer must obey the three-path ordering rule above; shared paths remain exclusively this frozen candidate.
3. Backend expected_order/flat tree API implementation independently owned; no need to wait for it to author compatible frontend field. Actual deployed/mounted contract, conflict transaction, persistent hard reload, browser interactions and release checks remain separate gates.
4. Independent reviewer must consume final26 manifest + raw counterexample/gate logs. No self-approval. Original base type/lint debt not repaired or hidden.

## 6. Evidence / cleanup

Evidence root: `C:/Users/TienVNV/AppData/Local/Temp/gantt-integration-fix-260907-1621/`.

Key raw SHA-256:

```text
9e49441590c463006ee46b6462841b083455c68fbbecff56c4a53576b5cb98da  red.stderr.log
3744d0d762dd5e7f4940ff7e196d71319ac4df776bfc0dc50396011fe7c0fb41  full-final.log
0fedc04462fc7d87ebec5944234d2a5c752cdbcd6a159892455b45bac8788201  full-final.utf8.log
fdb93db8dc8c9818022ab6ad3be1a6f8474e522aa513804ea580311a93740090  integration-network-final.log
a5ebfd3b5746cc1206a17101505bcb9b8031228cd928acce5293070bbe57888d  type-baseline.log
1af7d108cc1e842d54460902d9bb22a8839714ce87bf405102c060fa2b0e75d9  type-candidate.log
604f45c91d9607cd0ae56dd3f8ac8935f3bbad1c4d0252d366c74476dc249985  type-comparison.json
```

PowerShell `.log` captures UTF-16; matching `.utf8.log` copies provided. Original final-review retained tests/logs untouched. Permanent regression paths only; no test-temp directory in candidate. Temporary baseline archive/extraction and own junction removed safely; initial Windows rmdir slash-format failure retained in session, corrected path succeeded. Final process inspection 16:46:25: no owned Jest/tsc/evidence Node process. No server/browser/DB/SSH/dependency/package/config/migration/commit/push/deploy/nested agent. Primary report is sole primary write.

## Unresolved questions

No new product decision. Pending independently owned real-parent refresh/empty-view preservation and final combined review/persistence/browser gates above.

**Final Status: DONE_WITH_CONCERNS**
