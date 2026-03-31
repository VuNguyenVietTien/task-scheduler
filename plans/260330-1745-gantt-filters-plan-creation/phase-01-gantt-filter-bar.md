# Phase 1: Create GanttFilterBar Component

## Context Links
- Main file: `web/src/components/timeline/Timeline.tsx`
- Filter types: `web/src/types/task.ts` (TaskType, TaskTag, TaskStatus, Priority)
- Display labels: `web/src/constants/task-display-labels.ts`
- Reference: `web/src/components/tasks/TaskFilterBar.tsx` (existing filter pattern)

## Overview
- **Priority:** P2
- **Status:** Completed
- **Description:** Create a compact filter bar component specifically for the Gantt chart. Filters: search (title), status, priority, type, tags.

## Key Insights
- `orderedTasks` from taskOrderStore only has: taskId, title, priority, status, effort, dates — NO type/tags/category
- For type/tags filtering, must join with full `tasks` from `tasksSlice` (lookup by task_id)
- Existing `TaskFilterBar` is too heavy (supports project/assignee/dates) — create a lean `GanttFilterBar`
- TaskType values: `'Feature' | 'Bug' | 'Enhancement' | 'Documentation'`
- TaskTag values: `'Urgent' | 'High Priority' | 'Low Priority' | 'In Progress' | 'Blocked'`
- TaskStatus: 9 values (TODO, DOING, DONE, CLOSE, PENDING, REVIEW, BLOCKED, REJECTED, ARCHIVED)
- Priority: 5 values (LOW, MEDIUM, HIGH, URGENT, CRITICAL)
- Vietnamese labels exist in `task-display-labels.ts` for status/priority

## Requirements
- Filter fields: search text, status (single), priority (single), type (single), tags (multi-select)
- "Clear all" button to reset all filters
- Active filter count badge on a toggle button (to save horizontal space)
- Compact design — fits in the existing toolbar row

## Architecture

```
GanttFilterBar
  Props:
    filter: GanttFilter
    onFilterChange: (filter: GanttFilter) => void

  UI:
    - Search input (inline, always visible)
    - Filter toggle button with active-count badge
    - Collapsible filter panel: status, priority, type, tags dropdowns
```

### GanttFilter type (add to `web/src/types/task.ts`)
```typescript
export interface GanttFilter {
  searchQuery?: string;
  status?: TaskStatus;
  priority?: Priority;
  type?: TaskType;
  tags?: TaskTag[];
}
```

## Related Code Files

| File | Action | Description |
|------|--------|-------------|
| `web/src/types/task.ts` | Modify | Add `GanttFilter` interface |
| `web/src/components/timeline/gantt-filter-bar.tsx` | Create | New GanttFilterBar component |
| `web/src/constants/task-display-labels.ts` | Read | Use existing Vietnamese labels |

## Implementation Steps

1. **Add `GanttFilter` interface to `web/src/types/task.ts`** (after `TaskFilter` interface):
```typescript
export interface GanttFilter {
  searchQuery?: string;
  status?: TaskStatus;
  priority?: Priority;
  type?: TaskType;
  tags?: TaskTag[];
}
```

2. **Create `web/src/components/timeline/gantt-filter-bar.tsx`**:
```typescript
'use client';

import { GanttFilter, TaskType, TaskTag, TaskStatus, Priority, TASK_TYPES, TASK_TAGS, TaskStatuses, Priorities } from '@/types/task';
import { STATUS_LABELS, PRIORITY_LABELS } from '@/constants/task-display-labels';
import { useState } from 'react';
import { FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface GanttFilterBarProps {
  filter: GanttFilter;
  onFilterChange: (filter: GanttFilter) => void;
}

export function GanttFilterBar({ filter, onFilterChange }: GanttFilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeCount = [
    filter.status,
    filter.priority,
    filter.type,
    filter.tags?.length,
  ].filter(Boolean).length;

  const handleClear = () => onFilterChange({});

  const update = (updates: Partial<GanttFilter>) =>
    onFilterChange({ ...filter, ...updates });

  return (
    <div className="flex items-center gap-2">
      {/* Search */}
      <input
        type="text"
        placeholder="Tìm task..."
        value={filter.searchQuery || ''}
        onChange={e => update({ searchQuery: e.target.value || undefined })}
        className="px-2 py-1 text-sm border rounded w-36"
      />

      {/* Filter toggle */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className={`relative flex items-center gap-1 px-2 py-1 text-sm border rounded ${isOpen ? 'bg-blue-50 border-blue-300' : 'bg-white'}`}
      >
        <FunnelIcon className="h-4 w-4" />
        <span>Lọc</span>
        {activeCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {/* Clear */}
      {activeCount > 0 && (
        <button onClick={handleClear} className="p-1 text-slate-400 hover:text-slate-600">
          <XMarkIcon className="h-4 w-4" />
        </button>
      )}

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute z-50 mt-1 top-full left-0 bg-white border rounded-lg shadow-lg p-3 flex gap-3 flex-wrap min-w-[480px]">
          {/* Status */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Trạng thái</label>
            <select
              value={filter.status || ''}
              onChange={e => update({ status: (e.target.value as TaskStatus) || undefined })}
              className="px-2 py-1 text-sm border rounded"
            >
              <option value="">Tất cả</option>
              {Object.values(TaskStatuses).map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Ưu tiên</label>
            <select
              value={filter.priority || ''}
              onChange={e => update({ priority: (e.target.value as Priority) || undefined })}
              className="px-2 py-1 text-sm border rounded"
            >
              <option value="">Tất cả</option>
              {Object.values(Priorities).map(p => (
                <option key={p} value={p}>{PRIORITY_LABELS[p] || p}</option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Loại</label>
            <select
              value={filter.type || ''}
              onChange={e => update({ type: (e.target.value as TaskType) || undefined })}
              className="px-2 py-1 text-sm border rounded"
            >
              <option value="">Tất cả</option>
              {TASK_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Tags</label>
            <div className="flex flex-wrap gap-1">
              {TASK_TAGS.map(tag => {
                const active = filter.tags?.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      const current = filter.tags || [];
                      update({
                        tags: active ? current.filter(t => t !== tag) : [...current, tag]
                      });
                    }}
                    className={`px-2 py-0.5 text-xs rounded border ${active ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-slate-300 text-slate-600'}`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

Note: The dropdown needs `relative` positioning on the parent wrapper. Adjust styling to match project design system.

## Todo List
- [ ] Add `GanttFilter` interface to `web/src/types/task.ts`
- [ ] Create `web/src/components/timeline/gantt-filter-bar.tsx`
- [ ] Verify STATUS_LABELS and PRIORITY_LABELS keys match TaskStatus/Priority values in `task-display-labels.ts`

## Success Criteria
- Component renders with search + filter toggle button
- Badge shows active filter count
- Status, priority, type selects work correctly
- Tags multi-select toggles correctly
- Clear button resets all filters

## Risk Assessment
- STATUS_LABELS keys may not match TaskStatus values exactly → check `task-display-labels.ts` before implementing
- Dropdown z-index may conflict with sticky toolbar → use portal or adjust z-index

## Next Steps
→ Phase 2: Integrate `GanttFilterBar` into `Timeline.tsx`
