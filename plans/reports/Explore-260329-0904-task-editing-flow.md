# Task Editing Flow Analysis: ProjectManager

## Executive Summary
The ProjectManager codebase uses a **multi-layered architecture** for task editing:
1. **Frontend UI**: Task detail modal (TaskDetail.tsx, TaskDetailPage.tsx)
2. **State Management**: Redux (tasksSlice.ts, taskDetailSlice.ts) + Apollo Client Cache
3. **GraphQL Mutations**: Three main mutations (UPDATE_TASK, UPDATE_TASK_STATUS, UPDATE_TASK_EFFORT)
4. **Custom Hooks**: Field-specific mutation hooks (useTaskFieldMutations.ts)
5. **Data Propagation**: Event broadcasting + Redux dispatch + local state updates

---

## 1. TASK DETAIL MODAL COMPONENTS

### A. TaskDetail.tsx (Quick Edit Modal)
**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/tasks/TaskDetail.tsx`

**Purpose**: Lightweight modal for quick edits on individual task fields

**Key Functions**:
- `saveField(fieldName)`: Saves a single field to backend
  - Transforms field values to proper formats (dates to ISO, numbers parsed)
  - Calls `updateTask(taskId, updates)` via the `useTasks` hook
  - Exits edit mode on success
  - Invokes `onTaskUpdate` callback to notify parent

- `cancelEdit()`: Reverts field to original value and exits edit mode

- `fetchComments()`: Loads comments via REST API (`/api/projects/{projectId}/tasks/{taskId}/comments`)

**Editable Fields**: title, description, status, priority, start_date, due_date, effort, progress, actual_start_date, actual_end_date

**State Management**:
```typescript
const [editedTask, setEditedTask] = useState<Task>(task);
const [editingField, setEditingField] = useState<string | null>(null);
```

**Data Flow**:
1. User edits field → updateField state
2. Click save → `saveField()` → call mutation
3. Success → `onTaskUpdate` callback fires → parent updates state
4. Modal stays open but exits edit mode

---

### B. TaskDetailPage.tsx (Full Detail Modal)
**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/tasks/TaskDetailPage.tsx` (88KB file)

**Purpose**: Comprehensive task detail page with tabs (description, subtasks, comments)

**Key Props**:
```typescript
interface TaskDetailPageProps {
  task: Task;
  projectId: string;
  currentUser?: User;
  onTaskUpdate: (updates: Partial<Task>) => Promise<boolean>;
  isLoadingProp?: boolean;
  projectMembers?: ProjectMember[];
  hideTitleHeader?: boolean;
  refetchMembers?: () => void;
}
```

**Key Redux Integration**:
- Dispatches `fetchTaskDetail(taskId)` via Redux thunk → fetches full task data
- Dispatches `fetchSubtasks(taskId)` and `fetchComments(taskId)` separately
- Uses Redux state: `taskDetailState.task`, `taskDetailState.subtasks`, `taskDetailState.comments`

**Cache TTL Strategy**:
```typescript
const CACHE_TTL = 60000; // 1 minute
const shouldFetchData = useCallback((key: string, minInterval: number = 10000) => {
  const lastFetchTime = lastFetchTimeRef.current[key] || 0;
  return (Date.now() - lastFetchTime) >= minInterval;
}, []);
```

**State Architecture**:
- Local state: `editedTask`, `editingField`, `isEditing`, `isSaving`
- Redux state: `taskDetail.task`, `taskDetail.subtasks`, `taskDetail.comments`
- Tracks duplicate API calls with `apiCallsInProgressRef` and `lastFetchTimeRef`

---

## 2. STATE MANAGEMENT LAYERS

### A. Redux slices (Tasks + Task Detail)

#### tasksSlice.ts
**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/redux/features/tasksSlice.ts`

**State Shape**:
```typescript
interface TasksState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  pagination: PaginationData;
  filters: TaskFilter;
}
```

**Async Thunks** (mutations via GraphQL):
- `updateTaskStatus({ taskId, status })` → calls UPDATE_TASK mutation
- `updateTaskPriority({ taskId, priority })` → calls UPDATE_TASK mutation
- `updateTaskEffort({ taskId, effort })` → calls UPDATE_TASK mutation
- `updateTaskAssignee({ taskId, assigneeId })` → calls UPDATE_TASK mutation
- `updateTaskDueDate({ taskId, dueDate })` → calls UPDATE_TASK mutation
- `fetchProjectTasks(projectId)` → calls GET_PROJECT_TASKS query

**Mutation Pattern**:
```typescript
const response = await client.mutate({
  mutation: UPDATE_TASK,
  variables: { input: { task_id: taskId, status, ... } },
  errorPolicy: 'all',
  fetchPolicy: 'no-cache'  // Always bypass cache
});
```

**Response Handling**:
- Transforms response via `transformTaskFromAPI(response.data.update_task)`
- Returns `{ taskId, status, task: transformedTask }`
- Reducer updates tasks array by taskId match

---

#### taskDetailSlice.ts
**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/redux/features/taskDetailSlice.ts`

**State Shape**:
```typescript
interface TaskDetailState {
  task: Task | null;
  subtasks: Task[];
  comments: TaskComment[];
  loadingTask: boolean;
  loadingSubtasks: boolean;
  loadingComments: boolean;
  updatingParent: boolean;
  searchingParent: boolean;
  potentialParentTask: { taskId: string; title: string; projectId: string } | null;
  error: string | null;
}
```

**Async Thunks**:
- `fetchTaskDetail(taskId)` → GET_TASK_BY_ID (fetchPolicy: 'network-only')
- `fetchSubtasks(taskId)` → GET_TASK_SUBTASKS
- `fetchComments(taskId)` → GET_TASK_COMMENTS
- `updateTaskParent({ taskId, parentTaskId })` → UPDATE_TASK mutation
- `searchParentTaskById(taskId)` → GET_TASK_BASIC_INFO

**Key Behavior**:
- Each fetch uses `fetchPolicy: 'network-only'` (bypasses Apollo cache)
- Tracks loading states separately for task/subtasks/comments
- Supports parent task hierarchy queries

---

### B. Apollo Client Cache

**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/lib/apollo-client.ts`

**Configuration** (inferred):
- Uses `errorPolicy: 'all'` to get data even with errors
- Uses `fetchPolicy: 'no-cache'` for mutations
- Optimistic responses provided in custom hooks
- No explicit cache.modify() calls observed

---

## 3. GRAPHQL MUTATIONS

### A. UPDATE_TASK (Main Mutation)
**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/graphql/mutations/tasks.ts`

```graphql
mutation UpdateTask($input: UpdateTaskInput!) {
  update_task(input: $input) {
    task_id
    title
    description
    status
    priority
    priority_order
    assignee { user_id, username, avatar_url, role }
    effort
    start_date
    due_date
    actual_start_date
    actual_end_date
    type_
    category
    tags
    progress_type
  }
}
```

**Input Variables**:
```typescript
{
  task_id: string;
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  effort?: number;
  start_date?: string;
  due_date?: string;
  assignee_id?: string | null;
  priority_order?: number;
  type_?: string;
  category?: string;
  progress_type?: string;
  tags?: string[];
  parent_task_id?: string;
}
```

---

### B. UPDATE_TASK_STATUS (Specialized Mutation)
**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/graphql/mutations/tasks.ts`

Used by:
- KanbanBoard drag-drop (via Redux dispatch)
- Direct status updates in hooks

Returns full task object (all fields listed above)

---

### C. UPDATE_TASK_EFFORT (Specialized Mutation)
**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/graphql/mutations/tasks.ts`

**Purpose**: Separate mutation for effort updates to preserve assignee data

```typescript
// In useTaskFieldMutations.ts
const response = await client.mutate({
  mutation: UPDATE_TASK_EFFORT,
  variables: { input: { task_id, effort: Number(effort) } },
  optimisticResponse: {
    update_task_effort: {
      task_id,
      effort: Number(effort),
      assignee: assigneeFromCache  // Preserved from cache
    }
  }
});
```

---

## 4. CUSTOM MUTATION HOOKS

### A. useTaskFieldMutations.ts
**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/hooks/useTaskFieldMutations.ts`

**Exported Hooks**:

#### 1. useUpdateTaskStatus()
```typescript
const updateStatus = useCallback(async (taskId: string, status: TaskStatus) => {
  const input = { task_id: taskId, status };
  const response = await client.mutate({
    mutation: UPDATE_TASK,
    variables: { input },
    errorPolicy: 'all',
    optimisticResponse: { update_task: { task_id, status } }
  });
  
  // Broadcast event
  window.dispatchEvent(new CustomEvent('task-status-updated', {
    detail: { task_id: taskId, status: formattedResult.status }
  }));
  
  return formattedResult;
}, [apolloClient]);
```

**Data Flow**:
1. Mutation sent to GraphQL API
2. Optimistic response applied immediately
3. On success: broadcasts `task-status-updated` event
4. On error: throws error (caller handles rollback)

#### 2. useUpdateTaskPriority()
- Broadcasts `task-priority-updated` event
- Pattern identical to useUpdateTaskStatus()

#### 3. useUpdateTaskEffort()
- Special handling: caches assignee from localStorage or Apollo cache
- Preserves assignee in optimistic response
- Broadcasts `task-effort-updated` event with assignee data

#### 4. useUpdateTaskDueDate()
- Formats dates to ISO string format
- Broadcasts `task-due-date-updated` event
- Date validation: uses `new Date(dueDate).toISOString()`

#### 5. useUpdateTaskAssignee()
- Input: `{ task_id, assignee_id }`
- Broadcasts `task-assignee-updated` event
- Handles null assigneeId for unassignment

---

### B. useTaskStatusUpdate.ts
**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/hooks/useTaskStatusUpdate.ts`

Wrapper hook that uses the above mutation hooks. Used by KanbanBoard for drag-drop updates.

---

### C. useTasks.ts
**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/hooks/useTasks.ts`

**Main Function**: `useUpdateTask()`

```typescript
export const useUpdateTask = () => {
  return useCallback(async (taskId: string, updates: Partial<Task>) => {
    const input = { task_id: taskId, ...updates };
    
    const response = await client.mutate({
      mutation: UPDATE_TASK,
      variables: { input },
      errorPolicy: 'all',
      optimisticResponse: { update_task: { __typename: 'Task', ...input } }
    });
    
    return formatResponse(response.data.update_task);
  }, []);
};
```

**Comprehensive Field Transformation**:
- Converts all field types (dates to ISO, enums to uppercase, etc.)
- Handles optional fields with explicit checks
- Formats assignee from `updates.assignee?.userId` to `assignee_id`

---

## 5. VIEW COMPONENTS AND RESPONSE PROPAGATION

### A. KanbanBoard.tsx (Kanban Board View)
**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/tasks/KanbanBoard.tsx`

**Architecture**:
```typescript
// Get tasks from props or Redux
const tasksState = useSelector((state: RootState) => state.tasks);
const [clonedTasks, setClonedTasks] = useState<Task[]>(tasks);
const [filteredTasks, setFilteredTasks] = useState<Task[]>(tasks);

// Sync from Redux
useEffect(() => {
  if (tasksState.tasks.length > 0) {
    const projectTasks = tasksState.tasks.filter(task => task.project_id === projectId);
    updateClonedTasks(projectTasks);  // Update local state
  }
}, [tasks, tasksState, projectId, updateClonedTasks]);
```

**Drag-Drop Update Flow**:
1. User drags task to new column
2. Extract `taskId` from draggableId, `newStatus` from destination
3. **Optimistic Update**: `setClonedTasks()` - update UI immediately
4. **Redux Dispatch**: `dispatch(updateTaskStatus({ taskId, status: newStatus }))`
5. **Response Handler**:
   ```typescript
   .unwrap()
   .then(() => {
     console.log('Task status updated successfully via Redux');
     onTasksReorder?.(clonedTasks);  // Notify parent
     
     // Show success notification
     window.dispatchEvent(new CustomEvent('show-notification', {
       detail: { type: 'success', message: 'Đã cập nhật trạng thái công việc' }
     }));
   })
   .catch(error => {
     // Rollback UI on error
     setClonedTasks(prevTasks => 
       prevTasks.map(task => 
         task.task_id === taskId 
           ? { ...task, status: previousStatus }
           : task
       )
     );
     
     // Show error notification
     window.dispatchEvent(new CustomEvent('show-notification', {
       detail: { type: 'error', message: 'Cập nhật trạng thái thất bại...' }
     }));
   });
   ```

**External Task Updates**: Listens to `task-status-updated` event
```typescript
useEffect(() => {
  const handleTaskStatusUpdate = (event: CustomEvent) => {
    const { taskId, newStatus } = event.detail;
    setClonedTasks(prevTasks => 
      prevTasks.map(task => 
        task.task_id === taskId 
          ? { ...task, status: newStatus }
          : task
      )
    );
  };
  
  window.addEventListener('task-status-updated', handleTaskStatusUpdate as EventListener);
  return () => window.removeEventListener('task-status-updated', handleTaskStatusUpdate as EventListener);
}, []);
```

**Filtering**: Maintains user selections in localStorage
```typescript
useEffect(() => {
  storeValue(KANBAN_SELECTED_USER_KEY, selectedUser);
}, [selectedUser]);

useEffect(() => {
  storeValue(KANBAN_SELECTED_STATUSES_KEY, selectedStatuses);
}, [selectedStatuses]);
```

---

### B. TaskListView.tsx (Table/List View)
**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/tasks/TaskListView.tsx`

**Single Task Update Method**:
```typescript
const updateSingleTaskInState = useCallback((taskId: string, updates: Partial<Task>) => {
  setTasks(currentTasks => {
    const taskIndex = currentTasks.findIndex(t => t.task_id === taskId);
    if (taskIndex === -1) return currentTasks;
    
    const updatedTasks = [...currentTasks];
    updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], ...updates };
    return updatedTasks;
  });
}, []);
```

**Field-Specific Mutation Hooks** (imported):
```typescript
const { updateStatus } = useUpdateTaskStatus();
const { updatePriority } = useUpdateTaskPriority();
const { updateEffort } = useUpdateTaskEffort();
const { updateDueDate } = useUpdateTaskDueDate();
const { updateAssignee } = useUpdateTaskAssignee();
```

**Dispatch + Hook Pattern**:
```typescript
// Example: Update status
dispatch(updateTaskStatus({ taskId, status: newStatus }))
  .unwrap()
  .then(() => {
    updateSingleTaskInState(taskId, { status: newStatus });
    showSuccess('Status updated');
  })
  .catch(error => {
    showError('Update failed');
  });
```

---

### C. TaskDetail.tsx (Modal Opened from Views)
**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/tasks/TaskDetail.tsx`

**Integration Pattern**:
```typescript
<TaskDetail 
  task={selectedTask} 
  isOpen={isTaskDetailOpen} 
  onClose={() => setIsTaskDetailOpen(false)}
  onTaskUpdate={(taskId, updates) => {
    // Called when modal saves changes
    handleTaskDetailUpdate(taskId, updates);
  }}
/>

// In KanbanBoard:
const handleTaskDetailUpdate = useCallback((taskId: string, updates: Partial<Task>) => {
  setSelectedTask(prev => prev ? { ...prev, ...updates } : null);
  setClonedTasks(prev => prev.map(t =>
    t.task_id === taskId ? { ...t, ...updates } : t
  ));
}, []);
```

---

## 6. DATA FLOW SEQUENCE DIAGRAMS

### A. Single Field Edit Flow (Modal)

```
User edits field in TaskDetail
         ↓
[saveField(fieldName)]
         ↓
Transform value (date to ISO, number to int, etc.)
         ↓
[useTasks.updateTask(taskId, { [fieldName]: value })]
         ↓
[client.mutate(UPDATE_TASK)]
         ↓
GraphQL Mutation Sent to Backend
         ↓
Response received (full updated task)
         ↓
[onTaskUpdate callback] → Parent component state updated
         ↓
Modal stays open, exits edit mode
         ↓
Parent view (Kanban/List) sees update if using same state
```

---

### B. Kanban Drag-Drop Update Flow

```
User drags task card to new column
         ↓
[handleDragEnd(result)]
         ↓
Extract taskId, newStatus from result
         ↓
[setClonedTasks] ← Optimistic update (UI changes immediately)
         ↓
[dispatch(updateTaskStatus({ taskId, newStatus }))]
         ↓
Redux thunk executes:
  [client.mutate(UPDATE_TASK)]
         ↓
GraphQL Mutation Sent
         ↓
Response with full task
         ↓
Redux reducer updates state.tasks[]
         ↓
.unwrap().then() → Success handler
  - Call [onTasksReorder(clonedTasks)]
  - Dispatch 'show-notification' event
  - Log success
         ↓
Parent component receives update via Redux selector
         ↓
KanbanBoard re-renders with new task list
```

**Error Case (Rollback)**:
```
.catch(error) → Error handler
         ↓
[setClonedTasks] ← Revert to previousStatus
         ↓
Dispatch 'show-notification' event (error type)
         ↓
UI shows error message
         ↓
User can retry or inspect error
```

---

### C. External Task Update (Cross-Tab/Multi-User)

```
Task updated in another tab/user
         ↓
Backend sends update
         ↓
[window.dispatchEvent('task-status-updated')] ← Event broadcast
         ↓
KanbanBoard listener catches event:
  [handleTaskStatusUpdate(event)]
         ↓
[setClonedTasks] → Update filtered task's status
         ↓
Component re-renders
         ↓
Kanban board shows updated task in new column
```

---

## 7. CACHE INVALIDATION STRATEGY

### Current Approach:
1. **No automatic cache invalidation** - uses `fetchPolicy: 'no-cache'`
2. **Manual state updates** - component state updated after mutation
3. **Redux state updates** - Redux thunks update tasks array
4. **Event broadcasting** - custom events notify listeners
5. **localStorage caching** - KanbanBoard filters persist to localStorage

### Mutation Response Pattern:
```typescript
// Optimistic response provided
optimisticResponse: {
  update_task: {
    __typename: 'Task',
    task_id: taskId,
    status: newStatus,
    // Other fields from cache if available
  }
}

// Actual response from server replaces optimistic
// No explicit cache.modify() observed
```

---

## 8. POTENTIAL ISSUES & OBSERVATIONS

### ✓ Strengths:
1. **Multi-layer updates**: Optimistic UI + Redux state + event broadcasting
2. **Rollback mechanism**: Drag-drop reverts on error
3. **Granular mutations**: UPDATE_TASK_STATUS, UPDATE_TASK_EFFORT separate calls
4. **Cache bypass**: `fetchPolicy: 'no-cache'` prevents stale data
5. **Event system**: Custom events allow cross-component communication

### ⚠ Potential Issues:
1. **No Apollo cache refetch**: After mutation, no explicit `refetchQueries`
2. **Orphaned event listeners**: Custom event listeners added/removed but no cleanup in all cases
3. **Race conditions**: Multiple rapid updates could cause state inconsistency
4. **Redux + local state duplication**: Both `Redux` and component-level `clonedTasks` can diverge
5. **localStorage persistence**: Filter choices in localStorage can become stale
6. **Effort mutation caching**: Attempt to preserve assignee from cache is fragile

### 🔍 Data Consistency Model:
- **Source of Truth**: Redux store (via Apollo mutations)
- **Fallback**: Component local state (`clonedTasks`, `editedTask`)
- **Notification**: Custom DOM events
- **Persistence**: Redux state + localStorage (filters only)

---

## 9. KEY FILES SUMMARY TABLE

| File Path | Component | Purpose | Key Functions |
|-----------|-----------|---------|---|
| `/web/src/components/tasks/TaskDetail.tsx` | Quick Edit Modal | Single field edits | `saveField()`, `cancelEdit()` |
| `/web/src/components/tasks/TaskDetailPage.tsx` | Full Detail Page | Multi-tab task view | `fetchTaskDetail()`, Redux dispatch |
| `/web/src/components/tasks/KanbanBoard.tsx` | Kanban View | Drag-drop status updates | `handleDragEnd()`, Redux dispatch |
| `/web/src/components/tasks/TaskListView.tsx` | Table View | List with inline edits | `updateSingleTaskInState()` |
| `/web/src/redux/features/tasksSlice.ts` | Redux Slice | Task list state | `updateTaskStatus`, `updateTaskPriority`, etc. |
| `/web/src/redux/features/taskDetailSlice.ts` | Redux Slice | Detail view state | `fetchTaskDetail`, `fetchSubtasks` |
| `/web/src/hooks/useTaskFieldMutations.ts` | Custom Hooks | Field-specific mutations | `useUpdateTaskStatus()`, `useUpdateTaskEffort()` |
| `/web/src/hooks/useTasks.ts` | Custom Hooks | General mutations | `useUpdateTask()` |
| `/web/src/graphql/mutations/tasks.ts` | GraphQL | Update mutations | UPDATE_TASK, UPDATE_TASK_STATUS, UPDATE_TASK_EFFORT |
| `/web/src/graphql/queries/tasks.ts` | GraphQL | Task queries | GET_PROJECT_TASKS, GET_TASK_BY_ID |

---

## 10. RECOMMENDED NEXT STEPS FOR ENHANCEMENT

1. **Implement Apollo Cache Refetch**:
   - Add `refetchQueries: [{ query: GET_PROJECT_TASKS, variables: { projectId } }]` to mutations
   - OR use `cache.modify()` for immediate updates

2. **Consolidate State Management**:
   - Choose: Redux-only OR Local state-only (not both)
   - Current: Both Redux AND `clonedTasks` can diverge

3. **Improve Error Recovery**:
   - Implement retry mechanism for failed mutations
   - Persist failed updates to retry queue

4. **Event Listener Cleanup**:
   - Ensure all event listeners have proper cleanup functions
   - Consider using a pub-sub library instead of DOM events

5. **TypeScript Safety**:
   - Add strict typing for event detail objects
   - Use discriminated unions for event types

---

## 11. UNRESOLVED QUESTIONS

1. **Does GET_TASK_BY_ID in taskDetailSlice trigger a re-fetch after UPDATE_TASK?**
   - Current: No explicit refetch observed
   - Recommend: Verify with backend logs

2. **Are child_tasks updated in parallel or cascade?**
   - If parent status changes, are child tasks affected?

3. **Does the localStorage persisted filter selection get invalidated on logout?**
   - Could cause issues with cross-user testing

4. **What happens if two users update the same task simultaneously?**
   - Last-write-wins behavior? Or conflict resolution?

5. **Is the assignee cache in useUpdateTaskEffort ever stale?**
   - What if assignee was changed in another tab before effort update?

