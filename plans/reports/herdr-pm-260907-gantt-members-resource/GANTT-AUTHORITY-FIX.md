# GANTT-AUTHORITY-FIX

Status: DONE_WITH_CONCERNS — bounded implementation handoff, 2026-09-07 15:31 Asia/Bangkok. **No release approval. Separate independent Astra review required.**

Worktree: `C:/Users/TienVNV/Documents/prjmngr/worktrees/gm-20260907`, branch `codex/gantt-members-resource-20260907`, base `704d5221` plus preserved prior source/tests.

## Authority / method
Read primary AGENTS and required startup docs, active plan/acceptance/decision-ledger, full GANTT-REVIEW, GANTT-TEST first110, GANTT-REGRESSION-FIX, DESIGN §§7–8. Root README and worktree development-rules absent; primary docs/README and global development rules used. Activated ak-debug, ak-fix, ak-test; narrow direct-call inspection, no broad rescout. Frozen R1–R12 diagnoses accepted; no baseline relitigation or scope reversal. First resolved-group checkpoint saved at ~15:05.

## Exact R dispositions / executable proof
All confirmed paths have cause-aligned source fixes and executable regressions. These are unit/hook/DOM wiring proofs, **not persisted API/DB or browser evidence**.

| ID | Disposition and proof |
|---|---|
| R1 | Implemented. Timeline supplies matching live IDs before collapse; New Plan schedules only those IDs. Ancestors saved separately as `meta.contextTasks`, excluded from allocations/accounting/drag targets. Pure selection/zero-match regression and actual Timeline filter-input regression pass. Recalculate uses saved membership/order, not current filter. |
| R2 | Implemented. Presence of either saved identity prevents fallback to live identity. Added actual API `user_id` normalization fixture: resource-null/user-absent, user-null/resource-absent, both null, resource+user strings, user-only, resource-null+explicit-user combinations pass. Prior test's camelCase assignee passed through API normalizer had erased live user ID; new fixture proves the real branch. |
| R3 | Implemented. One intent generation/project guard covers load, new, recalculate, save success/error/finally, local draft reorder, Live, delete/set-active. Project/unmount invalidates old completions. Deferred hook tests cover load→New; save→New/Live/project/reorder; recalc→selection/Live/project; stale error. Failed operations preserve valid selected data. |
| R4 | Implemented. One rendered mode-aware Recalculate action creates/rebuilds displayed draft. Delete confirmation and explicit set-active target selected loaded plan B, not Redux active A. Existing DELETE_PLAN/SET_PLAN_ACTIVE documents reused directly inside allowed lifecycle hook; **no adapter/schema/Redux edits required**. Hook tests assert exact mutation documents/IDs and selected state; DOM test asserts one button/selected name/handlers. No claimed server persistence. Unreachable old Timeline legacy handlers/dialog state remain; no rendered entry point calls them. |
| R5 | Implemented. Auto-sort replaces matching sibling slots only; CLOSE-last comparator and emitted order remain consistent because old flat render sort removed. Pure hidden-slot test plus Timeline live API-payload/render-order test pass; existing manual sibling/subtree tests retained. |
| R6 | Implemented confirmed repros. Both WBS/Master derive task rows from authoritative selected hierarchy/order, not projection depth/ID sequence. Master carries descendants with root phase, retains empty phases/Unphased; WBS retains presentation headings. Reversed projection parent/child tests in both modes pass, collapse works. Existing empty Review and modal/mode suites pass. **Bounded review concern:** WBS headings are retained ahead of normalized task rows rather than preserving every original heading-to-section interleave; multi-heading section association needs independent assessment. |
| R7 | Implemented. Positive vector keys own first/last bounds and Start/End; removed second scheduler/deadline clipping from bar render. Reserved-first-day pure test, padded saved-span columns, and 4h/day 10h task viewed only on third day pass. Explicit positive segments still own bars/matrix. |
| R8 | Implemented. Matrix/grid/header share synchronized scrollLeft, same w-96 origin/dayWidth; restoration after loading supported. DOM scroll event regression exercises both directions and origin widths. Actual browser pixels not verified. |
| R9 | Implemented. Removed empty-live early return; saved selector/history and canonical zero-member matrix remain visible. Live/saved empty-task DOM fixtures pass. |
| R10 | Implemented. Timeline passes loading/error reason; pure drafting and hook calculations fail closed; New/Recalculate temporarily unavailable until confirmed config. Live allocation no longer computes defaults during failure/loading. Incomplete query payload also reports unavailable; confirmed empty arrays legitimately permit defaults. Hook/DOM/query-readiness regressions pass. |
| R11 | Implemented. Legacy missing vectors propagate per-task recorded unknown span; affected resolved/unresolved member cells are unknown/incomplete, not ordinary 0h/under-budget; unrelated canonical zero cells remain 0h. Pure + DOM accessibility/status tests pass. No fabricated historical hours. |
| R12 | Implemented. Only unversioned/v1 legacy accepted; adapted data passes v2 identity/date/duplicate/order validation, conflicting aliases rejected, empty legacy supported. 8 corruption cases plus compatibility regression pass. Final additional boundary hardening validates context metadata/cycles and preserves legacy resource/parent aliases. Final narrow parser rerun passed: 26/26, exit 0. |

## Tests / raw evidence
Every command ran from `C:/Users/TienVNV/Documents/prjmngr/worktrees/gm-20260907/web` unless noted. Existing local binaries only, no install. `--reporters=default` explicitly avoids accepted missing configured jest-junit; no test failures hidden.

Common Jest invocation: `.\node_modules\.bin\jest.cmd --config jest.config.js --reporters=default --runInBand --silent --no-cache <targets>`.

| Run | Targets | Result | Raw log under `C:/Users/TienVNV/AppData/Local/Temp/` |
|---|---|---|---|
| Pure red | `src/utils/__tests__/gantt-authority.test.ts` | 13 failed/13, 9.744s | `gantt-authority-before-pure.log` |
| First checkpoint | above + plan-lifecycle, gantt-rows, member-daily-effort, task-allocations utils suites | 5 suites, 45 passed, 9.803s | `gantt-authority-pure.log` |
| Hook red | `src/hooks/__tests__/plan-lifecycle-authority.test.ts` | 11 failed/1 passed, 7.596s | `gantt-authority-before-hook.log` |
| Hook green | same | 12 passed, 7.471s | `gantt-authority-hook.log` |
| Wiring red | `src/components/timeline/__tests__/gantt-lifecycle-wiring.test.tsx` | 14 failed/9 passed, 17.069s | `gantt-authority-before-wiring.log` |
| Wiring/config intermediate | wiring + scheduling-config-authority | 26 passed/1 failed (missing query payload readiness), 36.598s | `gantt-authority-wiring-first.log` |
| Combined gate | exact command below | **11 suites, 105 passed, 0 snapshots, 42.566s** | `gantt-authority-full-first.log` |
| Final parser after metadata hardening | `src/utils/__tests__/gantt-authority.test.ts src/utils/__tests__/plan-lifecycle.test.ts` with same common Jest flags/CWD | **2 suites, 26 passed, exit 0, 6.378s** | `gantt-authority-parser-final.log` |

```powershell
.\node_modules\.bin\jest.cmd --config jest.config.js --reporters=default --runInBand --silent --no-cache src/components/timeline/__tests__/gantt-hierarchy.test.tsx src/components/timeline/__tests__/gantt-lifecycle-wiring.test.tsx src/utils/__tests__/gantt-rows.test.ts src/utils/__tests__/plan-lifecycle.test.ts src/utils/__tests__/member-daily-effort.test.ts src/utils/__tests__/task-allocations.test.ts src/components/timeline/__tests__/increment1-modes.test.tsx src/components/timeline/__tests__/schedule-mode-control.test.tsx src/utils/__tests__/gantt-authority.test.ts src/hooks/__tests__/plan-lifecycle-authority.test.ts src/hooks/__tests__/scheduling-config-authority.test.ts
```

Includes original 41 tests + 16 adjacent tests + 48 new regressions. No removed/skipped assertions. Only obsolete selector/PriorityTaskList expectation changed. Existing hierarchy/mode fixtures now supply successful empty scheduling-query responses rather than relying on missing-query errors as default capacity; real empty Review expectation retained.

## Build / TypeScript — failures preserved, not passed off as success
- `npm.cmd run build` → **exit 0**, compile/static generation pass. Existing build config skips type/lint checking. Raw `gantt-authority-build.log`.
- `.\node_modules\.bin\tsc.cmd --noEmit --pretty false --incremental false` initial full run → **exit 2**, 307 total/303 source diagnostics, no diagnostics in changed product files. Raw `gantt-authority-typecheck-first.log`.
- Same tsc mistakenly run concurrently with build → **exit 2**, source diagnostic filter count 0. **NOT a pass and NOT attributed to accepted source baseline.** Full retained log read: TS6053 generated `.next/types/...` files not found, included by `.next/types/**/*.ts` in web/tsconfig.json. Build was regenerating those files. Raw `gantt-authority-typecheck-final.log` preserves failed verification.
- Same tsc rerun sequentially after build, started 15:29:03 → compiler reported **exit 2 / 303 source diagnostics**; generated GraphQL route/timesheet type errors also present. Raw `gantt-authority-typecheck-final-after-build.log`. Harness command reported timeout after 90s despite printing compiler exit/count; do not call wrapper success. Process inspection afterwards found no tsc/jest/next-build node process.
- `git diff --check` from worktree root → pass, final inspection ~15:30:43.
- Lint not rerun; accepted pre-existing lint debt remains.

Raw PowerShell redirected logs use UTF-16; inspect with an encoding-aware reader. Privacy hook timed out on one large edit and one read; no bypass/skill-hook edits, later smaller permitted calls succeeded. One initial exact replacement mismatch failed atomically then corrected.

## Exact files changed this run
Product (all allowed):
- `web/src/components/timeline/Timeline.tsx`
- `web/src/components/timeline/PlanLifecycleBar.tsx`
- `web/src/components/timeline/MemberDailyEffortMatrix.tsx`
- `web/src/hooks/usePlanLifecycle.ts`
- `web/src/hooks/useProjectSchedulingConfig.ts`
- `web/src/utils/ganttRows.ts`
- `web/src/utils/planLifecycle.ts`
- `web/src/utils/taskAllocations.ts`
- `web/src/utils/member-daily-effort.ts`

Tests changed/added:
- `web/src/components/timeline/__tests__/gantt-lifecycle-wiring.test.tsx`
- `web/src/components/timeline/__tests__/gantt-hierarchy.test.tsx` (confirmed scheduling-query fixture only)
- `web/src/components/timeline/__tests__/increment1-modes.test.tsx` (obsolete single-lifecycle/list expectation and confirmed scheduling fixture)
- `web/src/utils/__tests__/gantt-authority.test.ts` (new)
- `web/src/hooks/__tests__/plan-lifecycle-authority.test.ts` (new)
- `web/src/hooks/__tests__/scheduling-config-authority.test.ts` (new)

Prior modified/untracked files preserved, including four prior pure test diffs. No backend/member/List/clone/GraphQL/schema/config/package/primary authority source edits. Only primary write is this requested report.

## Remaining / independent gates
1. Separate Astra review must assess source/data authority and R6 multi-heading presentation association; no self-approval.
2. Real save/load/revision/delete/set-active persistence, hard reload and full-order API concurrency/rollback remain independently owned. Mocked client assertions establish request wiring only.
3. Browser horizontal pixel alignment, pointer/keyboard interaction, released members/resource integration remain unexecuted per prohibition.
4. Final additional parser metadata hardening happened after combined 105-test run; final narrow rerun now passes 26/26, exit 0. Combined suite was not rerun again after this last hardening. No further scope expansion.

## Cleanup
No server/browser, DB/SSH, nested agent, commit/push/deploy/install started. Build/Jest completed. Final node process inspection found no tsc/jest/next-build process; no owned persistent process or temporary worktree. Raw logs retained. Independent reviewer not spawned (nested agents prohibited); PM must dispatch separate Astra.

## Unresolved questions
No scope decisions needed. R6 section-heading association and independently owned persistence/browser/review gates remain explicit concerns.

Status: DONE_WITH_CONCERNS
