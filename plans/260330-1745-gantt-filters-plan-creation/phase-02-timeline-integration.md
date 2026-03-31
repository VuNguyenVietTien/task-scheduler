# Phase 2: Integrate Filters into Timeline.tsx

## Context Links
- Main file: `web/src/components/timeline/Timeline.tsx` (1,514 lines)
- New component: `web/src/components/timeline/gantt-filter-bar.tsx` (from Phase 1)
- Redux tasks: `web/src/redux/features/tasksSlice.ts` (`tasks` state — full Task objects)
- Type: `web/src/types/task.ts` — `GanttFilter`

## Overview
- **Priority:** P2
- **Status:** Completed
- **Description:** Add `ganttFilter` state to `Timeline.tsx`, render `GanttFilterBar` in the toolbar, and compute `visibleTasks` by applying the filter to existing `filteredTasks` (joined with full Redux task data for type/tags).

## Key Insights

### Why we need full task data for type/tags
`orderedTasks` is derived from `taskOrderStore` via `convertTaskOrderToTask` — it only carries:
`taskId, title, priority, status, effort, dates, assigneeId`

`type` and `tags` are NOT stored in `taskOrderStore`. They only exist in the full `tasks` array from `tasksSlice`. So filtering by type/tags requires a lookup: `tasks.find(t => t.task_id === task.task_id)`.

### Existing filteredTasks logic (lines 564–582)
Currently `filteredTasks` filters `orderedTasks` by `viewMode === 'user'` + `selectedUserId`. We extend this by adding Gantt-specific filter as an additional pass, producing `visibleTasks`.

### Avoiding performance issues
- The join (`tasks.find(...)`) is O(n²) but acceptable given typical task counts (<200)
- Wrap in `useMemo` with correct dependencies to avoid re-computation on unrelated renders

## Architecture

```
orderedTaskItems (Redux taskOrderStore)
    ↓ orderedTasks (useMemo — sort logic)
    ↓ filteredTasks (useMemo — user/viewMode filter) [existing]
    ↓ visibleTasks (useMemo — ganttFilter: search/status/priority/type/tags) [NEW]
    ↓ PriorityTaskList + TaskBars rendering
```

## Related Code Files

| File | Action | Description |
|------|--------|-------------|
| `web/src/components/timeline/Timeline.tsx` | Modify | Add state, import, useMemo, render |
| `web/src/components/timeline/gantt-filter-bar.tsx` | Read (from Phase 1) | Import GanttFilterBar |

## Implementation Steps

### Step 1 — Add import at top of Timeline.tsx
```typescript
import { GanttFilterBar } from './gantt-filter-bar';
import { GanttFilter } from '@/types/task';
```

### Step 2 — Add `ganttFilter` state (after existing state declarations ~line 92)
```typescript
const [ganttFilter, setGanttFilter] = useState<GanttFilter>({});
```

### Step 3 — Add `visibleTasks` useMemo (after `filteredTasks` useMemo ~line 582)
```typescript
// Apply gantt-specific filters (type/tags require full task data lookup)
const visibleTasks = useMemo(() => {
  const { searchQuery, status, priority, type, tags } = ganttFilter;
  const hasFilter = searchQuery || status || priority || type || tags?.length;
  if (!hasFilter) return filteredTasks;

  return filteredTasks.filter(task => {
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (status && task.status !== status) return false;
    if (priority && task.priority !== priority) return false;

    // type/tags require full task data
    if (type || tags?.length) {
      const fullTask = tasks.find(t => t.task_id === task.task_id);
      if (type && fullTask?.type !== type) return false;
      if (tags?.length && !tags.some(tag => fullTask?.tags?.includes(tag))) return false;
    }

    return true;
  });
}, [filteredTasks, ganttFilter, tasks]);
```

### Step 4 — Replace `filteredTasks` with `visibleTasks` in render

**In `PriorityTaskList` (project mode, ~line 1169–1180):** no change needed — project mode uses `orderedTasks` directly. But for user mode (~line 1183–1199), replace `filteredTasks` with `visibleTasks`.

**Grid sizing (~lines 1253, 1296, 1302):**
Replace:
```typescript
Math.max(filteredTasks.length, orderedTaskItems.length)
```
With:
```typescript
Math.max(visibleTasks.length, orderedTaskItems.length)
```

**Task bars (~line 1312):**
Replace:
```typescript
{Array.from(new Map(filteredTasks.map(task => [task.task_id, task])).values()).map(...)}
```
With:
```typescript
{Array.from(new Map(visibleTasks.map(task => [task.task_id, task])).values()).map(...)}
```

**Left panel project mode (~line 1169):**
Replace `tasks={orderedTasks}` with `tasks={visibleTasks}` so the left list also respects filters.

### Step 5 — Render `GanttFilterBar` in toolbar

In Row 2 of the toolbar (after the viewMode buttons, ~line 1125), add a `relative` wrapper and render the filter bar:

```typescript
{/* Row 2: View mode + date range + gantt filters */}
<div className="flex gap-2 items-center flex-wrap">
  {/* ...existing viewMode buttons and date pickers... */}

  <div className="h-6 w-px bg-slate-200 mx-2"></div>

  {/* Gantt filters */}
  <div className="relative">
    <GanttFilterBar filter={ganttFilter} onFilterChange={setGanttFilter} />
  </div>
</div>
```

## Todo List
- [ ] Add import for `GanttFilterBar` and `GanttFilter` in `Timeline.tsx`
- [ ] Add `ganttFilter` state
- [ ] Add `visibleTasks` useMemo with correct deps
- [ ] Replace `filteredTasks` → `visibleTasks` in left panel (project mode)
- [ ] Replace `filteredTasks` → `visibleTasks` in user mode panel
- [ ] Replace `filteredTasks` in grid sizing calculations (3 locations)
- [ ] Replace `filteredTasks` in task bars rendering
- [ ] Render `GanttFilterBar` in toolbar Row 2
- [ ] Run compile check: `cd web && npx tsc --noEmit`

## Success Criteria
- Search input filters task list in real time
- Status/priority dropdowns filter correctly
- Type/tags filters work (join with full tasks data)
- Left panel task list and Gantt bars stay in sync
- Grid height adjusts to visible task count
- No TypeScript compile errors

## Risk Assessment
- `tasks.find()` lookup inside filter loop: acceptable for <200 tasks; if perf issue arises, pre-build a Map
- Replacing `orderedTasks` with `visibleTasks` in project mode left panel means drag-reorder still works (operates on taskId, not position)
- Tags filter is OR logic (any matching tag) — confirm with user if AND needed

## Next Steps
→ Phase 3: Scope `handleSavePlan` to use `visibleTasks`
