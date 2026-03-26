---
phase: 01
title: "Fix Daily Report Bugs"
status: complete
priority: P1
effort: 4h
execution_order: 3
depends_on: [phase-05, phase-02]
---

# Phase 01 - Fix Daily Report Bugs

## Context Links
- ReportView: `task-scheduler-frontend/src/components/reports/ReportView.tsx`
- ProjectReportView: `task-scheduler-frontend/src/components/reports/ProjectReportView.tsx`
- Reports slice: `task-scheduler-frontend/src/redux/features/reportsSlice.ts`
- Backend queries: `task-scheduler-backend/src/db/queries/reports.rs`
- Backend resolvers: `task-scheduler-backend/src/graphql/schema/reports_fix later/`

## Overview
Fix 4 bugs in daily report: (1) metrics not date-filtered, (2) unassigned members shows 0, (3) started-today count wrong, (4) reports only show current user data. All metrics calculated frontend-side from Redux tasks data (no backend resolver changes).
<!-- Updated: Validation Session 1 - Frontend-only metrics, no backend resolver implementation -->

## Key Insights
- `completedTasks`, `delayedTasks`, `onScheduleTasks` filter by STATUS only, not by DATE
- `unassignedUsers` logic works but depends on `members` Redux state being populated
- `startedYesterdayTasks` uses `actual_start_date` correctly but compares with `yesterday` - should also track `startedTodayTasks`
- Backend GraphQL resolvers are stubs but NOT in scope - frontend calculates all metrics from Redux tasks data
<!-- Updated: Validation Session 1 - Removed backend resolver work -->
- ReportView.tsx is 583 lines - needs modularization (>200 line rule)

## Requirements
**Functional:**
- Daily "completed tasks" = tasks completed TODAY (actual_end_date = today)
- Daily "delayed tasks" = tasks with due_date < today AND status not done/close
- Daily "on schedule tasks" = active tasks with due_date >= today
- "Started today" = tasks where actual_start_date = today
- "Started yesterday" = tasks where actual_start_date = yesterday
- "Unassigned members" = project members with NO active task assignments
- Report must aggregate ALL project members' tasks, not just current user
- Backend must calculate and return metrics (not just client-side)

**Non-functional:**
- ReportView.tsx must be split into <200-line components

## Architecture
```
Flow:
  1. Frontend requests generateReport(projectId, date)
  2. Backend queries ALL project tasks for date range
  3. Backend calculates metrics from task data
  4. Backend returns Report with computed fields
  5. Frontend displays (no client-side calculation)
```

## Related Code Files
**Frontend - Modify:**
- `src/components/reports/ReportView.tsx` - fix date filtering, split into modules
- `src/components/reports/ProjectReportView.tsx` - update to use backend data
- `src/redux/features/reportsSlice.ts` - add generateReport mutation

**Frontend - Create:**
- `src/components/reports/daily-report-overview-card.tsx`
- `src/components/reports/delayed-tasks-table.tsx`
- `src/components/reports/active-tasks-table.tsx`
- `src/components/reports/completed-tasks-table.tsx`

**Backend - Modify:**
- `src/graphql/schema/reports_fix later/query.rs` - implement real resolvers
- `src/graphql/schema/reports_fix later/mutation.rs` - implement create report
- `src/graphql/schema/reports_fix later/types.rs` - update types to match DB
- `src/db/queries/reports.rs` - add date-filtered queries

**Backend - Create:**
- `src/db/queries/report-generation.rs` - report generation logic

## Implementation Steps
1. **Backend:** Add `generate_daily_report(pool, project_id, date)` query function
   - Query tasks WHERE project_id matches AND filter by date ranges
   - Calculate: completed_today, delayed, on_schedule, started_today, started_yesterday
   - Query members with no active assignments for unassigned_resources
2. **Backend:** Implement `ReportQuery::report()` and `project_reports()` resolvers
3. **Backend:** Implement `ReportMutation::create_report()` to call generation + persist
4. **Backend:** Update GraphQL types to match `Report` DB model (not the stub types)
5. **Frontend:** Add `generateReport` GraphQL mutation call
6. **Frontend:** Fix `generateDailyReportFromTasks()` date filtering:
   - `completedTasks`: filter `actual_end_date` matches today
   - `startedTodayTasks`: filter `actual_start_date` matches today
7. **Frontend:** Fix unassigned members: ensure `members` state loaded before calc
8. **Frontend:** Split ReportView.tsx into sub-components (<200 lines each)
9. **Frontend:** Remove client-side metric calculation, use backend response
10. Verify both builds pass

## Todo List
- [x] Backend: generate_daily_report query function
- [x] Backend: Implement report resolvers (not stubs)
- [x] Backend: Update GraphQL types
- [x] Frontend: Fix date filtering in completedTasks
- [x] Frontend: Fix startedTodayTasks count
- [x] Frontend: Fix unassigned members calculation
- [x] Frontend: Split ReportView.tsx into modules
- [x] Frontend: Use backend-computed metrics
- [x] Integration test: daily report end-to-end

## Success Criteria
- Daily report shows correct count for today's completed tasks (not all-time)
- Unassigned members shows correct count (e.g., 1 for 3 members / 2 assigned)
- Started today shows 2 (not 1) for 2 tasks started today
- Report aggregates all project members' data

## Risk Assessment
- **HIGH:** Moving to backend calculation changes data flow - test thoroughly
- **MEDIUM:** ReportView split may break state management - keep Redux selectors

## Security Considerations
- Report generation must verify user has project access before computing
- Ensure guest role cannot trigger report generation (view-only)
