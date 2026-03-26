---
phase: 02
title: "Role System Update"
status: complete
priority: P1
effort: 4h
execution_order: 2
depends_on: [phase-05]
---

# Phase 02 - Role System Update

## Context Links
- Backend enum: `task-scheduler-backend/src/db/enums.rs` (lines 37-44)
- Frontend type: `task-scheduler-frontend/src/types/members.ts` (line 1)
- Role badge: `task-scheduler-frontend/src/components/project/RoleBadge.tsx`
- Role select: `task-scheduler-frontend/src/components/project/MemberRoleSelect.tsx`
- Members slice: `task-scheduler-frontend/src/redux/features/membersSlice.ts`
- GraphQL members: `task-scheduler-frontend/src/graphql/mutations/projectMember.ts`
- Backend resolvers: `task-scheduler-backend/src/graphql/resolvers/members/`

## Overview
Change role system from `{Owner,Manager,Editor,Viewer}` (backend) / `{Admin,Member,Viewer}` (frontend) to unified `{manager,leader,member,guest}`. Guest = view-only, cannot be assigned tasks.

## Key Insights
- Frontend and backend role names are ALREADY mismatched (Admin vs Owner, Member vs Editor)
- 12 backend files reference `ProjectRole` or `project_role`
- Frontend has `MemberRoleSelect.tsx` and `RoleBadge.tsx` with hardcoded role logic
- Task assignment must check role != guest before allowing assignee

## Requirements
**Functional:**
- New roles: `manager` (full control), `leader` (manage tasks/members), `member` (work on tasks), `guest` (view-only)
- Guest cannot be assigned tasks or create/edit tasks
- Manager/Leader can manage members
- All roles visible in member list with proper badge colors

**Non-functional:**
- Role mapping must be consistent across frontend<->backend<->DB

## Architecture
```
Role Mapping:
  Old Backend    -> New
  Owner          -> Manager
  Manager        -> Leader
  Editor         -> Member
  Viewer         -> Guest

  Old Frontend   -> New
  Admin          -> Manager
  Member         -> Member (keep)
  Viewer         -> Guest
```

## Related Code Files
**Backend - Modify:**
- `src/db/enums.rs` - ProjectRole enum (done in phase-05 migration)
- `src/graphql/resolvers/members/types.rs` - GraphQL member types
- `src/graphql/resolvers/members/query/my_role.rs` - role query
- `src/graphql/resolvers/members/mutation/bulk_update.rs` - role update
- `src/graphql/types/project.rs` - project role type
- `src/db/queries/member.rs` - member queries

**Frontend - Modify:**
- `src/types/members.ts` - MemberRole type
- `src/components/project/RoleBadge.tsx` - role badge colors
- `src/components/project/MemberRoleSelect.tsx` - role dropdown
- `src/redux/features/membersSlice.ts` - state management
- `src/graphql/mutations/projectMember.ts` - GraphQL mutations
- `src/lib/utils.ts` - role utility functions
- `src/hooks/useProject.ts` - role checks

## Implementation Steps
1. **Backend:** Update `ProjectRole` enum in `enums.rs` (if not done in phase-05)
2. **Backend:** Update GraphQL member types to expose new role names
3. **Backend:** Update all role check logic (grep `ProjectRole::Owner` etc.)
4. **Backend:** Add `can_be_assigned` helper: returns false for Guest
5. **Frontend:** Update `MemberRole` type: `'Manager' | 'Leader' | 'Member' | 'Guest'`
6. **Frontend:** Update `RoleBadge.tsx` with new role names/colors
7. **Frontend:** Update `MemberRoleSelect.tsx` dropdown options
8. **Frontend:** Update all role checks in hooks/utils
9. **Frontend:** Add assignee filter: exclude Guest members from task assignment dropdowns
10. Verify compilation on both sides

## Todo List
- [x] Backend: Update enum + all resolvers
- [x] Backend: Add can_be_assigned helper
- [x] Frontend: Update MemberRole type
- [x] Frontend: Update RoleBadge component
- [x] Frontend: Update MemberRoleSelect component
- [x] Frontend: Filter guests from assignee dropdowns
- [x] Frontend: Update role checks in hooks/utils
- [x] Integration test: role CRUD through GraphQL

## Success Criteria
- Role dropdown shows Manager/Leader/Member/Guest
- Guest members cannot be assigned tasks
- Existing members reset to 'member' role during migration (simple UPDATE, re-assign manually after)
<!-- Updated: Validation Session 1 - Reset all roles to member instead of mapping -->
- Both `cargo build` and `npm run build` pass

## Risk Assessment
- **HIGH:** Role mismatch between frontend/backend during deployment - deploy backend first
- **MEDIUM:** Existing role checks may miss new roles - grep thoroughly

## Security Considerations
- Guest must not bypass view-only restriction via direct API calls
- Role escalation prevention: only Manager can change roles
