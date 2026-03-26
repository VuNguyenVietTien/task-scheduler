---
phase: 04
title: "Weekly, Monthly & Quarterly Report Enhancement"
status: complete
priority: P2
effort: 6h
execution_order: 5
depends_on: [phase-03]
---

# Phase 04 - Weekly & Monthly Report Enhancement

## Context Links
- ReportView: `task-scheduler-frontend/src/components/reports/ReportView.tsx`
- Reports slice: `task-scheduler-frontend/src/redux/features/reportsSlice.ts`
- Backend queries: `task-scheduler-backend/src/db/queries/reports.rs`
- Backend mutation: `task-scheduler-backend/src/graphql/schema/reports_fix later/mutation.rs`
- Report migration: `task-scheduler-backend/migrations/20240616000001_create_reports_tables.sql`

## Overview
Add date range picker for weekly/monthly reports. Analyze tasks against selected plan. Calculate performance metrics (% on-schedule, % delayed, rejected count, bug count). "Create Report" saves analysis to DB with plan reference.

## Key Insights
- Weekly/monthly use same metrics structure as daily - just different `period_start_date`/`period_end_date`
- `report_type` enum already has `weekly` and `monthly` values
- Report creation already supported in backend (`create_report` function exists)
- Phase-03 plan selector provides plan comparison foundation
- `reports` table new columns from phase-05: `rejected_tasks`, `on_schedule_percentage`, `delay_percentage`

## Requirements
**Functional:**
- Date range picker: select `from` and `to` dates for analysis period
- Weekly: default to last 7 days; Monthly: default to last 30 days
- Analyze tasks against selected plan (from phase-03):
  - Tasks started on schedule vs plan
  - Tasks ended on schedule vs plan
  - Overdue tasks in period
  - Bug/issue count in period
  - Rejected task count
- Performance summary: % on-schedule, % delayed, rejected count, bug count
- "Create Report" button saves computed report to DB
- Saved reports visible in report history dropdown

**Non-functional:**
- Date range must not exceed 90 days (prevent expensive queries)
- Report generation should complete within 3 seconds

## Architecture
```
Weekly/Monthly Flow:
  1. User selects "Weekly" or "Monthly" tab
  2. Date range picker shown (from/to)
  3. Plan selector shown (from phase-03)
  4. User clicks "Generate Report"
  5. Backend: query tasks with dates overlapping [from, to]
  6. Backend: compare actual vs plan dates
  7. Backend: compute metrics (%, counts)
  8. Frontend: display summary + task breakdown
  9. User clicks "Create Report" -> saves to DB
```

## Related Code Files
**Frontend - Modify:**
- `src/components/reports/ReportView.tsx` - add date range picker for weekly/monthly
- `src/redux/features/reportsSlice.ts` - add periodStart/periodEnd params

**Frontend - Create:**
- `src/components/reports/date-range-picker.tsx` - reusable from/to date picker
- `src/components/reports/performance-summary-card.tsx` - % metrics display
- `src/components/reports/report-period-analysis.tsx` - period task analysis view

**Backend - Modify:**
- `src/db/queries/reports.rs` - add period-based report generation
- `src/graphql/schema/reports_fix later/mutation.rs` - accept period params
- `src/graphql/schema/reports_fix later/types.rs` - add percentage fields

**Backend - Create:**
- `src/db/queries/report-period-analysis.rs` - period analysis query functions

## Implementation Steps
1. **Frontend:** Create `date-range-picker.tsx` component
   - Two date inputs (from/to)
   - Preset buttons: "Last 7 days", "Last 30 days", "Custom"
   - Max range validation (90 days)
2. **Frontend:** Show date range picker when reportType = weekly or monthly
3. **Backend:** Create `generate_period_report(pool, project_id, plan_id, start, end)`:
   - Query tasks where `actual_start_date` OR `actual_end_date` falls in [start, end]
   - OR tasks where `due_date` falls in range (captures overdue)
   - For each task, compare with plan dates (if plan selected)
   - Compute: total, completed_in_period, delayed, on_schedule, rejected, bugs
   - Compute percentages: `on_schedule_percentage`, `delay_percentage`
4. **Backend:** Add GraphQL mutation `generatePeriodReport(projectId, planId, startDate, endDate, reportType)`
5. **Frontend:** Create `performance-summary-card.tsx`:
   - Display: % On Schedule, % Delayed, Rejected Count, Bug Count
   - Color-coded progress bars
6. **Frontend:** Create `report-period-analysis.tsx`:
   - Table: task name, planned dates, actual dates, status, variance
   - Summary row with totals
7. **Frontend:** Wire "Create Report" button to `createReport` mutation with all computed data
8. **Frontend:** After save, refresh report list dropdown
9. Verify builds pass

## Todo List
- [x] Frontend: date-range-picker component
- [x] Frontend: Show picker for weekly/monthly tabs
- [x] Backend: generate_period_report query
- [x] Backend: GraphQL mutation for period reports
- [x] Frontend: performance-summary-card component
- [x] Frontend: report-period-analysis component
- [x] Frontend: Wire Create Report button
- [x] Frontend: Report history refresh after save
- [x] Test: weekly report generation with plan
- [x] Test: monthly report generation with plan

## Success Criteria
- Date range picker allows from/to selection
- Weekly report shows metrics for selected 7-day period
- Monthly report shows metrics for selected 30-day period
- % on-schedule and % delayed calculated correctly vs plan
- "Create Report" saves to DB and appears in history
- Saved reports load correctly when selected from dropdown

## Risk Assessment
- **MEDIUM:** Large date ranges may return too many tasks - add pagination or limit
- **MEDIUM:** Tasks spanning multiple periods - count in period where majority falls
- **LOW:** Timezone issues with date comparison - normalize to UTC

## Validation Updates
<!-- Updated: Validation Session 1 -->
- Quarterly report: same as monthly, default 90-day range. Add tab alongside weekly/monthly.
- Save reports via Next.js /api/reports route (not GraphQL mutation)
- Bug count: count tasks with type='Bug' in period, link to filtered task list

## Security Considerations
- Validate date range on API route (max 365 days for quarterly)
- Verify user project access before report generation
- Guest role: can view reports but cannot create them
