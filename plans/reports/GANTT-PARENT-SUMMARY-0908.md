# GANTT-PARENT-SUMMARY-0908

## Status

DONE

## Commits

- `355c8d7` — parent summary effort/allocation behavior; pushed.
- `e5c2640` — Master phase grouping and continuous-span rendering; pushed.

## Delivered

- Gantt parents derive effort and sparse daily bars from executable descendants only; nested summaries do not double count.
- Summary parents consume no scheduling/member/phase capacity and derived values are not persisted over task data.
- Collapse/hierarchy and child priority scheduling remain intact; unscheduled descendants create no fake dates.
- Master shows one populated phase row, phase name only in the left table, left start/end from selected-plan allocation bounds, and one continuous rounded span across intervening weekends/leave.
- Live and saved plans use the same Master layout. Missing historical phase metadata yields one explicit `Unclassified / not recorded` row.

## Files

- `web/src/components/timeline/Timeline.tsx`
- `web/src/components/timeline/PhaseScheduleRow.tsx`
- `web/src/utils/ganttRows.ts`
- `web/src/utils/taskAllocations.ts`
- `web/src/lib/scheduling/build-master-rows.ts`
- Focused tests beside these owners.

## Verification

- Parent-summary checkpoint: 3 suites, 27 tests passed.
- Final focused run: 5 suites, 61 tests passed.
- Live/saved Master targeted run: 4 tests passed (27 skipped by name filter).
- `git diff --check`: passed.
- No full typecheck/lint/browser run, per scope.

## Known limitations

- Existing unrelated `R5 live auto-sort` lifecycle test fails unchanged on base `357fdaa` and this branch; not caused or modified by this slice.
- Legacy snapshots without recorded phase IDs cannot recover a historical phase and therefore display explicit Unclassified.

## Unresolved questions

None.
