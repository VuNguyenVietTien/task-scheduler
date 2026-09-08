# BURNDOWN-BASELINE-0908

## Status
Complete on `codex/burndown-baseline-0908` from `c2377bf`.

## Root cause
Burndown loaded saved plans through shared `parsePlanSnapshot`. That parser correctly rejects invalid allocation vectors, but task-count burndown only needs saved membership and end dates. One invalid `hoursPerDay` entry therefore blocked the entire chart.

## Fix
- Added Burndown-only saved-plan reader for canonical/legacy task IDs, saved start/end dates, status, and hierarchy context.
- Removed Burndown dependency on allocation parsing and `hoursPerDay`; valid saved end dates count even with invalid or empty daily hours.
- Missing saved end dates remain unscheduled/incomplete; no fallback to start date, including legacy plans.
- Actual curve remains based only on current canonical `actual_end_date`; status and `updated_at` do not infer completion.
- Shared `web/src/utils/planLifecycle.ts` unchanged.

## Validation
- Focused Jest: `web/src/utils/__tests__/project-burndown.test.ts` — 1 suite, 7 tests passed.
- Regression covers malformed daily hours, empty daily hours with valid end date, legacy missing end date, and `updated_at` without `actual_end_date`.
- Isolated worktree had no installed test binary; reused existing dev worktree dependencies without package changes.
- No broad checks or deployment run, per scope.

## Commit
Implementation: `b6df4e1 fix(projects): decouple burndown from allocation parsing`.

## Unresolved questions
- None.
