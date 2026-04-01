# Members Tab & Role System Exploration Report

**Date**: April 1, 2026  
**Focus**: Members tab UI, member roles, invitations, and backend API

---

## 1. FRONTEND MEMBER UI COMPONENTS

### Primary Components

#### MembersTab Component
**File**: `/Users/TienVNV/Desktop/ProjectManager/frontend/src/components/project/MembersTab.tsx`
- **Purpose**: Main member list and management interface for projects
- **Type**: React FC with Redux integration
- **Key Functions**:
  - `handleAddMember`: Add member via email with role selection
  - `handleRemoveMember`: Remove single member
  - `handleRemoveMultipleMembers`: Bulk remove members
  - `handleUpdateMemberRole`: Update single member's role
  - `handleBulkUpdateRole`: Bulk update member roles
  - `handleSaveBulkChanges`: Save temporary pending role changes
  - `handleTempRoleChange`: Track temporary role changes before save

- **Features**:
  - Table-based UI with Material-UI components
  - Checkbox selection for bulk operations
  - Real-time role change dropdowns with visual feedback
  - Pending changes tracking (highlighted with green background)
  - Three action modes: Save bulk, Bulk edit, Bulk delete
  - Permission-based UI (shows actions only for Manager/Leader)
  - User avatar display with fallback initials
  - Vietnamese date formatting

#### MembersView Component
**File**: `/Users/TienVNV/Desktop/ProjectManager/frontend/src/components/projects/MembersView.tsx`
- **Alternative implementation** for projects dashboard
- **Type**: Standalone React FC with Redux + Apollo Client
- **Key Features**:
  - Quick-add form (email input + add button)
  - Edit mode toggle for batch role changes
  - Member table with avatar thumbnails
  - Permission-based action visibility
  - Handles both direct role updates and edit mode with save

#### RoleBadge Component
**File**: `/Users/TienVNV/Desktop/ProjectManager/frontend/src/components/project/RoleBadge.tsx`
- **Purpose**: Displays role with color-coded badge and icon
- **Props**: `role: MemberRole`, optional `className`
- **Color Scheme**:
  - Manager: Red badge (👑 icon)
  - Leader: Purple badge (⭐ icon)
  - Member: Blue badge (👤 icon)
  - Guest: Gray badge (👁️ icon)

#### MemberRoleSelect Component
**File**: `/Users/TienVNV/Desktop/ProjectManager/frontend/src/components/project/MemberRoleSelect.tsx`
- **Purpose**: Dropdown selector for role changes with permission tooltips
- **Features**: Shows available permissions for each role on hover

---

## 2. MEMBER ROLE SYSTEM

### Role Types (Frontend)
**File**: `/Users/TienVNV/Desktop/ProjectManager/frontend/src/types/members.ts`

```typescript
type MemberRole = 'Manager' | 'Leader' | 'Member' | 'Guest';
```

### Role Types (Backend)
**File**: `/Users/TienVNV/Desktop/ProjectManager/backend/src/graphql/resolvers/members/types.rs`

```rust
pub enum MemberRole {
    Manager,    // Admin/Owner level
    Leader,     // Senior member
    Member,     // Standard member
    Guest,      // Viewer role (read-only)
}
```

**Backend Parsing Logic** (case-insensitive mapping):
- "manager" | "admin" | "owner" → Manager
- "leader" → Leader
- "member" → Member
- "guest" | "viewer" → Guest

### Role Permissions
**File**: `/Users/TienVNV/Desktop/ProjectManager/frontend/src/types/project.ts` (lines 84-113)

| Role | Permissions |
|------|------------|
| **Manager** | Quản lý thành viên, Thay đổi vai trò, Chỉnh sửa dự án, Xem thông tin, Tạo và quản lý công việc |
| **Leader** | Quản lý công việc, Quản lý thành viên, Xem thông tin, Cập nhật tiến độ |
| **Member** | Xem thông tin, Tạo và chỉnh sửa công việc, Cập nhật tiến độ |
| **Guest** | Xem thông tin |

### Role Conversion Utilities
**File**: `/Users/TienVNV/Desktop/ProjectManager/frontend/src/lib/utils.ts` (lines 131-147)

```typescript
// Frontend to Backend (lowercase)
export const toBackendRole = (role: MemberRoleType): string => {
  return role.toLowerCase();
};

// Backend to Frontend (capitalize)
export const toFrontendRole = (role: string): MemberRoleType => {
  const mapping = {
    'manager': 'Manager',
    'leader': 'Leader',
    'member': 'Member',
    'guest': 'Guest',
    'admin': 'Manager',      // backward compat
    'viewer': 'Guest',        // backward compat
  };
  return mapping[role.toLowerCase()] || 'Member';
};
```

---

## 3. DATA TYPES & INTERFACES

### Frontend Member Types
**File**: `/Users/TienVNV/Desktop/ProjectManager/frontend/src/types/members.ts`

```typescript
interface UserInfo {
  userId: string;
  email: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
}

interface Member {
  memberId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
  user: UserInfo;
}

interface MemberRoleUpdate {
  userId: string;
  role: MemberRole;
}

interface BulkUpdateResult {
  successCount: number;
  members: {
    user: UserInfo;
    role: MemberRole;
    joinedAt: string;
  }[];
}
```

### Backend Member Types
**File**: `/Users/TienVNV/Desktop/ProjectManager/backend/src/graphql/resolvers/members/types.rs`

```rust
pub struct ProjectMember {
    pub member_id: String,
    pub project_id: String,
    pub user_id: String,
    pub role: MemberRole,
    pub joined_at: DateTime<Utc>,
    pub invited_by: Option<String>,
    pub user: UserResponse,
}

pub struct UserResponse {
    pub id: String,
    pub email: String,
    pub username: String,
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
}

pub struct MemberRoleUpdate {
    pub user_id: ID,
    pub role: MemberRole,
}

pub struct BulkUpdateResponse {
    pub success_count: i32,
    pub members: Vec<ProjectMember>,
}

pub struct BulkRemoveResponse {
    pub success_count: i32,
    pub failed_count: i32,
}
```

---

## 4. REDUX STATE MANAGEMENT

**File**: `/Users/TienVNV/Desktop/ProjectManager/frontend/src/redux/features/membersSlice.ts`

### State Structure
```typescript
interface MembersState {
  members: Member[];
  loading: boolean;
  error: string | null;
}
```

### Async Thunks (Actions)
- `fetchProjectMembers(projectId)` - Fetch members for a project
- `addMemberByEmail({projectId, email, role})` - Add new member via email
- `removeMember({projectId, userId})` - Remove single member
- `removeMultipleProjectMembers({projectId, memberIds})` - Bulk remove
- `updateProjectMemberRole({projectId, userId, role})` - Single role update
- `updateMultipleProjectMemberRoles({projectId, updates})` - Bulk role update

### Synchronous Actions (Reducers)
- `addMemberToStore(member)` - Add member to store
- `updateMemberRoleInStore({userId, role})` - Update member role
- `updateMultipleMemberRolesInStore(updates[])` - Bulk update roles
- `removeMemberFromStore(userId)` - Remove member
- `removeMultipleMembersFromStore(userIds[])` - Bulk remove

---

## 5. GRAPHQL API ENDPOINTS

### Queries

#### projectMembers
```graphql
query ProjectMembers($projectId: ID!) {
  projectMembers(projectId: $projectId) {
    role
    joinedAt
    user {
      userId
      email
      fullName
      username
      avatarUrl
    }
  }
}
```
**File**: `/Users/TienVNV/Desktop/ProjectManager/frontend/src/graphql/queries/member.ts`

#### myProjectRole
```graphql
query MyProjectRole($projectId: ID!) {
  myProjectRole(projectId: $projectId)
}
```
Gets current user's role in a project

### Mutations

#### addProjectMemberByEmail
```graphql
mutation AddProjectMemberByEmail($projectId: ID!, $email: String!, $role: MemberRole!) {
  addProjectMemberByEmail(projectId: $projectId, email: $email, role: $role) {
    user { userId, email, fullName, username, avatarUrl }
    role
    joinedAt
  }
}
```
**File**: `/Users/TienVNV/Desktop/ProjectManager/frontend/src/graphql/mutations/projectMember.ts`

**Backend Handler**: `/Users/TienVNV/Desktop/ProjectManager/backend/src/graphql/resolvers/members/mutation/add_by_email.rs`
- Validates project exists
- Finds user by email
- Checks user not already a member
- Enforces max 20 members per project
- Returns new ProjectMember with user info

#### updateProjectMember
```graphql
mutation UpdateProjectMemberRole($projectId: ID!, $userId: ID!, $role: MemberRole!) {
  updateProjectMember(projectId: $projectId, userId: $userId, role: $role) {
    user { userId, email, fullName, username, avatarUrl }
    role
    joinedAt
  }
}
```

#### removeProjectMember
```graphql
mutation RemoveProjectMember($projectId: ID!, $userId: ID!) {
  removeProjectMember(projectId: $projectId, userId: $userId)
}
```

#### updateMultipleMembers
```graphql
mutation UpdateMultipleMemberRoles($projectId: ID!, $updates: [MemberRoleUpdate!]!) {
  updateMultipleMembers(projectId: $projectId, updates: $updates) {
    successCount
    members {
      memberId, projectId, userId, role, joinedAt
      user { id, email, username, fullName, avatarUrl }
    }
  }
}
```
**File**: `/Users/TienVNV/Desktop/ProjectManager/frontend/src/graphql/mutations/projectMembers.ts` (lines 55-75)

**Backend Handler**: `/Users/TienVNV/Desktop/ProjectManager/backend/src/graphql/resolvers/members/mutation/bulk_update.rs`
- Verifies user has manager/leader role
- Prevents self-role changes (security)
- Updates all members in transaction-like manner
- Returns updated members with new roles

#### removeMultipleProjectMembers
```graphql
mutation RemoveMultipleProjectMembers($projectId: ID!, $memberIds: [ID!]!) {
  removeMultipleProjectMembers(projectId: $projectId, memberIds: $memberIds) {
    successCount
    failedCount
  }
}
```
**File**: `/Users/TienVNV/Desktop/ProjectManager/frontend/src/graphql/mutations/projectMembers.ts` (lines 84-90)

**Backend Handler**: `/Users/TienVNV/Desktop/ProjectManager/backend/src/graphql/resolvers/members/mutation/bulk_remove.rs`
- Verifies admin permissions
- Prevents self-removal
- Returns count of successful/failed removals

---

## 6. BACKEND GRAPHQL RESOLVERS

### Query Resolvers
**File**: `/Users/TienVNV/Desktop/ProjectManager/backend/src/graphql/resolvers/members/query/`

#### project_members
- **Location**: `get_members.rs`
- **Query**: Fetches all members in a project with user info
- **Auth**: Requires project membership
- **Returns**: Vec<ProjectMember>

#### my_project_role
- **Location**: `my_role.rs`
- **Query**: Gets current user's role in a project
- **Auth**: Checks current user
- **Returns**: Option<MemberRole>

### Mutation Resolvers
**File**: `/Users/TienVNV/Desktop/ProjectManager/backend/src/graphql/resolvers/members/mutation/`

#### add_member_by_email (lines 10-113)
- Validates project exists
- Finds user by email
- Prevents duplicates
- Enforces member limit (20 max)
- Generates new member ID
- Records join timestamp

#### update_member (update.rs)
- Updates single member's role
- Requires manager/leader permission
- Updates project_members table

#### remove_member (remove.rs)
- Removes single member
- Requires admin permission
- Validates project exists

#### update_multiple_members (bulk_update.rs lines 10-156)
- Bulk role updates
- Permission check on each user
- Prevents self-update (security)
- Returns success count and updated members
- Extensive debug logging

#### remove_multiple_members (bulk_remove.rs lines 9-97)
- Bulk member removal
- Prevents self-removal
- Returns success/failed counts
- Validates admin permission upfront

---

## 7. DATABASE SCHEMA

**File**: `/Users/TienVNV/Desktop/ProjectManager/backend/migrations/20250319000000_create_initial_schema.sql`

### project_members Table
```sql
CREATE TABLE project_members (
    member_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    invited_by UUID REFERENCES users(user_id),
    role member_role NOT NULL DEFAULT 'member',
    UNIQUE (project_id, user_id)
);

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);
```

### member_role Enum Type
```sql
CREATE TYPE member_role AS ENUM ('admin', 'member', 'viewer');
```

**Note**: Backend supports lowercase ('manager', 'leader', 'member', 'guest') but migration shows old enum ('admin', 'member', 'viewer'). There's a migration that updates this to new values.

---

## 8. CURRENT IMPLEMENTATION PATTERNS

### Frontend State Flow
1. **Fetch**: `fetchProjectMembers` → Redux store
2. **Display**: Component reads from Redux store via `useAppSelector`
3. **Actions**: 
   - Single: Dispatch thunk, wait for result, update store
   - Bulk: Map to updates array, dispatch thunk, update store
4. **UI Feedback**: Snackbar notifications for success/error
5. **Pending Changes**: Tracked in local state with `pendingChanges` Map

### Permission Checks
- **Frontend**: Based on `myProjectRole` query result
- **Backend**: 
  - Queries: Check if user is project member
  - Mutations: Check if user has manager/leader role
  - Self-protection: Cannot modify own role or remove self

### Validation
- Email must exist in system (user lookup fails → error)
- User not already member of project
- Role values validated through enums
- Max 20 members per project

---

## 9. MISSING/TODO FEATURES

### Email Invitations
- ❌ No invitation tracking table in schema
- ❌ No pending invitations UI
- ❌ No invitation acceptance flow
- ❌ No resend invitation functionality
- ✓ Can only add existing users by email

### Advanced Features
- ❌ Role customization/creation
- ❌ Permission template system
- ❌ Activity/audit log for member changes
- ❌ Member deactivation (only removal)
- ❌ Batch CSV import for members
- ⚠️ Workspace-level member management (only project-level exists)

### Notification System
- ⚠️ Only UI notifications (Snackbar), no email notifications for:
  - Member added notification
  - Role change notification
  - Member removed notification

---

## 10. KEY FILE PATHS SUMMARY

| Category | File Path |
|----------|-----------|
| **Frontend Components** | `/frontend/src/components/project/MembersTab.tsx` |
| | `/frontend/src/components/projects/MembersView.tsx` |
| | `/frontend/src/components/project/RoleBadge.tsx` |
| | `/frontend/src/components/project/MemberRoleSelect.tsx` |
| **Frontend Types** | `/frontend/src/types/members.ts` |
| | `/frontend/src/types/project.ts` |
| **Frontend Redux** | `/frontend/src/redux/features/membersSlice.ts` |
| **Frontend GraphQL** | `/frontend/src/graphql/queries/member.ts` |
| | `/frontend/src/graphql/mutations/projectMember.ts` |
| | `/frontend/src/graphql/mutations/projectMembers.ts` |
| **Frontend Utils** | `/frontend/src/lib/utils.ts` |
| **Backend Types** | `/backend/src/graphql/resolvers/members/types.rs` |
| **Backend Queries** | `/backend/src/graphql/resolvers/members/query/get_members.rs` |
| | `/backend/src/graphql/resolvers/members/query/my_role.rs` |
| **Backend Mutations** | `/backend/src/graphql/resolvers/members/mutation/add_by_email.rs` |
| | `/backend/src/graphql/resolvers/members/mutation/update.rs` |
| | `/backend/src/graphql/resolvers/members/mutation/remove.rs` |
| | `/backend/src/graphql/resolvers/members/mutation/bulk_update.rs` |
| | `/backend/src/graphql/resolvers/members/mutation/bulk_remove.rs` |
| **Database** | `/backend/migrations/20250319000000_create_initial_schema.sql` |

---

## 11. ARCHITECTURE NOTES

### Technology Stack
- **Frontend**: React + TypeScript + Redux Toolkit + Apollo Client
- **Backend**: Rust + async-graphql + sqlx + PostgreSQL
- **Database**: PostgreSQL with UUID primary keys

### State Management
- Redux for member list and loading states
- Apollo Client for GraphQL caching (used alongside Redux)
- Component-level state for UI interactions (dialogs, selections)

### API Layer
- GraphQL as primary API
- Mutations for member operations
- Queries for fetching member lists and roles
- Error handling via GraphQL errors and Redux rejected actions

### Security Patterns
- Role-based access control on backend
- Self-modification prevention
- User existence validation
- Duplicate member prevention

---

## UNRESOLVED QUESTIONS

1. **Email Invitations**: Is there a separate invitation system planned? Current implementation requires users to already exist.

2. **Workspace Members**: Are there workspace-level members separate from project members?

3. **Permission System**: Should roles be customizable or are the 4 fixed roles (Manager, Leader, Member, Guest) final?

4. **Audit Log**: Should member changes be tracked for compliance/history?

5. **Member Limits**: Why is max 20 members hardcoded? Should this be configurable?

6. **Notification**: Should there be email notifications when users are added to projects?

7. **Member Status**: Should there be inactive/deactivated member states, or just removal?

8. **API Versioning**: Is there a REST API, or only GraphQL?

---

**Report Generated**: April 1, 2026
**Explored By**: Claude Code
