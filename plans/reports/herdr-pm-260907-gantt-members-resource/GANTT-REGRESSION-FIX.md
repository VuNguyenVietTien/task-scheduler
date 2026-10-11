# GANTT regression fix

Status: DONE_WITH_CONCERNS

## Exact five dispositions

1. Fixed saved/draft bar clipping: `Timeline.tsx` now uses `displayedBarsOverride`, so lifecycle snapshot allocations supply the clipping dates and day segments.
2. Removed parallel legacy selector/New/Save toolbar controls. `PlanLifecycleBar` is the sole connected lifecycle selector/New/Save surface.
3. Draft auto-sort now calls `planLifecycle.reorderDraft(sortedIds)` and returns before any live reorder mutation. Saved mode remains immutable.
4. `parsePlanSnapshot` now recognizes non-v2 legacy camelCase `taskId` rows as legacy snapshots without inventing daily hours.
5. v2 snapshot parsing rejects non-string, non-null optional assignee user/resource-member identities.

Snapshot null assignment remains preserved; existing hierarchy/order, saved date/allocation, daily-hours/no-zero-bar, and member-matrix regressions were unchanged.

## Verification

- Reproduction before fix: 6 suites, 36 passed / 5 failed / 41 total.
- First-fix checkpoint: `src/utils/__tests__/plan-lifecycle.test.ts` → 13/13 pass.
- Final focused gate:
  `cd web && npx jest --config jest.config.js --reporters=default --runInBand --silent src/components/timeline/__tests__/gantt-hierarchy.test.tsx src/components/timeline/__tests__/gantt-lifecycle-wiring.test.tsx src/utils/__tests__/gantt-rows.test.ts src/utils/__tests__/plan-lifecycle.test.ts src/utils/__tests__/member-daily-effort.test.ts src/utils/__tests__/task-allocations.test.ts`
  → 6/6 suites, 41/41 tests, 0 snapshots.
- `npx tsc --noEmit --pretty false` → expected existing failure: 307 total diagnostics, 303 source diagnostics, 0 from `Timeline.tsx` or `planLifecycle.ts`; full output retained at `C:\Users\TienVNV\AppData\Local\Temp\pi-bash-c2d22e250cce8791.log`.
- `git diff --check` → pass.

## Files

- Modified: `web/src/components/timeline/Timeline.tsx`
- Modified: `web/src/utils/planLifecycle.ts`
- Test regressions retained; no tests weakened or removed.
- No backend/member/List/clone/GraphQL/config/package/authority edits.

## Remaining acceptance

Focused 41-test Gantt gate passes. Independent stronger review remains required. Persisted lifecycle GraphQL, pointer/keyboard DnD rollback, hard-reload, browser, DB, and release gates were not rerun here.

## Cleanup

No server, browser, DB, SSH, install, commit, push, or deploy started. Jest and TypeScript processes completed; no owned process remains.

## Unresolved questions

- None.
