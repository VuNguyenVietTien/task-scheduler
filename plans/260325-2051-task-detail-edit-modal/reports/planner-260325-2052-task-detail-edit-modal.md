# Planner Report: Task Detail Edit Modal

## Research Summary

### Backend (Rust)
- `UpdateTaskInput` (`backend/src/graphql/types/task.rs:232`) already has `actual_start_date` and `actual_end_date` as `Option<DateTime<Utc>>`
- `update.rs` mutation binds these fields at positions $8 and $9 in the SQL query
- **No backend changes needed**

### Frontend - Data Layer
- `useUpdateTask` hook (`frontend/src/hooks/useTasks.ts`) already maps `actual_start_date` -> `actualStartDate` and `actual_end_date` -> `actualEndDate`
- GraphQL `UPDATE_TASK` mutation (`frontend/src/graphql/mutations/tasks.ts`) already requests `actualStartDate`/`actualEndDate` in response
- Task type (`frontend/src/types/task.ts`) already has `actual_start_date?: string` and `actual_end_date?: string`
- **No data layer changes needed**

### Frontend - TaskDetail Modal (`TaskDetail.tsx`)
- Already uses `InlineEditableField` for inline editing of title, status, priority, start_date, due_date, effort, progress
- `handleFieldSave` switch (line 250) handles field-by-field saves via `useUpdateTask`
- **Missing**: actual_start_date and actual_end_date cases in switch + corresponding UI fields
- Fix: add 2 switch cases + 2 `InlineEditableField` blocks in the detail grid

### Frontend - TaskDetailPage.tsx (Full Page)
- Large file (~26K tokens). Renders actual dates as read-only text at lines 1939-1951
- Uses Vietnamese labels: "Ngay bat dau thuc te" / "Ngay ket thuc thuc te"
- **Fix**: replace read-only spans with editable date components

### Frontend - TaskListView
- Already has `selectedTask` state, `isTaskDetailOpen` state, and renders `<TaskDetail>` modal (lines 1554-1562)
- BUT `handleTaskClick` (line 727) navigates via `router.push()` — the modal is never shown via click
- **Fix**: change handleTaskClick to open modal on left-click, navigate on ctrl/middle-click

### Frontend - KanbanBoard
- Task cards inside `<Draggable>` wrappers have NO onClick handler
- Only drag behavior is implemented
- **Fix**: add onClick on card div, add modal state, render TaskDetail

### Frontend - Timeline/Gantt
- `Timeline` accepts `onTaskClick` prop but `ProjectDetailView` doesn't pass it
- `TaskBar` calls `onClick?.(task.task_id)` on click
- GanttChart.tsx is an empty file (0 lines) — the actual Gantt is `Timeline.tsx`
- **Fix**: add modal handling inside Timeline, update TaskBar onClick to pass MouseEvent

### Reusable Components
- `Dialog` (`frontend/src/components/ui/Dialog.tsx`) — Headless UI-based modal, already used by TaskDetail
- `InlineEditableField` (`frontend/src/components/tasks/inline-editable-field.tsx`) — click-to-edit with text/date/select/number support

## Effort Estimate: ~6 hours total
- Phase 1 (TaskDetail modal actual dates): 1h
- Phase 2 (TaskDetailPage actual dates): 1h
- Phase 3 (Kanban modal): 1.5h
- Phase 4 (Gantt modal): 1.5h
- Phase 5 (List view click behavior): 1h
