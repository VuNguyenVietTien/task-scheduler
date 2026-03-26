# Code Review: Task Detail Editable Fields + Task Edit Modal

## Scope
- Files: 6
- LOC: ~6,740 total across reviewed files
- Focus: Recent feature -- inline editable actual dates, task detail modal from Kanban/Timeline/ListView
- Scout findings: drag-vs-click conflict, XSS in comment rendering, inconsistent state sync patterns

## Overall Assessment

Solid feature implementation. The ctrl/middle-click pattern is applied consistently across all three views (Kanban, Timeline, ListView). Actual date fields are wired correctly through the full stack (type definition, GraphQL mutation, hooks, UI). A few high-priority issues around drag-vs-click interaction in Kanban and an existing XSS risk in comment rendering.

---

## Critical Issues

### 1. XSS via dangerouslySetInnerHTML in TaskDetail.tsx (pre-existing)
- **File**: `TaskDetail.tsx:286`
- **Problem**: `renderHTML()` passes raw HTML from comments directly to `dangerouslySetInnerHTML` without sanitization. If comment content comes from user input and the backend doesn't sanitize, this is a stored XSS vector.
- **Impact**: Attacker can inject malicious scripts via comments.
- **Fix**: Use DOMPurify or similar before rendering:
```tsx
import DOMPurify from 'dompurify';
const renderHTML = (html?: string) => {
  if (!html) return null;
  return <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />;
};
```

---

## High Priority

### 2. Drag-vs-Click Conflict in KanbanBoard (KanbanBoard.tsx:640-641)
- **Problem**: The task card has `onClick` and `onMouseDown` handlers on the same element that also has `{...provided.dragHandleProps}` from react-beautiful-dnd. Every completed drag will fire `onClick` when the mouse is released, potentially opening the modal after a drag operation.
- **Impact**: Users dragging a task between columns may unintentionally trigger the detail modal.
- **Fix**: Track drag state and suppress click after drag. The component already has `handleDragEnd` -- use a ref to gate the click:
```tsx
const isDragRef = useRef(false);

// In handleDragEnd:
isDragRef.current = true;
setTimeout(() => { isDragRef.current = false; }, 0);

// In handleTaskCardClick:
if (isDragRef.current) return;
```
Alternatively, react-beautiful-dnd's `onDragStart` callback can set the flag.

### 3. Timeline handleTaskDetailUpdate Does Not Sync to Redux (Timeline.tsx:549-551)
- **Problem**: `handleTaskDetailUpdate` in Timeline only updates local `selectedTaskForDetail` state. It does NOT propagate changes back to the Redux store or the `orderedTasks` array. If a user edits a task's status/dates via the modal, the timeline bars won't reflect the change until a full refetch.
- **Contrast**: KanbanBoard.tsx:317-322 correctly updates both `selectedTask` AND `clonedTasks`.
- **Fix**: Dispatch the update to Redux or update the local task list:
```tsx
const handleTaskDetailUpdate = useCallback((taskId: string, updates: Partial<Task>) => {
  setSelectedTaskForDetail(prev => prev ? { ...prev, ...updates } : null);
  // Also dispatch to Redux so timeline bars update
  // dispatch(updateTaskInStore({ taskId, updates }));
}, []);
```

### 4. TaskListView handleTaskUpdate Also Missing List Sync (TaskListView.tsx:756-765)
- **Problem**: `handleTaskUpdate` only updates `selectedTask` state (the modal's task), but not the task list displayed in the table. After editing via modal, the table row still shows old values.
- **Fix**: Update the tasks array or dispatch to Redux, similar to KanbanBoard's approach.

---

## Medium Priority

### 5. TaskDetail.tsx File Size at 641 Lines
- **Problem**: Exceeds the 200-line guideline from development-rules.md. The component contains comment fetching logic, form handling, and render logic all in one file.
- **Suggestion**: Extract `CommentSection` and `TaskDetailGrid` into separate components.

### 6. TaskDetailPage.tsx at 2,186 Lines
- **Problem**: Significantly exceeds 200-line limit. This is a pre-existing issue but worth noting.

### 7. Mock/Fallback Comment Data in TaskDetail.tsx (lines 145-164, 222-235)
- **Problem**: When comment API fails, mock comments with hardcoded Vietnamese names are shown to the user. In production, this gives false data. The `NODE_ENV === 'development'` guard on line 223 only applies to the comment submission fallback, not to the fetch fallback (line 145 has no such guard).
- **Fix**: Remove mock fallback on fetch failure, show only the error message.

### 8. Missing `fetchComments` in useEffect Dependencies (TaskDetail.tsx:296)
- **Problem**: `useEffect` calls `fetchComments()` but does not include it in the dependency array. This is a React lint warning (exhaustive-deps rule).
- **Fix**: Wrap `fetchComments` in `useCallback` or add to deps.

### 9. Inconsistent Date Format Handling
- **Problem**: `TaskDetail.tsx` appends `T00:00:00Z` to date values (line 255-260), while `useTasks.ts` (line 157) calls `new Date(value).toISOString()`. Double-parsing can shift dates across timezone boundaries.
- **Example**: User picks `2025-03-25`, TaskDetail sends `2025-03-25T00:00:00Z`, then useTasks re-parses to ISO which could produce `2025-03-24T17:00:00Z` for UTC-7 users.
- **Suggestion**: Pick one consistent approach. Ideally send date-only strings and let backend handle timezone.

---

## Low Priority

### 10. Console.log Statements in Production Code
- Multiple `console.log` calls in KanbanBoard (line 277, 390, 409) and Timeline. Should use a logger utility or be removed for production.

### 11. Unused `useRouter` Removal in TaskListView -- Confirmed Clean
- The `useRouter` import and `router` variable were successfully removed with no remaining references.

---

## Edge Cases Found by Scout

1. **Drag-then-click in Kanban**: Completing a drag fires onClick, opening the modal (issue #2 above)
2. **Middle-click on Kanban card**: The `onMouseDown` handler correctly catches middle-click, but it fires on the drag handle element -- could interfere with drag initiation on some browsers
3. **Timezone date shift**: Date values go through two ISO conversions (issue #9)
4. **Stale modal data**: After editing in modal, the parent view (Timeline/ListView) doesn't update its task list (issues #3, #4)
5. **Concurrent modal edit + drag**: If user opens modal in Kanban, then another user drags the same task via websocket event, `clonedTasks` updates but `selectedTask` state in modal becomes stale

---

## Positive Observations

- Ctrl/Meta/Middle-click pattern consistently applied across all three views
- `actual_start_date`/`actual_end_date` correctly wired through entire stack: types, GraphQL, hooks, UI
- KanbanBoard's `handleTaskDetailUpdate` properly syncs both modal state and board state
- TaskBar onClick type signature cleanly updated to pass event without breaking existing callers
- InlineEditableField reuse in TaskDetail.tsx is clean and consistent
- TaskListView child_tasks traversal in handleTaskClick handles nested task lookups

---

## Recommended Actions (Priority Order)

1. **[Critical]** Sanitize HTML in TaskDetail comment rendering (DOMPurify)
2. **[High]** Add drag-vs-click guard in KanbanBoard to prevent modal opening after drag
3. **[High]** Propagate modal updates to parent task lists in Timeline and TaskListView
4. **[Medium]** Remove mock comment fallback in production fetch failure path
5. **[Medium]** Fix `fetchComments` missing from useEffect deps
6. **[Medium]** Standardize date format handling to avoid timezone shifts
7. **[Low]** Remove console.log statements or replace with logger

---

## Metrics

- Type Coverage: Good -- all new props and state properly typed
- Test Coverage: Not assessed (no new tests observed for this feature)
- Linting Issues: ~1 (missing useEffect dependency)

## Unresolved Questions

1. Is the backend sanitizing HTML in comments before storage? If yes, the XSS risk is mitigated but defense-in-depth still warrants client-side sanitization.
2. Should the task-status-updated CustomEvent (fired by TaskDetail.tsx:269) carry the full update payload instead of just signaling a refresh? Currently Timeline and ListView don't listen for it.
3. Is there a plan to add optimistic updates to the TaskDetail modal saves, or is the current loading-spinner approach acceptable?
