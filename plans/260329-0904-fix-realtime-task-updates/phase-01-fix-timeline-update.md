---
phase: 1
title: "Fix Timeline handleTaskDetailUpdate"
status: completed
priority: P1
effort: 30m
---

# Phase 1: Fix Timeline Task Update Propagation

## Context
- [Parent Plan](./plan.md)
- Branch: `feat/vercel-supabase-migration`

## Overview
Timeline's `handleTaskDetailUpdate` only updates the modal's local state (`selectedTaskForDetail`) but doesn't propagate changes to `orderedTasks` or Redux. KanbanBoard does this correctly — Timeline is missing the same pattern.

## Key Insight
KanbanBoard at `KanbanBoard.tsx:322-327` updates BOTH `selectedTask` AND `clonedTasks`. Timeline at `Timeline.tsx:547-549` only updates `selectedTaskForDetail`.

The Timeline uses `orderedTasks` from Redux (`taskOrderStore`) for rendering Gantt bars. After modal save, these ordered tasks remain stale.

## Related Code Files

| File | Action | Purpose |
|------|--------|---------|
| `web/src/components/timeline/Timeline.tsx` | MODIFY | Fix `handleTaskDetailUpdate` callback |
| `web/src/redux/features/tasksSlice.ts` | MODIFY | Add `updateTaskLocally` sync reducer |
| `web/src/redux/features/taskOrderStore.ts` | READ | Understand ordered task structure |

## Implementation Steps

### Step 1: Add `updateTaskLocally` reducer to `tasksSlice.ts`

Currently there's no synchronous reducer to update a single task's fields in the Redux tasks array. Add one:

```typescript
// In reducers: { ... }
updateTaskLocally: (state, action: PayloadAction<{ taskId: string; updates: Partial<Task> }>) => {
  const { taskId, updates } = action.payload;
  const idx = state.tasks.findIndex(t => t.task_id === taskId || t.id === taskId);
  if (idx >= 0) {
    state.tasks[idx] = { ...state.tasks[idx], ...updates };
  }
},
```

Export it from the slice actions.

### Step 2: Fix Timeline `handleTaskDetailUpdate`

Update the callback at `Timeline.tsx:547-549` to:

1. Update `selectedTaskForDetail` (already done)
2. Dispatch `updateTaskLocally` to sync Redux `tasks` state
3. Update `orderedTasks` in taskOrderStore if dates changed

```typescript
const handleTaskDetailUpdate = useCallback((taskId: string, updates: Partial<Task>) => {
  // 1. Update modal state
  setSelectedTaskForDetail(prev => prev ? { ...prev, ...updates } : null);

  // 2. Sync Redux tasks state
  dispatch(updateTaskLocally({ taskId, updates }));

  // 3. If dates changed, update taskOrderStore calculated dates
  if (updates.start_date || updates.due_date) {
    // orderedTasks will re-derive from Redux tasks on next render
  }
}, [dispatch]);
```

### Step 3: Verify ordered tasks reactivity

The Timeline reads `orderedTasks` from `taskOrderStore`. Check if `orderedTasks` derives from `tasksSlice.tasks` reactively. If not, the Timeline also needs to update `taskOrderStore.orderedTasks` directly when task fields change from the modal.

Check the `useEffect` that syncs tasks → orderedTasks and ensure it triggers on Redux task updates.

## Todo

- [ ] Add `updateTaskLocally` reducer to tasksSlice
- [ ] Fix Timeline `handleTaskDetailUpdate` to dispatch Redux update
- [ ] Verify Gantt bars re-render after Redux update
- [ ] Test: edit status in modal → Gantt reflects change
- [ ] Test: edit dates in modal → Gantt bars reposition

## Success Criteria

- Gantt chart bars update position/color immediately after saving in modal
- No full page reload or data refetch needed
- No regression in drag-drop reordering

## Risk Assessment

- **Low**: `updateTaskLocally` is a simple synchronous reducer — no API calls
- **Medium**: `taskOrderStore.orderedTasks` may not reactively update from `tasksSlice.tasks` — need to verify the sync `useEffect`
