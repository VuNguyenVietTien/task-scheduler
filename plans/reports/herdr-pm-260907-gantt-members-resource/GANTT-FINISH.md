# GANTT-FINISH

Status: DONE_WITH_CONCERNS

## Completed
- Sibling-only DnD helper: moves parent subtree blocks; rejects foreign/context/missing/orphan targets; replaces only visible sibling slots so hidden siblings retain relative order. Existing DnD keyboard sensor remains scoped to draggable matching tasks.
- Draft reorder is local snapshot state only. Saved view disables dragging and states Recalculate guidance. Live manual reorder and per-sibling stable auto-sort persist through existing full-order mutation with optimistic rollback.
- Selected draft/saved plan now supplies membership/order/parent/assignment metadata; non-live rows bypass live projection. Slow plan loads/project switches are sequenced/reset. Snapshot validation and local date keys hardened.
- Start/End labels and rendered bars consume allocation vectors. Bars still render only positive per-day hours; zero/missing/weekday gaps remain blank.
- Matrix keeps canonical MEMBER rows including unlinked/zero members, consumes direct task ID once, uses diagnostic unresolved rows, preserves explicit resource assignment over legacy user fallback, and exposes A/C/R/B, baseline/total-load flags, leave reason, aria text, and current-capacity snapshot staleness label.

## Changed files
- `web/src/components/timeline/Timeline.tsx`
- `web/src/components/timeline/PlanLifecycleBar.tsx`
- `web/src/components/timeline/MemberDailyEffortMatrix.tsx`
- `web/src/hooks/usePlanLifecycle.ts`
- `web/src/utils/ganttRows.ts`
- `web/src/utils/planLifecycle.ts`
- `web/src/utils/member-daily-effort.ts`
- `web/src/utils/__tests__/gantt-rows.test.ts`
- `web/src/utils/__tests__/plan-lifecycle.test.ts`
- `web/src/utils/__tests__/member-daily-effort.test.ts`

## Checks
- `cd web && npm test -- --config jest.config.js --runInBand src/utils/__tests__/gantt-rows.test.ts`
  - FAIL baseline environment: configured `jest-junit` module unavailable. No reinstall/config edit.
- `cd web && npx jest --config jest.config.js --reporters=default --runInBand src/utils/__tests__/gantt-rows.test.ts`
  - PASS: 1 suite, 9 tests.
- `cd web && npx jest --config jest.config.js --reporters=default --runInBand src/utils/__tests__/gantt-rows.test.ts src/utils/__tests__/plan-lifecycle.test.ts src/utils/__tests__/member-daily-effort.test.ts src/utils/__tests__/task-allocations.test.ts`
  - PASS: 4 suites, 30 tests. Existing scheduler console noise only.
- `cd web && npx jest --config jest.config.js --reporters=default --runInBand src/components/timeline/__tests__/gantt-hierarchy.test.tsx`
  - PASS: 1 suite, 5 tests. Existing empty MockedProvider warnings only.
- `cd web && npx jest --config jest.config.js --reporters=default --runInBand --silent src/components/timeline/__tests__/gantt-hierarchy.test.tsx`
  - PASS final rerun: 1 suite, 5 tests.
- `cd web && npx tsc --noEmit`
  - FAIL baseline, unfiltered. Existing repo errors across task/rich-text editor/types/GraphQL surfaces; no diagnostics remain for modified Gantt files after final rerun.
- `git diff --check`
  - PASS.

## Cleanup
- No server/process started. No install, package/config, backend, DB, deploy, commit, or push.
- `mempalace wake-up` unavailable: command not found.

## Concerns
- Whole-project TypeScript and default Jest remain baseline-failing; independent TEST/REVIEW owns final suite resolution.
- Full build skipped because baseline typecheck fails.

## Unresolved questions
- None.
