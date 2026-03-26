---
title: "Report System Refactor"
description: "Fix daily report bugs, update role system, add plan selector, enhance weekly/monthly reports"
status: complete
priority: P1
effort: 20h
branch: feat/v2.29
tags: [reports, roles, bugfix, feature]
created: 2026-03-25
---

# Report System Refactor

## Execution Order

| # | Phase | File | Status | Effort |
|---|-------|------|--------|--------|
| 1 | DB Migration & Schema | [phase-05](phase-05-database-migration.md) | complete | 3h |
| 2 | Role System Update | [phase-02](phase-02-role-system-update.md) | complete | 4h |
| 3 | Fix Daily Report Bugs | [phase-01](phase-01-fix-daily-report-bugs.md) | complete | 4h |
| 4 | Plan Selector in Reports | [phase-03](phase-03-plan-selector-reports.md) | complete | 4h |
| 5 | Weekly/Monthly Reports | [phase-04](phase-04-weekly-monthly-report.md) | complete | 5h |

## Key Dependencies

- Phase 05 (DB) must complete first - foundation for all others
- Phase 02 (Roles) before Phase 01 (Daily) - role changes affect member filtering
- Phase 03 (Plan Selector) before Phase 04 (Weekly/Monthly) - plan comparison needed
- Backend GraphQL resolvers are ALL stubs (TODO) - must implement real resolvers

## Architecture Notes

- **Current state:** Daily reports calculated client-side from Redux state, not date-filtered
- **Target state:** Frontend calculates metrics from tasks data (no backend resolver changes needed)
- **Backend:** `reports_fix later/` directory has stub resolvers, needs full implementation
- **DB:** `reports`, `report_tasks`, `bugs` tables exist; `plans` table has `plan_data` JSONB with task dates
- **Frontend:** `ReportView.tsx` (583 lines) needs refactor into smaller components

## Scope Additions
- Bug tracking: count tasks with type='Bug' + link to filtered task list (no separate CRUD)
- Quarterly report: implement alongside weekly/monthly (same logic, 90-day range)
- Rename `reports_fix later/` to `reports/` in backend

## Research Reports

- [Frontend Analysis](../reports/researcher-01-frontend-reports.md)
- [Backend/DB Analysis](../reports/researcher-02-backend-db-reports.md)

## Validation Log

### Session 1 — 2026-03-25
**Trigger:** Initial plan creation validation
**Questions asked:** 6

#### Questions & Answers

1. **[Architecture]** Report calculation: backend nên tính metrics hay frontend tính từ raw tasks data?
   - Options: Backend tính | Frontend tính từ tasks | Hybrid
   - **Answer:** Frontend tính từ tasks
   - **Rationale:** Faster to implement, no backend resolver changes needed. Frontend already has tasks in Redux.

2. **[Migration]** Khi đổi role enum, existing users migrate thế nào?
   - Options: Map owner→manager, editor→member, viewer→guest | Reset tất cả về member | Keep owner, thêm leader
   - **Answer:** Reset tất cả về member
   - **Rationale:** Simple migration, dev/test data doesn't need preserving. Re-assign roles manually after.

3. **[Modularize]** ReportView.tsx 583 dòng, tách bao nhiêu component?
   - Options: 4 components | 2 components | 6+ components
   - **Answer:** 4 components (daily-report-view, weekly-report-view, monthly-report-view, report-metrics-card)
   - **Rationale:** Each report type has distinct UI; shared metrics card reused across all.

4. **[Bug Scope]** Bug tracking mức độ implement?
   - Options: Count only | Full CRUD | Count + link to tasks
   - **Answer:** Count + link to tasks
   - **Rationale:** Count bugs from tasks with type='Bug', link to filtered task list. No separate bug CRUD.

5. **[Save Flow]** Weekly/Monthly report save-to-DB: GraphQL mutation hay Next.js API?
   - Options: GraphQL mutation | Next.js API route | Chưa lưu
   - **Answer:** Next.js API route
   - **Rationale:** Bypass Rust backend complexity, direct DB access via Next.js API.

6. **[Quarterly]** Quarterly report implement hay defer?
   - Options: Defer | Implement luôn
   - **Answer:** Implement luôn
   - **Rationale:** Copy monthly logic with 90-day range. Minimal extra effort.

#### Confirmed Decisions
- Frontend-only metrics: no backend resolver changes for report calculation
- Role migration: reset all to member (simple SQL UPDATE)
- 4 report sub-components: daily, weekly, monthly, metrics-card
- Bug = count tasks where type='Bug', link to task list
- Save reports via Next.js API route (not GraphQL)
- Quarterly report included in phase-04

#### Action Items
- [ ] Update phase-01: remove backend resolver implementation, keep frontend-only
- [ ] Update phase-02: simplify migration to reset-all-to-member
- [ ] Update phase-04: add quarterly report alongside weekly/monthly
- [ ] Add Next.js API route for saving reports in phase-04

#### Impact on Phases
- Phase 01: Remove backend resolver work. All metrics calculated client-side from tasks Redux data.
- Phase 02: Simplify migration SQL to `UPDATE project_members SET role = 'member'` before enum change.
- Phase 04: Add quarterly tab (copy monthly, 90-day default). Save via Next.js /api/reports route.
- Phase 05: No change needed.
