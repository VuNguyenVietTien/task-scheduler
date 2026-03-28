# GraphQL Task Field Naming Discrepancy Analysis

**Date:** 2026-03-28  
**Status:** Complete

## Summary
Critical field naming mismatch found between frontend GraphQL queries and backend schema. Frontend files use **camelCase** (e.g., `taskId`, `parentTaskId`) while the backend schema defines and returns **snake_case** fields (e.g., `task_id`, `parent_task_id`). This creates a fundamental API contract violation.

---

## 1. Frontend Files Using camelCase (PROBLEMATIC)

### Frontend `/frontend/src/graphql/` - camelCase
These files request fields using camelCase but backend returns snake_case:

**Query Files:**
- `/Users/TienVNV/Desktop/ProjectManager/frontend/src/graphql/queries/tasks.ts`
  - `GET_PROJECT_TASKS` - uses `taskId`, `projectId`, `parentTaskId`
  - `GET_TASK_BY_ID` - uses `taskId`, `projectId`, `parentTaskId`
  - `GET_PROJECT_TASKS_PAGINATED` - uses `taskId`, `projectId`, `parentTaskId`
  - `GET_TASK_COMMENTS` - uses `taskId`
  - `GET_TASK_SUBTASKS` - uses `taskId`
  - `GET_TASK_BASIC_INFO` - uses `taskId`, `projectId`

**Mutation Files:**
- `/Users/TienVNV/Desktop/ProjectManager/frontend/src/graphql/mutations/tasks.ts`
  - `UPDATE_TASK_STATUS` - uses `taskId`, `projectId`, `parentTaskId`
  - `UPDATE_TASK_EFFORT` - uses `taskId`, `projectId`, `parentTaskId`
  - `UPDATE_TASK` - uses `taskId`, `projectId`, `parentTaskId`
  - `CREATE_TASK_COMMENT` - uses `authorId`
  - `DELETE_TASK_COMMENT` - uses `commentId`

**Other Files:**
- `/Users/TienVNV/Desktop/ProjectManager/frontend/src/graphql/types/notifications.ts` - uses `taskId`
- `/Users/TienVNV/Desktop/ProjectManager/frontend/src/graphql/queries/reports.ts` - uses `taskId`, `userId`, `avatarUrl`
- `/Users/TienVNV/Desktop/ProjectManager/frontend/src/graphql/queries/dashboard.ts` - uses `taskId`, `userId`, `projectId`
- `/Users/TienVNV/Desktop/ProjectManager/frontend/src/graphql/queries/projectMembers.ts` - uses `taskId`
- `/Users/TienVNV/Desktop/ProjectManager/frontend/src/graphql/mutations.ts` - uses `taskId`, `parentTaskId`

---

## 2. Web Frontend Files Using snake_case (CORRECT)

### Web `/web/src/graphql/` - snake_case

**Query Files:**
- `/Users/TienVNV/Desktop/ProjectManager/web/src/graphql/queries/tasks.ts`
  - Uses `task_id`, `project_id`, `parent_task_id` (CORRECT - matches backend)

**Mutation Files:**
- `/Users/TienVNV/Desktop/ProjectManager/web/src/graphql/mutations/tasks.ts`
  - Uses `task_id`, `project_id`, `parent_task_id` (CORRECT - matches backend)

---

## 3. Backend Schema Definition

### Backend Rust GraphQL Schema
**File:** `/Users/TienVNV/Desktop/ProjectManager/backend/src/graphql/types/task.rs`

```rust
#[derive(SimpleObject, Debug, Clone, Serialize, Deserialize)]
#[graphql(rename_fields = "camelCase")]  // <-- Converts snake_case to camelCase in response
pub struct Task {
    pub task_id: Uuid,
    pub project_id: Uuid,
    pub parent_task_id: Option<Uuid>,
    pub priority_order: i32,
    pub start_date: Option<DateTime<Utc>>,
    pub due_date: Option<DateTime<Utc>>,
    pub actual_start_date: Option<DateTime<Utc>>,
    pub actual_end_date: Option<DateTime<Utc>>,
    pub effort: Option<f64>,
    pub progress: Option<f64>,
    pub created_by: Uuid,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub is_deleted: Option<bool>,
    pub status: TaskStatus,
    pub priority: TaskPriority,
    pub type_: Option<String>,
    pub category: Option<String>,
    pub progress_type: Option<TaskProgressType>,
    pub tags: Option<JsonValue>,
    pub child_tasks: Option<Vec<Task>>
}
```

**Key Attribute:** `#[graphql(rename_fields = "camelCase")]`
- This tells async-graphql to automatically convert snake_case Rust fields to camelCase in GraphQL responses
- Backend **INTERNALLY** stores as snake_case but **EXPOSES** as camelCase via GraphQL

### Backend Schema GraphQL Definition
**File:** `/Users/TienVNV/Desktop/ProjectManager/backend/schema.graphql`

```graphql
type Task {
  taskId: ID!
  projectId: ID!
  parentTaskId: ID
  title: String!
  description: String
  status: TaskStatus!
  assigneeId: ID
  assignee: UserBasic
  priority: TaskPriority!
  priorityOrder: Int!
  effort: Float
  startDate: DateTime
  dueDate: DateTime
  deadline: DateTime
  createdBy: ID
  creator: UserBasic
  assignees: [User!]!
  comments: [Comment!]!
  attachments: [Attachment!]!
  type: String
  category: String
  progressType: TaskProgressType
  tags: [String!]
  metadata: JSON
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

**This clearly defines camelCase field names in the GraphQL schema**

---

## 4. Complete Task-Related Field Usage

### Frontend (camelCase) - Verified Fields
- `taskId`
- `projectId`
- `parentTaskId`
- `userId`
- `avatarUrl`
- `actualStartDate`
- `actualEndDate`
- `createdBy`
- `dueDate`
- `startDate`
- `priorityOrder`
- `progressType`
- `authorId`
- `commentId`

### Web (snake_case) - Verified Fields
- `task_id`
- `project_id`
- `parent_task_id`
- `user_id`
- `avatar_url`
- `actual_start_date`
- `actual_end_date`
- `created_by`
- `due_date`
- `start_date`
- `priority_order`
- `progress_type`
- `author_id`
- `comment_id`
- `type_` → `type`
- `total_items` → `totalItems`
- `total_pages` → `totalPages`
- `current_page` → `currentPage`
- `page_size` → `pageSize`

---

## 5. Files Requiring Updates

### HIGH PRIORITY - Frontend camelCase to snake_case conversion
1. `/Users/TienVNV/Desktop/ProjectManager/frontend/src/graphql/queries/tasks.ts` (6 queries)
2. `/Users/TienVNV/Desktop/ProjectManager/frontend/src/graphql/mutations/tasks.ts` (5 mutations)
3. `/Users/TienVNV/Desktop/ProjectManager/frontend/src/graphql/types/notifications.ts` (1 interface field)
4. `/Users/TienVNV/Desktop/ProjectManager/frontend/src/graphql/queries/reports.ts` (camelCase fields in report query)
5. `/Users/TienVNV/Desktop/ProjectManager/frontend/src/graphql/queries/dashboard.ts` (camelCase task fields)
6. `/Users/TienVNV/Desktop/ProjectManager/frontend/src/graphql/queries/projectMembers.ts` (camelCase task fields)
7. `/Users/TienVNV/Desktop/ProjectManager/frontend/src/graphql/mutations.ts` (CREATE_TASK, UPDATE_TASK mutations)

**Total: 13 GraphQL operations affected**

### Status
- **Web**: ✓ Already correct (uses snake_case)
- **Frontend**: ✗ Needs migration to snake_case
- **Backend**: ✓ Properly configured with `#[graphql(rename_fields = "camelCase")]`

---

## Key Findings

1. **Backend exposes camelCase via GraphQL** due to `rename_fields` directive
2. **Frontend incorrectly uses camelCase in queries** (mismatch with actual API if the backend conversion is not working)
3. **Web is correct** - already uses snake_case matching the backend resolver outputs
4. **Inconsistency suggests frontend was built against expected API behavior without testing**

The issue is that frontend queries are sending requests for snake_case fields that don't match what the backend schema document defines. The backend code shows it SHOULD convert to camelCase, but if that's not working properly or if there's a disconnect in the resolvers, the frontend would fail.

**Recommendation:** Convert all frontend GraphQL operations from camelCase to snake_case to match the web implementation (which is working) and ensure consistency across both frontends.
