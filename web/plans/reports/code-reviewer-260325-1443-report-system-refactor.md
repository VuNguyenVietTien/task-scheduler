# Code Review: Report System Refactor

**Branch:** feat/v2.29
**Date:** 2026-03-25
**Reviewer:** code-reviewer
**Scope:** Backend report columns + role migration + frontend report modularization

---

## Code Review Summary

### Scope
- Files reviewed: 22 (7 backend, 15 frontend)
- LOC changed: ~800 (estimated from diffs)
- Focus: Role enum migration, report columns, frontend report components

### Overall Assessment

The report modularization (frontend) is well-structured with clean component separation. However, the role migration has a **critical incomplete backend migration** that will cause runtime failures. Several medium-priority logic issues exist in the report calculation code.

---

## Critical Issues

### 1. [CRITICAL] Backend `members/types.rs` NOT migrated - will break bulk role updates

**File:** `task-scheduler-backend/src/graphql/resolvers/members/types.rs`

The `MemberRole` enum in the members resolver types still uses `Admin/Member/Viewer`, while:
- The GraphQL `MemberRole` in `types/project.rs` was updated to `Manager/Leader/Member/Guest`
- The DB migration added `manager`, `leader`, `guest` to the `member_role` PostgreSQL enum
- The migration reset all roles to `member`

The `bulk_update.rs` resolver maps `MemberRole::Admin -> "admin"`, `MemberRole::Viewer -> "viewer"`. After migration, the DB enum may no longer accept `"admin"` or `"viewer"` as valid values (they were not removed from the PG enum, but the Rust code still references the OLD enum variants).

**Impact:** Bulk role updates will write old role values. The `ProjectMemberRole` GraphQL type still exposes `admin/member/viewer` instead of `manager/leader/member/guest`. Frontend sends new role names but this resolver expects old ones.

**Fix required:**
- Update `members/types.rs` enum to `Manager/Leader/Member/Guest`
- Update `bulk_update.rs` role_string mapping
- Update the admin check SQL query (line 31: `AND role = 'admin'`) to also check `'manager'`

### 2. [CRITICAL] Backend `db/types.rs` NOT migrated - `MemberRole` still has `Owner/Admin/Member`

**File:** `task-scheduler-backend/src/db/types.rs`

This file defines `MemberRole { Owner, Admin, Member }` with `FromStr` and `AsRef<str>` impls mapping to `"owner"/"admin"/"member"`. This is used in some queries (e.g., `my_role.rs` line 40: `row.get::<MemberRole, _>("role")`).

After migration resets all roles to `"member"`, the `my_project_role` query will work initially. But when users are assigned `"manager"` or `"leader"` roles, `sqlx` will fail to deserialize these new values into the old `MemberRole` enum.

**Impact:** Runtime panic or GraphQL error when querying roles for users with manager/leader/guest roles.

**Fix required:** Update enum to `Manager/Leader/Member/Guest` with backward-compat parsing.

### 3. [CRITICAL] Two competing `MemberRole` enums in backend

There are now THREE `MemberRole` definitions:
1. `db/types.rs` -- `Owner/Admin/Member` (STALE)
2. `graphql/types/project.rs` -- `Manager/Leader/Member/Guest` (UPDATED)
3. `graphql/resolvers/members/types.rs` -- `Admin/Member/Viewer` (STALE)

Imports vary by file. This will cause type mismatches and incorrect serialization depending on which enum a given query/resolver references.

---

## High Priority

### 4. [HIGH] Migration does not remove old enum values from PostgreSQL

**File:** `migrations/20260325000000_report_system_refactor.sql`

The migration adds `manager/leader/guest` to the `member_role` enum and resets all roles to `member`. However, it does NOT remove or remap `admin/viewer/owner`. PostgreSQL does not support `ALTER TYPE ... DROP VALUE`, so the old values remain valid in the DB enum.

This means:
- Old values can still be written to the DB (no constraint violation)
- The stale backend code (items 1-3) will silently write old values
- Mixed old/new values in the DB will cause inconsistent behavior

**Recommendation:** Since PG cannot drop enum values, add a CHECK constraint or use a trigger to reject old values. Alternatively, ensure ALL backend code paths are updated (which is currently not the case).

### 5. [HIGH] `bulk_update.rs` admin permission check uses hardcoded `role = 'admin'`

**File:** `task-scheduler-backend/src/graphql/resolvers/members/mutation/bulk_update.rs` (line 31)

```sql
WHERE project_id = $1 AND user_id = $2 AND role = 'admin'
```

After migration, all roles are reset to `'member'`. No one will have `role = 'admin'`, so NO user can perform bulk role updates until someone is manually assigned a new privileged role. Even then, the check should be `role IN ('manager', 'leader')` per the new role hierarchy.

**Impact:** Complete lockout from bulk role management after migration.

### 6. [HIGH] `MemberRoleSelect.tsx` previously used `'ADMIN'` uppercase, now uses mixed case

**File:** `task-scheduler-frontend/src/components/project/MemberRoleSelect.tsx`

The old code had `['ADMIN', 'MEMBER', 'VIEWER']` (uppercase). The new code has `['Manager', 'Leader', 'Member', 'Guest']` (PascalCase). The `MemberRole` type from `members.ts` is `'Manager' | 'Leader' | 'Member' | 'Guest'` (PascalCase), so this is now consistent. However, the old value `'ADMIN'` suggests there may be other places using uppercase that were missed.

### 7. [HIGH] `PeriodReportView` date state does not reset when `reportType` changes

**File:** `task-scheduler-frontend/src/components/reports/period-report-view.tsx`

`getDefaultRange(reportType)` is called once during initial render via `useState`. When user switches between weekly/monthly/quarterly, the date range stays at the initial value (e.g., 7 days for weekly even after switching to quarterly).

**Fix:** Add `useEffect` to reset `startDate`/`endDate` when `reportType` changes.

---

## Medium Priority

### 8. [MED] `ReportView.tsx` dispatches `generateDailyReport` without checking dispatch result

**File:** `task-scheduler-frontend/src/components/reports/ReportView.tsx` (line 60)

`saveReport` uses `await dispatch(createReport(...))` but wraps it in try/catch. The issue is that `createAsyncThunk` rejections are not thrown by default -- they resolve with a rejected action. The catch block will never fire for API errors.

**Fix:** Check `result.meta.requestStatus === 'rejected'` or use `unwrapResult`.

### 9. [MED] `useDailyReportData` counts ALL project tasks, not filtered by plan

**File:** `task-scheduler-frontend/src/components/reports/daily-report-view.tsx`

The hook reads `state.tasks` which contains all tasks for the selected project. When a plan is selected in `ReportView.tsx`, the daily report still shows metrics for ALL tasks, not just plan tasks. The `selectedPlanId` is passed to `saveReport` but not to `DailyReportView`.

### 10. [MED] `toFrontendRole` silently defaults to `'Member'` for unknown roles

**File:** `task-scheduler-frontend/src/lib/utils.ts` (line 147)

Unknown role strings silently become `'Member'`. This hides bugs where the backend returns unexpected role values. Consider logging a warning.

### 11. [MED] `MembersTab.tsx` stores `localStorage.getItem('userRole')` check with old values

**File:** `task-scheduler-frontend/src/components/project/MembersTab.tsx` (line 415)

```ts
localStorage.getItem('userRole') === 'Admin' || localStorage.getItem('userRole') === 'SuperAdmin'
```

If `localStorage` still has `'Admin'`, this works. But if the app starts writing `'Manager'` to localStorage, this check breaks. Should include `'Manager'` in the check.

### 12. [MED] Duplicate `isSameDay` function

**Files:** `daily-report-view.tsx` (line 18), `period-report-view.tsx` (line 37), `lib/utils.ts` (already has `isSameDay`)

DRY violation. Both report files define their own `isSameDay` while `lib/utils.ts` already exports one.

### 13. [MED] `activeTasksTable` hardcodes progress percentages

**File:** `task-scheduler-frontend/src/components/reports/active-tasks-table.tsx` (line 45)

Progress is hardcoded: `review = 90%`, else `50%`. This is misleading and not based on actual task data.

---

## Low Priority

### 14. [LOW] Console.log statements left in `ProjectDetailView.tsx`

Lines 267-270 have debug logging that should be removed before merge.

### 15. [LOW] Missing `eslint-disable` justification

`ProjectDetailView.tsx` line with `// eslint-disable-line react-hooks/exhaustive-deps` -- the comment explains the reasoning which is good, but `activeView` is excluded from deps which could cause stale closures in edge cases.

### 16. [LOW] Vietnamese text not localized via i18n

All UI strings are hardcoded in Vietnamese. Not a blocker but prevents future localization.

---

## Edge Cases Found

1. **Race condition in ReportView:** If `activePlan` loads after `fetchProjectReports`, the plan filter is not applied to already-fetched reports
2. **Empty tasks array:** `useDailyReportData` returns `totalTasks: 0` which triggers the `totalTasks > 0` guard in ReportView line 41, so daily report never generates for empty projects -- correct behavior but no user feedback
3. **Date boundary:** `isSameDay` comparisons use local timezone via `new Date()` but `reportDate` is ISO string. Timezone differences could cause off-by-one day errors for users in UTC+ timezones
4. **Plan with no tasks:** If `selectedPlan.planData.tasks` is undefined, `planTasks` defaults to `[]`, so plan comparison in period report shows "N/A" for all variance -- acceptable degradation

---

## Positive Observations

- Clean component decomposition: metrics card, delayed/active/completed tables are well-separated
- Backward compatibility mapping in `toFrontendRole` and `normalizeRole` is thoughtful
- `MemberRole.from_str_case_insensitive` in backend handles both old and new values
- Date range validation in `PeriodReportView` prevents absurd ranges (max 365 days)
- Bug counting via task type instead of separate CRUD is pragmatic (KISS)

---

## Recommended Actions (Priority Order)

1. **[MUST]** Update `task-scheduler-backend/src/db/types.rs` MemberRole enum to Manager/Leader/Member/Guest
2. **[MUST]** Update `task-scheduler-backend/src/graphql/resolvers/members/types.rs` MemberRole enum to Manager/Leader/Member/Guest
3. **[MUST]** Update `task-scheduler-backend/src/graphql/resolvers/members/mutation/bulk_update.rs` role_string mapping and admin check SQL
4. **[SHOULD]** Add `useEffect` in `PeriodReportView` to reset dates when reportType changes
5. **[SHOULD]** Use `unwrapResult` in `saveReport` for proper error handling
6. **[SHOULD]** Extract duplicate `isSameDay` to shared utility
7. **[COULD]** Add `'Manager'` to localStorage check in `MembersTab.tsx`
8. **[COULD]** Remove console.log from `ProjectDetailView.tsx`

---

## Metrics

- Type Coverage: Good (TypeScript types aligned with new roles)
- Test Coverage: Unknown (no new tests for report components)
- Linting Issues: 1 eslint-disable, multiple console.logs
- Build status: `cargo check` and `tsc --noEmit` pass (per plan notes) -- but this does NOT catch the runtime enum mismatch since the stale enums compile fine

---

## Unresolved Questions

1. Was the `project_role` enum in `enums.rs` (used for a different purpose than `member_role`) intentionally changed to remove `Owner`? What code uses `ProjectRole`?
2. Should the migration include a DOWN migration for rollback safety?
3. Are there any other SQL queries (outside the reviewed files) that hardcode `role = 'admin'` or `role = 'viewer'`?
4. Is there a plan to write tests for the new report components?
