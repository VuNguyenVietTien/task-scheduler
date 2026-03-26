---
phase: 03
title: "Plan Selector in Reports Tab"
status: complete
priority: P2
effort: 4h
execution_order: 4
depends_on: [phase-01]
---

# Phase 03 - Plan Selector in Reports Tab

## Context Links
- Plans table: `task-scheduler-backend/migrations/20230705000001_create_plans_table.sql`
- Reports table: `task-scheduler-backend/migrations/20240616000001_create_reports_tables.sql`
- ProjectReportView: `task-scheduler-frontend/src/components/reports/ProjectReportView.tsx`
- Plans Redux: `task-scheduler-frontend/src/redux/features/plansSlice.ts` (activePlan)
- Report types: `task-scheduler-frontend/src/redux/features/reportsSlice.ts`

## Overview
Add dropdown to select a saved plan before generating a report. Report metrics compare actual task dates vs plan dates from `plan_data` JSONB. Enables plan-vs-actual analysis.

## Key Insights
- `plans.plan_data` stores `{tasks: [{task_id, start_date, end_date, ...}]}` - planned dates per task
- `reports.plan_id` FK already exists but never set - just needs to be populated
- `report_tasks` already has `planned_start_date` and `planned_end_date` columns
- `ProjectReportView.tsx` already has `plan-vs-actual` tab (line 146) reading `activePlan` from Redux
- One active plan per project (unique index constraint)

## Requirements
**Functional:**
- Dropdown lists all plans for project (not just active one)
- Selected plan's task dates used as "planned" reference
- Report metrics: tasks on-schedule vs plan, tasks delayed vs plan
- `plan_id` saved to report when generated with plan selected
- "No plan selected" option available for raw metric reports

**Non-functional:**
- Plan data fetched once, cached in Redux
- Dropdown must load within existing report page (no extra route)

## Architecture
```
Plan Selection Flow:
  1. User opens Reports tab -> plans dropdown populated
  2. User selects plan -> plan_data loaded
  3. User clicks "Generate Report"
  4. Backend: for each task, compare actual dates vs plan_data dates
  5. Backend: populate report_tasks.planned_start/end_date from plan_data
  6. Backend: calculate on_schedule_tasks, delayed_tasks relative to plan
  7. Save report with plan_id reference
```

## Related Code Files
**Frontend - Modify:**
- `src/components/reports/ReportView.tsx` - add plan selector dropdown
- `src/components/reports/ProjectReportView.tsx` - pass planId to report gen
- `src/redux/features/reportsSlice.ts` - add planId to generateReport params

**Backend - Modify:**
- `src/db/queries/reports.rs` - accept plan_id in report generation, lookup plan_data
- `src/graphql/schema/reports_fix later/mutation.rs` - accept planId input
- `src/graphql/schema/reports_fix later/query.rs` - return planId in responses

**Backend - May need:**
- `src/db/queries/plans.rs` - query to fetch plan by ID with plan_data

## Implementation Steps
1. **Frontend:** Add plans dropdown to report header (next to report type selector)
   - Fetch project plans from existing Redux state
   - Show plan name + created date in dropdown
   - Default to active plan if exists
2. **Frontend:** Pass `planId` to `generateReport` / `createReport` thunk
3. **Backend:** In report generation, if `plan_id` provided:
   - Fetch plan_data JSONB
   - For each task, find matching task_id in plan_data.tasks
   - Set `planned_start_date` = plan task's `start_date`
   - Set `planned_end_date` = plan task's `end_date`
   - Compare actual vs planned to determine `is_delayed`
4. **Backend:** Calculate `on_schedule_tasks` = tasks where actual <= planned dates
5. **Backend:** Save `plan_id` to report record
6. **Frontend:** Display plan comparison in report view (planned vs actual columns)
7. Verify builds pass

## Todo List
- [x] Frontend: Add plan selector dropdown
- [x] Frontend: Wire planId to report generation
- [x] Backend: Implement plan_data lookup in report generation
- [x] Backend: Compare actual vs planned dates per task
- [x] Backend: Save plan_id to report
- [x] Frontend: Show planned vs actual in report tables
- [x] Test: generate report with/without plan selected

## Success Criteria
- Plans dropdown lists all project plans
- Generating report with plan populates planned dates from plan_data
- Report shows on-schedule/delayed relative to selected plan
- Saved reports retain plan_id reference

## Risk Assessment
- **MEDIUM:** plan_data JSONB structure may vary - validate task_id matches
- **LOW:** Plans without matching tasks - handle gracefully (null planned dates)

## Security Considerations
- Verify user has project access before fetching plans
- Plan data is read-only during report generation
