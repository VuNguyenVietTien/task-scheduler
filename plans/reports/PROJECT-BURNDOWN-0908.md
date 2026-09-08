# PROJECT-BURNDOWN-0908

## Status
Complete on `codex/project-burndown-0908` from `6469574`.

## Delivered
- New project **Burndown** sidebar/detail tab.
- Mandatory saved-plan revision selector using immutable `saved_plans.plan_data` membership and snapshot end dates.
- Planned remaining task-count curve drops on plan end dates.
- Actual unfinished curve drops only on matching current tasks' canonical `actual_end_date`.
- Ahead/on-track/behind delta in task counts as of current date; incomplete baselines show unavailable.
- Plan revision/active/stale/range context and EN/JA/VI text.
- Leaf/executable counting avoids selected parent-summary duplication; rejected/archive excluded.
- Explicit unscheduled, missing-current-task, DONE/CLOSE-without-actual-end, unplanned, zero-effort, and empty-plan states.

## Data limitations
- No completion date is inferred from status, progress, `updated_at`, timesheets, or current schedule.
- DONE/CLOSE tasks without `actual_end_date` remain unfinished in the actual curve and are called out.
- Saved tasks missing from current project data make comparison unavailable.
- V2 snapshot tasks with no allocation evidence are excluded as unscheduled, except canonical zero-effort tasks, which still use their saved end date; the baseline is never recalculated.
- Historical actual curve contains only canonical `actual_end_date` events.

## Validation
- `npm test -- --config jest.config.js --reporters=default --runInBand src/utils/__tests__/project-burndown.test.ts src/components/ui/navigation/__tests__/sidebar-project-permissions.test.tsx` — 2 suites, 8 tests passed.
- Focused TypeScript config for new component/helper/tests — passed.
- Focused Next lint for new component/helper — passed, no warnings.
- Locale JSON parse and `git diff --check` — passed.
- Full repository `tsc --noEmit` remains blocked by existing errors in untouched rich-text/task legacy modules; no errors referenced burndown files.

## Commit
Implementation commit: `1d5539f feat(projects): add saved-plan burndown chart`.

## Unresolved questions
- None.
