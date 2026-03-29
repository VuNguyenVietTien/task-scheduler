# Code Review: Real-Time Task Update Propagation

## Scope
- Files: `tasksSlice.ts`, `Timeline.tsx`, `TaskDetail.tsx`
- Focus: Realtime sync of task edits across Gantt/Kanban/TaskList views
- Branch: `feat/vercel-supabase-migration`
- Diff includes additional refactoring: camelCase->snake_case API migration, status/priority casing to UPPERCASE, date-clearing support, removal of redundant `GET_TASK_MINIMAL` prefetch

## Overall Assessment

The core fix (adding `updateTaskLocally` reducer + dispatching it from `TaskDetail.saveField` and `Timeline.handleTaskDetailUpdate`) is **correct and well-structured**. The approach of using a synchronous Redux reducer for optimistic local sync is the right pattern. However, there is one significant gap in Kanban and two minor issues.

---

## Critical Issues

None.

---

## High Priority

### 1. KanbanBoard does NOT dispatch `updateTaskLocally` -- stale Redux state

**File:** `web/src/components/tasks/KanbanBoard.tsx:322-327`

KanbanBoard's `handleTaskDetailUpdate` updates only `selectedTask` and `clonedTasks` (local state) but does NOT dispatch `updateTaskLocally`. This means:
- If a user edits a task in Kanban's modal, then navigates to Gantt, the Gantt will show **stale data** until a full refetch
- The `TaskDetail` component itself dispatches `updateTaskLocally` (line 135), so the Redux store IS updated. **However**, the `onTaskUpdate` callback in KanbanBoard does redundant local-only work without benefiting from the centralized approach

This is not a regression (KanbanBoard already had local-state sync) but is an inconsistency. Since `TaskDetail` now handles Redux dispatch itself, Kanban's `handleTaskDetailUpdate` is partially redundant -- it still needs to update `clonedTasks` (local DnD state) but the `selectedTask` update is duplicated.

**Impact:** Medium -- functional but inconsistent. Cross-view sync works because `TaskDetail.saveField` dispatches to Redux directly.

**Suggestion:** Add `dispatch(updateTaskLocally({ taskId, updates }))` to KanbanBoard's `handleTaskDetailUpdate` for consistency, OR document that `TaskDetail` is the single source of Redux sync.

### 2. Gantt bars derive from `taskOrderStore`, not `tasksSlice` -- indirect propagation path

**Data flow:**
```
updateTaskLocally -> tasksSlice.tasks updated
                  -> useEffect (line 388, 100ms debounce)
                  -> processTasksAndUpdateStore()
                  -> taskOrderStore.orderedTasks updated
                  -> orderedTasks memo recalculated
                  -> filteredTasks memo recalculated
                  -> Gantt bars re-render
```

The fix works, but users will see a ~100ms delay before Gantt bars update. This is acceptable for most cases. However, note:
- If `activePlan` is set, the useEffect at line 394 **returns early** without calling `processTasksAndUpdateStore`. This means **Gantt bars will NOT update when a plan is active**.
- The `orderedTasks` memo at line 479 reads from `orderedTaskItems` (taskOrderStore), which never gets updated in the plan-active path.

**Impact:** High when plans are active -- task edits in modal won't reflect in Gantt bars.

**Fix:** When `activePlan` is truthy, also update the corresponding `TaskOrderItem` in `taskOrderStore` directly, or adjust the plan-path useEffect to also handle individual task field updates.

---

## Medium Priority

### 3. Dead code: `GET_TASK_MINIMAL` query

**File:** `web/src/redux/features/tasksSlice.ts:42-50`

`GET_TASK_MINIMAL` is defined and exported but never called. All call sites were removed during the API migration (the thunks no longer prefetch `parentTaskId`).

**Fix:** Remove the query definition and its import of `gql`.

### 4. Double dispatch: `TaskDetail` dispatches to Redux, then `onTaskUpdate` callback also dispatches

**File:** `web/src/components/tasks/TaskDetail.tsx:135-136`

```typescript
dispatch(updateTaskLocally({ taskId, updates }));  // line 135
if (onTaskUpdate) onTaskUpdate(taskId, updates);   // line 136
```

In Timeline, `onTaskUpdate = handleTaskDetailUpdate` which ALSO dispatches `updateTaskLocally`:

```typescript
const handleTaskDetailUpdate = useCallback((taskId: string, updates: Partial<Task>) => {
    setSelectedTaskForDetail(prev => prev ? { ...prev, ...updates } : null);
    dispatch(updateTaskLocally({ taskId, updates }));  // DUPLICATE dispatch
}, [dispatch]);
```

The second dispatch is harmless (idempotent spread) but wasteful -- it triggers an extra Redux state update and re-render cycle.

**Fix:** Remove the `dispatch(updateTaskLocally(...))` from `Timeline.handleTaskDetailUpdate` since `TaskDetail` already handles it. Keep only the `setSelectedTaskForDetail` update.

### 5. Excessive console.log statements

Multiple `console.log` calls remain across all three files (e.g., "Response tu server", "Recalculating orderedTasks", "Sap xep tasks"). These should be removed or converted to conditional debug logging before production.

---

## Low Priority

### 6. `gql` import in `tasksSlice.ts` only needed for dead `GET_TASK_MINIMAL`

If the dead query is removed, the `gql` import from `@apollo/client` can also be removed (check if other code in the file uses it).

---

## Edge Cases Found

1. **Plan-active mode blocks Gantt sync** -- Most critical edge case. When `activePlan` is set, the useEffect that propagates `tasksSlice` changes to `taskOrderStore` returns early.
2. **Concurrent edits** -- If two users edit the same task, `updateTaskLocally` will apply the last-write-wins locally. This is acceptable for optimistic updates but could show flickering if a refetch arrives mid-edit.
3. **Date clearing** -- `null` vs `undefined` handling is improved (date fields now send `null` to clear), but `effort` and `progress` still use `undefined` which may not clear the field on the backend depending on API behavior.

---

## Positive Observations

- `updateTaskLocally` reducer is clean, uses Immer-friendly spread pattern
- Consistent UPPERCASE status/priority migration across all comparison points
- Removal of redundant `GET_TASK_MINIMAL` prefetch calls eliminates N+1 query pattern in thunks
- `transformTaskFromAPI` correctly updated to snake_case field mapping
- Weekend-skipping logic for default start dates is a nice UX touch

---

## Recommended Actions (Prioritized)

1. **[HIGH]** Fix plan-active path: ensure Gantt bars update when tasks are edited while a plan is active
2. **[MEDIUM]** Remove duplicate `dispatch(updateTaskLocally(...))` from `Timeline.handleTaskDetailUpdate` -- `TaskDetail` already dispatches
3. **[LOW]** Remove dead `GET_TASK_MINIMAL` query
4. **[LOW]** Clean up console.log statements

---

## Plan TODO Verification

| Success Criteria | Status |
|---|---|
| Editing status in modal updates Kanban columns immediately | PASS (via `TaskDetail` dispatch + `clonedTasks` local update) |
| Editing dates in modal updates Gantt bars immediately | PARTIAL -- works without plan, fails with active plan |
| No full data refetch triggered | PASS |
| No regressions in drag-drop or inline editing | PASS (drag logic untouched, status comparisons updated to UPPERCASE) |

---

## Unresolved Questions

1. Does the backend accept `null` for date fields to clear them, or does it expect the field to be omitted?
2. Is there a test for the plan-active + task-edit scenario?
3. Should `effort: undefined` and `progress: undefined` be changed to `null` for consistency with date fields?
