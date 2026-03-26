---
phase: 05
title: "Database Migration & Schema Updates"
status: complete
priority: P1
effort: 3h
execution_order: 1
---

# Phase 05 - Database Migration & Schema Updates

## Context Links
- Migration: `task-scheduler-backend/migrations/20240616000001_create_reports_tables.sql`
- Plans table: `task-scheduler-backend/migrations/20230705000001_create_plans_table.sql`
- Enums: `task-scheduler-backend/src/db/enums.rs`
- Report model: `task-scheduler-backend/src/db/models/report.rs`

## Overview
Foundation phase. Update DB schema: new role enum values, add report metrics columns, ensure plan_id FK works. Must run before all other phases.

## Key Insights
- `project_role` enum: currently `owner, manager, editor, viewer` - change to `manager, leader, member, guest`
- `reports` table already has `plan_id UUID REFERENCES plans(plan_id)` - no FK change needed
- `report_tasks` already has `planned_start_date/planned_end_date` columns - good
- Unique constraint `(report_type, report_date, project_id)` may conflict with weekly reports that save multiple times for same period - need to relax or use `period_start_date`

## Requirements
**Functional:**
- Migrate `project_role` enum from `{owner,manager,editor,viewer}` to `{manager,leader,member,guest}`
- Add `rejected_tasks INTEGER DEFAULT 0` column to `reports`
- Add `on_schedule_percentage NUMERIC(5,2) DEFAULT 0` to `reports`
- Add `delay_percentage NUMERIC(5,2) DEFAULT 0` to `reports`
- Relax unique constraint to `(report_type, period_start_date, period_end_date, project_id)`

**Non-functional:**
- Migration must be reversible
- Zero downtime - additive changes only where possible

## Related Code Files
**Modify:**
- `task-scheduler-backend/src/db/enums.rs` - update ProjectRole enum
- `task-scheduler-backend/src/db/models/report.rs` - add new fields
- `task-scheduler-backend/src/db/queries/reports.rs` - update queries for new columns

**Create:**
- `task-scheduler-backend/migrations/YYYYMMDD_report_system_refactor.sql`

## Implementation Steps
1. Create new migration file
2. ALTER `project_role` enum: rename `editor->leader`, rename `owner->manager` (keep manager), add `guest`, drop `viewer` and re-add as needed
   - Strategy: Create new enum, migrate column, drop old enum
3. Add columns to `reports`: `rejected_tasks`, `on_schedule_percentage`, `delay_percentage`
4. Drop old unique constraint, add new `(report_type, period_start_date, period_end_date, project_id)`
5. Update Rust enum `ProjectRole` in `enums.rs`
6. Update `Report` struct in models
7. Update all query functions in `reports.rs` to include new columns
8. Run `cargo build` to verify compilation

## Todo List
- [x] Write migration SQL
- [x] Update ProjectRole enum in enums.rs
- [x] Update Report model struct
- [x] Update report query functions
- [x] Run migration locally
- [x] Verify cargo build passes

## Success Criteria
- Migration applies cleanly on `task_scheduler_db`
- All existing data preserved (role mapping: owner->manager, editor->leader, viewer->guest)
- `cargo build` passes with no errors

## Risk Assessment
- **HIGH:** Enum rename can break existing rows - use ALTER TYPE with RENAME VALUE (PG10+)
- **MEDIUM:** Existing role checks in resolvers may break - grep all `ProjectRole::` usages

## Security Considerations
- Migration must preserve existing role access levels during transition
- guest role must be lowest privilege
