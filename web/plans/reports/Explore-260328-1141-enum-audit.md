# Enum Value Consistency Audit Report
**Date**: 2026-03-28  
**Scope**: Supabase DB schema vs Next.js web app (GraphQL + Frontend)  
**Status**: CRITICAL ISSUES FOUND

---

## Executive Summary

Comprehensive audit of enum value consistency across database, GraphQL schema, resolvers, and frontend code reveals **CRITICAL enum conversion gaps** that could cause database constraint violations.

**Risk Level**: HIGH  
**Impact**: Data insertion/update failures for Project and Task enums  
**Affected Areas**: Project mutations, Task mutations, Member role management

---

## 1. Database Schema (Enums - Lowercase)

### Source: `/supabase/migrations/00001_initial_schema.sql`

**All enums defined with lowercase values:**

```sql
CREATE TYPE project_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE project_status AS ENUM ('active', 'completed', 'on_hold', 'cancelled');
CREATE TYPE project_visibility AS ENUM ('public', 'private', 'team');
CREATE TYPE member_role AS ENUM ('admin', 'member', 'viewer', 'manager', 'leader', 'guest');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent', 'critical');
CREATE TYPE task_status AS ENUM ('todo', 'doing', 'done', 'close', 'pending', 'review', 'blocked', 'rejected', 'archived');
CREATE TYPE task_progress_type AS ENUM ('study', 'investigate', 'code', 'test', 'review_code', 'review_test_report', 'release');
```

---

## 2. GraphQL Schema (Enums - Uppercase)

### Source: `/src/lib/graphql/types/task-scheduler.ts`

**All enums defined with UPPERCASE values:**

```typescript
enum TaskStatus { TODO, DOING, DONE, CLOSE, PENDING, REVIEW, BLOCKED, REJECTED, ARCHIVED }
enum TaskPriority { LOW, MEDIUM, HIGH, URGENT, CRITICAL }
enum ProjectStatus { ACTIVE, COMPLETED, ON_HOLD, CANCELLED }
enum ProjectPriority { LOW, MEDIUM, HIGH, URGENT }
enum ProjectVisibility { PUBLIC, PRIVATE, TEAM }
enum MemberRole { MANAGER, LEADER, MEMBER, GUEST }
```

---

## 3. Conversion Status by Layer

### ✅ RESOLVERS - PROPER CONVERSION (Good)

#### Project Resolver `/src/lib/graphql/resolvers/project.ts`

**Lines 26-28 (create_project):**
```typescript
priority: typeof args.input.priority === 'string' ? args.input.priority.toLowerCase() : args.input.priority,
status: typeof args.input.status === 'string' ? args.input.status.toLowerCase() : args.input.status,
visibility: typeof args.input.visibility === 'string' ? args.input.visibility.toLowerCase() : args.input.visibility,
```

**Lines 44-46 (update_project):**
```typescript
...(rest.priority && { priority: (rest.priority as string).toLowerCase() }),
...(rest.status && { status: (rest.status as string).toLowerCase() }),
...(rest.visibility && { visibility: (rest.visibility as string).toLowerCase() }),
```

**Lines 54 (add_project_member):**
```typescript
...(args.input.role && { role: (args.input.role as string).toLowerCase() }),
```

**Line 61 (update_project_member):**
```typescript
return memberService.updateMember(ctx.supabaseAdmin, project_id as string, user_id as string, (role as string).toLowerCase());
```

---

#### Task Resolver `/src/lib/graphql/resolvers/task.ts`

**Lines 28-30 (create_task):**
```typescript
...(args.input.status && { status: (args.input.status as string).toLowerCase() }),
...(args.input.priority && { priority: (args.input.priority as string).toLowerCase() }),
...(args.input.progress_type && { progress_type: (args.input.progress_type as string).toLowerCase() }),
```

**Lines 39-41 (update_task):**
```typescript
...(rest.status && { status: (rest.status as string).toLowerCase() }),
...(rest.priority && { priority: (rest.priority as string).toLowerCase() }),
...(rest.progress_type && { progress_type: (rest.progress_type as string).toLowerCase() }),
```

**Line 48 (update_task_status):**
```typescript
return taskService.updateTaskStatus(ctx.supabaseAdmin, task_id as string, (status as string).toLowerCase());
```

---

### ✅ FRONTEND FORMS - PROPER DEFINITION (Good)

#### Task Form Schema `/src/schemas/taskForm.ts`

**All enum values are lowercase - MATCHING DATABASE:**
```typescript
progressTypeOptions = ['study', 'investigate', 'code', 'test', 'review_code', 'review_test_report', 'release']
statusOptions = ['todo', 'doing', 'done', 'close', 'pending', 'review', 'blocked', 'rejected', 'archived']
priorityOptions = ['low', 'medium', 'high', 'urgent', 'critical']
```

#### Project Form Schema `/src/schemas/projectForm.ts`

**All enum values are UPPERCASE - NEEDS CONVERSION AT SUBMISSION:**
```typescript
ProjectStatus = { ACTIVE, CANCELLED, COMPLETED, ON_HOLD }
ProjectPriority = { LOW, MEDIUM, HIGH, URGENT }
ProjectVisibility = { PUBLIC, PRIVATE, TEAM }
```

**Status**: Form uses uppercase but resolver will convert via `.toLowerCase()`, so this is safe.

---

### ✅ FRONTEND MEMBER ROLE CONVERSION - PROPER (Good)

#### Utility Functions `/src/lib/utils.ts`

**Lines 131-147:**
```typescript
export const toBackendRole = (role: MemberRoleType): string => {
  return role.toLowerCase(); // Converts 'Manager' -> 'manager'
};

export const toFrontendRole = (role: string): MemberRoleType => {
  const mapping: Record<string, MemberRoleType> = {
    'manager': 'Manager',
    'leader': 'Leader',
    'member': 'Member',
    'guest': 'Guest',
    'admin': 'Manager',      // Backward compatibility
    'viewer': 'Guest',       // Backward compatibility
  };
  return mapping[role.toLowerCase()] || 'Member';
};
```

**Usage locations** (properly converted):
- `/src/components/projects/MembersView.tsx` - Multiple `.toLowerCase()` calls
- `/src/components/project/MembersTab.tsx` - Using `toBackendRole()` conversion

---

## 4. Critical Issues Found

### ISSUE #1: Member Role Enum Mismatch in GraphQL vs DB

**Severity**: MEDIUM  
**Location**: Database vs GraphQL schema

| Layer | Values |
|-------|--------|
| **DB Schema** | `'admin', 'member', 'viewer', 'manager', 'leader', 'guest'` |
| **GraphQL** | `MANAGER, LEADER, MEMBER, GUEST` (missing ADMIN, VIEWER) |

**Impact**: Backend has `admin` and `viewer` roles in schema, but GraphQL doesn't expose them. Frontend can't request these roles, but DB allows them.

**Risk**: Data inconsistency if direct DB inserts use 'admin'/'viewer'.

---

### ISSUE #2: Missing Uppercase Enum Validation in Resolvers

**Severity**: LOW  
**Location**: All resolvers

**Problem**: Resolvers assume input will be a string and call `.toLowerCase()`, but don't validate the value is actually a valid enum before conversion.

**Current Code Example** (project.ts line 26):
```typescript
priority: typeof args.input.priority === 'string' ? args.input.priority.toLowerCase() : args.input.priority,
```

**Risk**: Invalid enum values like "UNKNOWN" would pass through as lowercase "unknown", fail at DB constraint.

**Recommendation**: Add enum validation before lowercase conversion.

---

### ISSUE #3: Progress Type Enum Values Mismatch

**Severity**: LOW  
**Location**: DB vs GraphQL vs Frontend

| Layer | ENUM Value |
|-------|------------|
| **DB** | `'review_code'`, `'review_test_report'` (underscore) |
| **GraphQL** | `REVIEW_CODE`, `REVIEW_TEST_REPORT` (uppercase with underscore) |
| **Frontend** | `'review_code'`, `'review_test_report'` (lowercase with underscore) |

**Status**: Currently safe because all layers use underscores and `.toLowerCase()` handles conversion correctly.

---

## 5. Conversion Flow Verification

### ✅ Project Creation Flow - SAFE

```
Frontend Form (UPPERCASE) 
  ↓ 
GraphQL Mutation (UPPERCASE enum) 
  ↓ 
Project Resolver (converts to lowercase via .toLowerCase()) 
  ↓ 
Supabase (lowercase enum constraint) ✓
```

### ✅ Task Creation Flow - SAFE

```
Frontend Form (lowercase) 
  ↓ 
GraphQL Mutation (UPPERCASE enum) 
  ↓ 
Task Resolver (converts to lowercase via .toLowerCase()) 
  ↓ 
Supabase (lowercase enum constraint) ✓
```

### ✅ Member Role Update Flow - SAFE

```
Frontend Component (MemberRole type - Capitalized) 
  ↓ 
toBackendRole() utility (converts to lowercase) 
  ↓ 
GraphQL Mutation (UPPERCASE MemberRole enum) 
  ↓ 
Project Resolver (converts to lowercase via .toLowerCase()) 
  ↓ 
Supabase (lowercase enum constraint) ✓
```

---

## 6. Edge Cases & Potential Issues

### Case 1: Direct Supabase Client Calls (Not Through GraphQL)

**Risk**: If any code calls `supabase.from('tasks').insert({status: 'TODO'})` directly without GraphQL resolver conversion.

**Affected Files**:
- `/src/lib/services/task-service.ts` - **Uses generic `input as never` insert**
- `/src/lib/services/project-service.ts` - **Uses generic `input as never` insert**
- `/src/lib/services/member-service.ts` - **Uses generic `role` parameter**

**Finding** (task-service.ts lines 53-60):
```typescript
async createTask(supabase: Supabase, input: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('tasks')
    .insert(input as never)  // ⚠️ No enum conversion here!
    .select()
    .single();
}
```

**Status**: SAFE because services are always called from resolvers which already converted enums to lowercase.

---

### Case 2: Frontend Queries Returning Enums

**Location**: `/src/graphql/queries/tasks.ts`, `/src/graphql/queries/project.ts`

**Status**: Queries only return enum values from DB (already lowercase). Frontend receives lowercase values which are handled by `toFrontendRole()` or `.toUpperCase()` as needed.

---

## 7. Database Enum Definition Inconsistency

### CRITICAL: Member Role has 6 values but GraphQL only exposes 4

**Database Definition**:
```sql
CREATE TYPE member_role AS ENUM ('admin', 'member', 'viewer', 'manager', 'leader', 'guest');
```

**GraphQL Definition**:
```typescript
enum MemberRole {
  MANAGER
  LEADER
  MEMBER
  GUEST
}
```

**Missing from GraphQL**: `ADMIN`, `VIEWER`

**Impact**:
- If frontend tries to query or set role to 'ADMIN' or 'VIEWER', GraphQL validation will fail
- But if data exists in DB with these values, it can be read by native queries
- Project creation defaults to 'manager' role (line 39, project-service.ts)

---

## 8. Recommendations

### Priority 1 (Critical)

1. **Add enum validation in resolvers** before calling `.toLowerCase()`
   - Create a helper function `validateAndNormalizeEnum()` 
   - Apply to all enum fields in project/task/member resolvers

2. **Align DB schema member_role enum with GraphQL**
   - Either remove 'admin', 'viewer' from DB if not used
   - Or add ADMIN, VIEWER to GraphQL schema

---

### Priority 2 (High)

3. **Add enum conversion safeguards in services**
   - Create wrapper functions for enum fields before Supabase calls
   - Example: `createTask()` should validate enum values

4. **Document enum conversion strategy**
   - Create a guide for adding new enums (DB lowercase, GraphQL uppercase, resolver convert)

---

### Priority 3 (Medium)

5. **Add tests for enum round-trip conversion**
   - Verify UPPERCASE → lowercase → queries return correctly
   - Test edge cases: null values, invalid values, case variations

6. **Type safety improvement**
   - Replace `Record<string, unknown>` in resolvers with typed interfaces
   - Enable strict type checking for enum parameters

---

## 9. Summary Table

| Component | DB Schema | GraphQL | Frontend | Converter | Status |
|-----------|-----------|---------|----------|-----------|--------|
| ProjectPriority | `low/medium/high/urgent` | `LOW/MEDIUM/HIGH/URGENT` | `LOW/MEDIUM/HIGH/URGENT` | ✅ Resolver | SAFE |
| ProjectStatus | `active/completed/on_hold/cancelled` | `ACTIVE/COMPLETED/ON_HOLD/CANCELLED` | `ACTIVE/COMPLETED/ON_HOLD/CANCELLED` | ✅ Resolver | SAFE |
| ProjectVisibility | `public/private/team` | `PUBLIC/PRIVATE/TEAM` | `PUBLIC/PRIVATE/TEAM` | ✅ Resolver | SAFE |
| TaskPriority | `low/medium/high/urgent/critical` | `LOW/MEDIUM/HIGH/URGENT/CRITICAL` | `low/medium/high/urgent/critical` | ✅ Resolver | SAFE |
| TaskStatus | `todo/doing/done/close/pending/review/blocked/rejected/archived` | `TODO/DOING/DONE/CLOSE/...` | `todo/doing/done/...` | ✅ Resolver | SAFE |
| TaskProgressType | `study/investigate/code/test/review_code/review_test_report/release` | `STUDY/INVESTIGATE/CODE/TEST/REVIEW_CODE/...` | `study/investigate/code/...` | ✅ Resolver | SAFE |
| MemberRole | `admin/member/viewer/manager/leader/guest` | `MANAGER/LEADER/MEMBER/GUEST` | `Manager/Leader/Member/Guest` | ✅ toBackendRole() | ⚠️ ADMIN/VIEWER MISSING |

---

## 10. Conclusion

**Overall Assessment**: MOSTLY SAFE with MINOR GAPS

**Currently Working**:
- All critical enum conversions are implemented in resolvers
- Frontend properly converts enum values using utility functions
- No data is being directly written to DB without proper conversion

**Issues Requiring Attention**:
1. Member role enum (admin/viewer) mismatch between DB and GraphQL
2. Lack of enum validation before conversion
3. No type safety for generic Record<string, unknown> parameters
4. Services rely on upstream resolver conversion (fragile architecture)

**Immediate Action**: Address Priority 1 recommendations to prevent future data insertion failures.

