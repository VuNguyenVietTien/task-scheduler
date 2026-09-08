# PROJECT-BURNDOWN-0908

**Status:** Complete

## Outcome
Add a project Burndown tab comparing each selected saved plan revision's immutable planned task end dates with canonical current-task `actual_end_date` evidence.

## Constraints
- Saved plan snapshot controls task membership and planned dates; no live schedule fallback or recalculation.
- Count executable/leaf tasks only; exclude current/snapshot rejected or archived tasks.
- Actual curve decrements only on `actual_end_date`; status/progress/updated_at/timesheets never infer completion.
- Missing snapshot dates, missing current tasks, completed statuses without actual end, and unscheduled tasks remain explicit.
- Reuse Recharts and existing GraphQL/Redux/i18n patterns. No backend, schema, scheduler, List/create, or CORS changes.

## Non-goals
- Progress/effort burndown.
- Historical event reconstruction.
- Plan mutation or live replanning.

## Implementation
1. Add pure task-count/date/hierarchy burndown calculations and focused unit tests.
2. Add saved-plan selector, context cards, accessible chart/table, and limitation states.
3. Wire Burndown into project detail/sidebar and EN/JA/VI locales.
4. Run focused tests, typecheck/build as practical, review diff, commit, push, and report.

## Acceptance
- Planned curve drops on selected snapshot end dates.
- Actual curve drops on matching current tasks' `actual_end_date` only.
- Two revisions with the same task and different planned dates produce different ahead/behind results.
- Parent summaries are not double-counted with descendants.
- Current delta is in task counts and clearly marked ahead/on track/behind or unavailable.
- Empty, unscheduled, missing-data, excluded, zero-effort, and unplanned scope is explicit.
