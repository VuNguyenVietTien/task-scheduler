# Phase 3: Role-Based Dashboard Refactor

## Context Links
- Current dashboard: `src/app/dashboard/page.tsx` (77 lines) - uses mock data via `useTasks()`
- Existing UserDashboard component: `src/components/dashboard/UserDashboard.tsx` (222 lines) - not used by dashboard page
- Auth context: `src/contexts/AuthContext.tsx` - `user.role` field available
- Backend query: `tasks(assigneeId, status)` in `task_resolver.rs` line 109
- Task types: `src/types/task.ts` - TaskStatus, TaskType, Priority defined
- GraphQL tasks query: `src/graphql/queries/tasks.ts`

## Overview
- **Priority:** P1
- **Status:** complete
- **Description:** Replace mock dashboard with role-based views. PM sees overdue/bugs/critical summary. Member sees their assigned tasks grouped by status. Both use real GraphQL data.

## Key Insights
- `useTasks()` hook currently returns **mock data** - must replace with real GraphQL query
- Backend `tasks(assigneeId, status)` already supports filtering by assignee - no backend changes needed
- `user.role` from AuthContext: used to determine PM vs member view
- Existing `UserDashboard.tsx` has useful patterns (status colors, pie chart) but needs significant rework
- Need new GraphQL query: `GET_DASHBOARD_TASKS` that fetches tasks with `assigneeId` param
- For PM view: need tasks across all projects (no `projectId` filter, no `assigneeId` filter)
- For member view: filter by `assigneeId = user.id`

## Requirements

### Functional

#### PM Dashboard
- Summary cards row:
  - Overdue tasks count (due_date < today && status != done/close)
  - In-progress tasks count (status = doing)
  - Bug count (type = Bug && status != done/close)
  - Critical/Urgent count (priority = critical || urgent)
- Tables:
  - Overdue tasks table (title, project, assignee, due date, days overdue)
  - Active bugs table (title, project, assignee, priority, status)
  - Critical/Urgent tasks table (title, project, assignee, due date, status)
- Click row → navigate to `/projects/{projectId}?tab=list` (task detail later)

#### Member Dashboard
- Summary cards row:
  - Active tasks count (status != done/close/archived)
  - By-status breakdown mini cards (todo, doing, review, blocked)
- Task table:
  - Columns: title, project name, status, priority, due date
  - Click row → navigate to `/projects/{projectId}?tab=list`
  - Sort by due date ascending (soonest first)

### Non-Functional
- Dashboard loads in <2s
- No mock data - real GraphQL queries only
- Graceful empty states for each section

## Architecture

```
DashboardPage
├── useAuth() → user.role
├── useDashboardTasks(userId, role) → custom hook
│   ├── PM: tasks() with no assigneeId filter
│   └── Member: tasks(assigneeId: userId)
├── PMDashboard (role === 'admin' || 'pm')
│   ├── SummaryCards (overdue, in-progress, bugs, critical)
│   ├── OverdueTasksTable
│   ├── ActiveBugsTable
│   └── CriticalTasksTable
└── MemberDashboard (default)
    ├── SummaryCards (active, by-status)
    └── MyTasksTable
```

## Related Code Files

### Modify
- `src/app/dashboard/page.tsx` - Complete rewrite: role check + conditional render

### Create
- `src/components/dashboard/pm-dashboard-view.tsx` (~120 lines) - PM summary + tables
- `src/components/dashboard/member-dashboard-view.tsx` (~100 lines) - Member summary + table
- `src/components/dashboard/dashboard-summary-card.tsx` (~30 lines) - Reusable card
- `src/components/dashboard/dashboard-task-table.tsx` (~80 lines) - Reusable table
- `src/hooks/use-dashboard-tasks.ts` (~50 lines) - GraphQL hook for dashboard data
- `src/graphql/queries/dashboard.ts` (~30 lines) - Dashboard-specific queries

### Delete / Deprecate
- `src/hooks/useTasks.ts` - references mock data; dashboard no longer uses it (keep for other consumers)
- `src/components/dashboard/UserDashboard.tsx` - can be deleted after migration

## Implementation Steps

1. **Create `src/graphql/queries/dashboard.ts`**
   - `GET_DASHBOARD_TASKS` query using existing `tasks(assigneeId, status)` resolver
   - Fields: taskId, title, projectId, status, priority, type, dueDate, assignee { userId, username }
   - No project_id filter (cross-project)

2. **Create `src/hooks/use-dashboard-tasks.ts`**
   - Accept `userId` and `role` params
   - PM role: call `tasks()` with no filters (all tasks)
   - Member role: call `tasks(assigneeId: userId)`
   - Return `{ tasks, loading, error }`
   - Compute derived data: overdueTasks, bugTasks, criticalTasks, tasksByStatus

3. **Create `dashboard-summary-card.tsx`**
   - Props: `title, count, color, icon?`
   - Simple card with count + label + optional color accent

4. **Create `dashboard-task-table.tsx`**
   - Props: `tasks[], columns[], onRowClick`
   - Generic reusable table with configurable columns
   - Row click handler for navigation

5. **Create `pm-dashboard-view.tsx`**
   - Import summary card + task table
   - Compute: overdue, in-progress, bugs, critical counts from tasks
   - Render 4 summary cards + 3 tables
   - Each table: max 10 rows with "View all" link

6. **Create `member-dashboard-view.tsx`**
   - Import summary card + task table
   - Compute: active count, by-status counts
   - Render summary cards + single task table sorted by due date

7. **Rewrite `src/app/dashboard/page.tsx`**
   - `useAuth()` for user
   - `useDashboardTasks(user.id, user.role)`
   - Conditional: PM role → `<PMDashboardView>`, else → `<MemberDashboardView>`
   - Loading spinner + error state

## Todo List
- [ ] Create `GET_DASHBOARD_TASKS` GraphQL query
- [ ] Create `use-dashboard-tasks.ts` hook
- [ ] Create `dashboard-summary-card.tsx`
- [ ] Create `dashboard-task-table.tsx`
- [ ] Create `pm-dashboard-view.tsx`
- [ ] Create `member-dashboard-view.tsx`
- [ ] Rewrite `dashboard/page.tsx`
- [ ] Test PM view with real data
- [ ] Test member view with real data
- [ ] Test empty states
- [ ] Verify navigation from table rows works

## Success Criteria
- PM sees overdue/bugs/critical summary with real data
- Member sees their assigned tasks with real data
- No mock data used anywhere
- Click table row navigates to correct project
- Loading and error states handled

## Risk Assessment
- **Risk:** Backend `tasks()` returns ALL tasks for PM (large dataset) → **Mitigation:** Add `LIMIT 100` or use pagination; tables show top 10 with "view all"
- **Risk:** `user.role` might not distinguish PM from member clearly → **Mitigation:** Check existing role values; treat `'admin'` as PM, everything else as member
- **Risk:** Cross-project task query might be slow → **Mitigation:** Apollo cache, loading skeleton

## Security Considerations
- PM dashboard shows all tasks - verify this is acceptable for the role
- Member dashboard filters by `assigneeId` - server-side enforcement exists in backend query
- Auth redirect if not logged in (existing pattern)

## Next Steps
- Clean up `UserDashboard.tsx` and `useTasks.ts` mock references after migration verified
