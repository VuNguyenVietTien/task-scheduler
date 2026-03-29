---
phase: 2
title: "Fix TaskDetail Redux Sync After Save"
status: completed
priority: P1
effort: 30m
---

# Phase 2: Fix TaskDetail Redux Sync After Save

## Context
- [Parent Plan](./plan.md)
- Depends on: [Phase 1](./phase-01-fix-timeline-update.md) (needs `updateTaskLocally` reducer)

## Overview
`TaskDetail.tsx` saves fields via `useTasks.updateTask()` then calls `onTaskUpdate` callback. This only updates the parent's local state. Redux store stays stale, so any other view reading from Redux won't see the change.

## Key Insight
The `saveField` function at `TaskDetail.tsx:128-131`:
```typescript
await updateTask(taskId, updates);
setEditingField(null);
if (onTaskUpdate) onTaskUpdate(taskId, updates);
```

This works for the direct parent (KanbanBoard/Timeline via callback), but:
- Other components reading Redux `tasks` state don't get the update
- Event broadcasting (`window.dispatchEvent`) is NOT called for general field saves — only field-specific hooks do this

## Related Code Files

| File | Action | Purpose |
|------|--------|---------|
| `web/src/components/tasks/TaskDetail.tsx` | MODIFY | Dispatch Redux update after save |
| `web/src/redux/features/tasksSlice.ts` | READ | Use `updateTaskLocally` from Phase 1 |

## Implementation Steps

### Step 1: Add Redux dispatch to TaskDetail

Import `useAppDispatch` and `updateTaskLocally` in TaskDetail. After successful `updateTask()` mutation, dispatch the update to Redux:

```typescript
import { useAppDispatch } from '@/redux/hooks';
import { updateTaskLocally } from '@/redux/features/tasksSlice';

// Inside component:
const dispatch = useAppDispatch();

// In saveField, after await updateTask(taskId, updates):
dispatch(updateTaskLocally({ taskId, updates }));
```

This ensures ALL views reading from Redux tasks state see the change immediately.

### Step 2: Verify KanbanBoard reactivity

KanbanBoard has a `useEffect` that syncs from `tasksState.tasks`:
```typescript
useEffect(() => {
  if (tasksState.tasks.length > 0) {
    const projectTasks = tasksState.tasks.filter(...);
    updateClonedTasks(projectTasks);
  }
}, [tasks, tasksState, projectId, updateClonedTasks]);
```

After dispatching `updateTaskLocally`, this effect should fire and update `clonedTasks`. Verify this works — the KanbanBoard's existing `handleTaskDetailUpdate` callback already handles local state, so this provides a second sync path via Redux.

### Step 3: Remove redundant local state updates (optional cleanup)

If Redux dispatch in TaskDetail works correctly, the `onTaskUpdate` callbacks in KanbanBoard and Timeline become redundant for data sync (they still serve to update `selectedTask` modal state). Consider simplifying but NOT required for this fix.

## Todo

- [ ] Import dispatch + updateTaskLocally in TaskDetail
- [ ] Dispatch after successful save in `saveField`
- [ ] Test: edit task in modal from Kanban → Kanban columns update
- [ ] Test: edit task in modal from Timeline → Gantt bars update
- [ ] Test: edit task in modal → TaskListView updates (if visible)

## Success Criteria

- All views reading from Redux tasks state update immediately after modal save
- No full data refetch triggered
- Both callback AND Redux paths work (belt and suspenders)

## Risk Assessment

- **Low**: Adding a dispatch call is additive, doesn't change existing callback flow
- **Low**: `updateTaskLocally` is synchronous — no race conditions with the mutation response

## Security Considerations
- No security impact — purely frontend state management change
