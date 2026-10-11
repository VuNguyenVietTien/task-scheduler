# GANTT checkpoint

Status: IN_PROGRESS — secured before deadline extension

## Completed
- Timeline now owns one `usePlanLifecycle` instance; `PlanLifecycleBar` consumes it rather than creating disconnected state.
- Draft/saved bar overrides replace live allocation maps; selected snapshot task membership/order/assignment hydrates available live metadata without admitting live-only rows.
- Replaced flat priority-list rendering with shared sortable `Task | Start | End` grid and matching bar rows; parent/child depth, collapse, and ancestor-preserving filters are wired.
- Bar cells render only positive explicit `hoursPerDay`, display only daily-hour labels, and have no date/deadline/title fallback. Empty/missing allocations draw no bar.
- Added strict snapshot metadata/validation and legacy missing-hours warning path.
- Added `member-daily-effort.ts` and `MemberDailyEffortMatrix.tsx`: direct task effort only, task-ID dedupe, explicit zero member/date rows, unresolved assignment diagnostic row, and A/8h/C/R/B display.
- Exposed `resourceMembers` from `useProjectSchedulingConfig`.
- Added/expanded focused hierarchy, bar-gap, lifecycle, allocation, Gantt-row, and member-effort tests.

## Exact checks
- `cd web && npm test -- --config jest.config.js --reporters=default --runInBand src/components/timeline/__tests__/gantt-hierarchy.test.tsx`
  - PASS: 1 suite, 5 tests, 0 snapshots (7.731s).
  - The command emits existing noisy scheduler logs and Apollo "No more mocked responses" warnings from the test's empty `MockedProvider`; neither fails the suite.
- `cd web && npx tsc --noEmit 2>&1 | grep -E "(timeline/Timeline|MemberDailyEffort|member-daily-effort|planLifecycle|taskAllocations|useProjectSchedulingConfig)" || true`
  - No touched-file diagnostics emitted. This is not a clean whole-project typecheck claim because unrelated baseline diagnostics were intentionally filtered.
- `git diff --check`
  - Passed (no whitespace errors).
- `mempalace wake-up`
  - Failed: `mempalace` is unavailable on PATH. No skill code changed.
- No servers/processes started; no commit/push/deploy/migration performed.

## Remaining acceptance / bounded follow-up
1. **Sibling-only ordering (highest risk):** current DnD still uses flat full-order `reorderGanttTaskIds`; implement/test sibling-only drops, subtree-block root moves, hidden sibling-slot preservation, foreign-parent/context rejection, keyboard behavior, and stable per-sibling auto-sort. Remove obsolete `handleTaskReorder` when no caller remains.
2. **Draft ordering:** live DnD persists optimistically with rollback; draft DnD must mutate only its local snapshot order. Saved DnD remains disabled and must guide users to Recalculate.
3. **Single selected source cleanup:** simplify the remaining Timeline date-span calculations so Start/End cells and bars exclusively derive from selected positive allocation vectors; snapshot mode with projection data must retain snapshot hierarchy/order.
4. **Matrix completion:** verify unlinked assignable MEMBER rows are not filtered out; add explicit capacity/commitment current-data/staleness label and accessible per-cell text/reason. Validate A+R/C overload vs A/B task-budget semantics.
5. **Verification:** rerun all focused utility suites together, then full independent `npx tsc --noEmit`, project Jest, lint/build as time allows. Record pre-existing failures separately.

## Files touched
- `web/src/components/timeline/{Timeline.tsx,PlanLifecycleBar.tsx,MemberDailyEffortMatrix.tsx}`
- `web/src/components/timeline/__tests__/gantt-hierarchy.test.tsx`
- `web/src/hooks/useProjectSchedulingConfig.ts`
- `web/src/utils/{ganttRows.ts,member-daily-effort.ts,planLifecycle.ts,taskAllocations.ts}`
- `web/src/utils/__tests__/{gantt-rows.test.ts,member-daily-effort.test.ts,plan-lifecycle.test.ts,task-allocations.test.ts}`

## Unresolved questions
- None; DESIGN §§7–8 define the product decisions.
