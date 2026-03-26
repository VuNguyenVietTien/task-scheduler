# Frontend Report System Analysis

## Executive Summary
Frontend reports system calculates metrics from local Redux task state in real-time. No backend filtering for current user—all project tasks included. Daily reports calculate "tasks today" and "tasks yesterday" using client-side date logic.

---

## 1. Daily Report Calculation Logic

### File: `src/components/reports/ReportView.tsx` (lines 29-96)

**"Tasks Today" & "Tasks Yesterday" Calculation:**
- **Today Definition:** `new Date()` with `setHours(0, 0, 0, 0)`
- **Yesterday Definition:** Today minus 1 day, same time normalization

**Metric Extraction (lines 36-70):**

| Metric | Filter Logic | Issue |
|--------|-------------|-------|
| `completedTasks` | `task.status === 'done' \|\| task.status === 'close'` | Status-based, not date-based |
| `delayedTasks` | `due_date < today && status !== 'done/close'` | No distinction between days |
| `onScheduleTasks` | `due_date >= today && status !== 'done/close/blocked'` | Time-agnostic filter |
| `startedYesterdayTasks` | `actual_start_date.toDateString() === yesterday.toDateString()` | **Correctly filters by yesterday** |

**Critical Issue:** `completedTasks`, `delayedTasks`, `onScheduleTasks` are NOT filtered by date. They aggregate ALL matching tasks regardless of when completed/started.

### "Unassigned Resources" Logic (lines 63-70)
```typescript
const assignedUserIds = tasks
  .filter(task => task.assignee && task.status !== 'done' && task.status !== 'close')
  .map(task => task.assignee?.userId);

const unassignedUsers = members
  .filter(member => !assignedUserIds.includes(member.user.userId))
```
- Shows project members with NO active tasks
- **Does NOT filter by current user**—all project members queried

---

## 2. Report Types & Data Fetching

### File: `src/components/reports/ReportView.tsx`

**Supported Report Types (line 21):**
```typescript
const [reportType, setReportType] = useState<ReportType>('daily');
```
Options: `daily | weekly | monthly | quarterly` (from Redux types)

**Data Fetching (line 144):**
```typescript
dispatch(fetchProjectReports({ projectId, reportType }));
```
- Fetches reports from Redux async thunk
- Uses `projectId` + `reportType` as query parameters
- **NO user filter in the query**

---

## 3. GraphQL Queries Structure

### File: `src/graphql/queries/reports.ts`

**GET_PROJECT_REPORTS (lines 3-28):**
```graphql
query GetProjectReports($projectId: ID!, $reportType: String) {
  reports(projectId: $projectId, reportType: $reportType) {
    id, reportType, reportDate, planId, periodStartDate, periodEndDate
    totalTasks, completedTasks, delayedTasks, onScheduleTasks
    newStartedTasks, unassignedResources, totalBugs, [bug severity metrics]
    summary, createdAt, updatedAt
  }
}
```

**GET_REPORT_DETAIL (lines 30-83):**
- Includes nested `tasks[]` array with task details (assignee, dates, status, delay info)
- Includes nested `bugs[]` array with bug details (severity, status, assignee)
- **No userId filter parameter in either query**

---

## 4. User Filtering Analysis

### Current User Filter Status: **NOT IMPLEMENTED**

**Evidence:**
1. **ReportView.tsx line 25:** Redux selector gets ALL members from state
   ```typescript
   const { members } = useAppSelector(state => state.members);
   ```

2. **reportsSlice.ts line 90:** Query parameters = `{ projectId, reportType }` only
   - Missing `userId` or `currentUser` parameter

3. **GraphQL query:** No `userId` filter in reports resolver
   - Backend likely returns all project reports

**Result:** Reports show metrics for ALL project members, not filtered by current user.

---

## 5. Member Role Definitions

### File: `src/types/members.ts`

**Member Role Type (line 1):**
```typescript
export type MemberRole = 'Admin' | 'Member' | 'Viewer';
```

**Member Interface (lines 11-17):**
```typescript
interface Member {
  memberId: string;
  userId: string;
  role: MemberRole;        // Admin | Member | Viewer
  joinedAt: string;
  user: UserInfo;           // nested user details
}
```

**UserInfo Structure (lines 3-9):**
```typescript
interface UserInfo {
  userId: string;
  email: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
}
```

---

## 6. ProjectReportView Component

### File: `src/components/reports/ProjectReportView.tsx` (lines 1-100)

**Supported Report Tabs:**
- `overview` - Summary charts
- `daily` - Daily reports with "yesterday" / "today" subtabs (lines 8-9)
- `weekly`, `monthly`, `quarterly` - Period reports
- `bugs` - Bug analysis
- `plan-vs-actual` - Schedule variance

**Schedule Status Determination (lines 22-68):**
- Compares planned vs actual dates
- Status categories: `on-schedule`, `late`, `unknown`
- Depends on plan data from Redux state (`activePlan`)

**Data Sources (lines 76-77):**
```typescript
const { tasks } = useAppSelector(state => state.tasks);
const { plans, activePlan } = useAppSelector(state => state.plans);
```

---

## Issues Identified

| Priority | Issue | Location | Impact |
|----------|-------|----------|--------|
| **HIGH** | No current user filter in report queries | reportsSlice.ts:90, queries/reports.ts | Reports show all team data, no personal view |
| **HIGH** | Daily report metrics not date-filtered | ReportView.tsx:36-55 | Aggregates ALL matching tasks, not "today" only |
| **MEDIUM** | Backend report generation not queried | Both files | Client manually calculates, state can drift |
| **MEDIUM** | "Tasks yesterday" logic fragile | ReportView.tsx:57-61 | Uses `actual_start_date`, should use `actual_end_date` for completion |
| **LOW** | Bug metrics hardcoded to 0 | ReportView.tsx:84-87 | Placeholder, no actual bug tracking |

---

## Type References Summary

**Report Definition:** `src/redux/features/reportsSlice.ts` lines 44-67
**ReportType Options:** `src/redux/features/reportsSlice.ts` line 6
**MemberRole Options:** `src/types/members.ts` line 1
**GraphQL Queries:** `src/graphql/queries/reports.ts` lines 3-84

---

## Unresolved Questions

1. **Backend Scope:** Does backend `reports()` resolver accept `userId` parameter? Need to check backend schema.
2. **Report Storage:** Are reports pre-generated and stored, or calculated on-the-fly by backend?
3. **Bug Tracking:** Is bug system implemented? Currently hardcoded to 0.
4. **Performance:** Any pagination/caching for large reports?

---

**Report Generated:** 2026-03-25
**Analyst:** Researcher Agent
