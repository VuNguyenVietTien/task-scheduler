# Phase 3: Scope Plan Creation to Visible Tasks

## Context Links
- Main file: `web/src/components/timeline/Timeline.tsx` — `handleSavePlan` (lines 814–887)
- Type: `web/src/types/plan.ts` — `CreatePlanTaskDataInput`
- Redux store: `web/src/redux/features/taskOrderStore.ts` — `selectCalculatedTaskDates`

## Overview
- **Priority:** P2
- **Status:** Completed
- **Description:** Modify `handleSavePlan` to collect only `visibleTasks` (currently displayed after filters) instead of all `orderedTaskItems`. This ensures the saved plan reflects exactly what the user sees.

## Key Insights

### Current behavior (lines 826–860)
```typescript
// Filters only DONE/CLOSE from ALL orderedTaskItems
const activeOrderedItems = orderedTaskItems.filter(
  item => !['DONE', 'CLOSE'].includes(item.status?.toUpperCase() || '')
);
const planTasks = activeOrderedItems.map((item, index) => { ... });
```

Source is `orderedTaskItems` (Redux `TaskOrderItem[]`) — lightweight, has dates/effort/priority but requires `calculatedTaskDates` lookup for computed dates.

### New behavior
Source becomes `visibleTasks` (Task[] from Phase 2 — already filtered by user's active filters).

`visibleTasks` are `Task` objects from `convertTaskOrderToTask`, so they have:
- `task_id`, `title`, `priority`, `status`, `effort`, `priority_order`
- `start_date`, `due_date` (from taskOrderStore conversion)
- `assignee.userId`

We still need `calculatedTaskDates` for computed start/end dates (same as before).

### Priority order mapping
`orderedTaskItems[i].priorityOrder` maps 1:1 with `orderedTaskItems` index. For `visibleTasks`, we need the priorityOrder from the original `orderedTaskItems` lookup — or use the Task's `priority_order` field (set by `convertTaskOrderToTask`).

## Related Code Files

| File | Action | Description |
|------|--------|-------------|
| `web/src/components/timeline/Timeline.tsx` | Modify | Update `handleSavePlan` + its `useCallback` deps |

## Implementation Steps

### Step 1 — Update `handleSavePlan` useCallback

Replace the task collection block (lines 825–860) with:

```typescript
// Use visibleTasks (currently displayed) instead of all orderedTaskItems
// Still filter out DONE/CLOSE as they shouldn't be in a plan
const activeVisibleTasks = visibleTasks.filter(
  task => !['DONE', 'CLOSE'].includes(task.status?.toUpperCase() || '')
);

const planTasks: CreatePlanTaskDataInput[] = activeVisibleTasks.map(task => {
  const calculatedDates = typeof calculatedTaskDates === 'object' && calculatedTaskDates !== null
    ? calculatedTaskDates[task.task_id]
    : undefined;

  const startDate = task.start_date ||
    (calculatedDates && calculatedDates.startDate) ||
    '';
  const endDate = task.due_date ||
    (calculatedDates && calculatedDates.endDate) ||
    '';

  let taskPriority = task.priority as Priority | undefined;
  if (taskPriority && !['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL'].includes(taskPriority)) {
    taskPriority = 'MEDIUM';
  }

  return {
    taskId: task.task_id,
    title: task.title,
    priorityOrder: task.priority_order,
    startDate,
    endDate,
    effort: task.effort,
    assigneeId: task.assignee?.userId,
    priority: taskPriority,
    status: task.status,
  };
});
```

### Step 2 — Update `useCallback` dependencies

Change the deps array of `handleSavePlan` from:
```typescript
}, [planName, currentProjectId, orderedTaskItems, calculatedTaskDates, dispatch]);
```
To:
```typescript
}, [planName, currentProjectId, visibleTasks, calculatedTaskDates, dispatch]);
```

### Step 3 — Keep "Lưu kế hoạch" button behavior unchanged
The button already calls `handleSavePlan` only after the dialog confirms the plan name — no UI change needed.

Optionally, add a tooltip/hint on the button:
```typescript
title={`Lưu kế hoạch (${visibleTasks.filter(t => !['DONE','CLOSE'].includes(t.status)).length} tasks hiển thị)`}
```

This gives users clear feedback on how many tasks will be saved.

## Todo List
- [ ] Replace task collection logic in `handleSavePlan` (lines 826–860)
- [ ] Update `useCallback` dependency array
- [ ] (Optional) Update button tooltip to show visible task count
- [ ] Run compile check: `cd web && npx tsc --noEmit`
- [ ] Manual test: apply a filter, save plan, verify plan only contains filtered tasks

## Success Criteria
- With no filters active: plan saves all non-DONE/CLOSE tasks (same as before)
- With status filter active: plan only saves tasks matching that status
- With type filter active: plan only saves tasks of that type
- Plan task count matches visible task list count (excluding DONE/CLOSE)
- No TypeScript errors

## Risk Assessment
- `task.start_date` vs `item.startDate`: `convertTaskOrderToTask` maps `item.startDate → task.start_date` and `item.endDate → task.due_date` — verify in `taskScheduler.ts` before implementing
- If `visibleTasks` is empty due to aggressive filtering, plan will be saved with 0 tasks — add a guard with a toast warning if `activeVisibleTasks.length === 0`

## Security Considerations
- No API surface changes — same GraphQL mutation, same auth checks
- Plan data is scoped to `currentProjectId` (unchanged)

## Next Steps
- After all 3 phases: run `cd web && npx tsc --noEmit` to verify no compile errors
- Manual QA on the Gantt tab: test each filter, then save plan and verify contents
