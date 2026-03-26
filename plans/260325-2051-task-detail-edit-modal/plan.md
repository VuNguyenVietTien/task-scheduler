---
title: "Task Detail Editable Fields + Task Edit Modal"
description: "Make actual_start/end editable in task detail, add task edit modal to list/kanban/gantt views"
status: complete
priority: P2
effort: 6h
branch: feat/v2.29
tags: [frontend, task-detail, modal, ui]
created: 2026-03-25
---

# Task Detail Editable Fields + Task Edit Modal

## Phases

| # | Phase | Status | Effort | File |
|---|-------|--------|--------|------|
| 1 | Make actual_start/actual_end editable in TaskDetail modal | complete | 1h | [phase-01](./phase-01-editable-actual-dates.md) |
| 2 | Make actual_start/actual_end editable in TaskDetailPage (full page) | complete | 1h | [phase-02](./phase-02-editable-actual-dates-full-page.md) |
| 3 | Add task edit modal to KanbanBoard | complete | 1.5h | [phase-03](./phase-03-kanban-edit-modal.md) |
| 4 | Add task edit modal to Timeline (Gantt) | complete | 1.5h | [phase-04](./phase-04-gantt-edit-modal.md) |
| 5 | Update TaskListView click behavior (modal vs navigate) | complete | 1h | [phase-05](./phase-05-list-view-click-behavior.md) |

## Key Findings

- **Backend already supports** `actual_start_date` and `actual_end_date` in `UpdateTaskInput` and `update.rs` mutation
- **Frontend `useUpdateTask` hook** already maps `actual_start_date`/`actual_end_date` to GraphQL fields
- **TaskDetail component** (modal, `TaskDetail.tsx`) already has inline editing via `InlineEditableField` but **missing** actual_start/end fields
- **TaskDetailPage.tsx** (full page, ~26K tokens) renders actual dates as **read-only text** at lines 1939-1951
- **TaskListView** already has `TaskDetail` modal integration (`selectedTask` + `isTaskDetailOpen` state) but `handleTaskClick` navigates via `router.push()` instead of opening modal
- **KanbanBoard** has no click handler on task cards and no modal
- **Timeline/Gantt** accepts `onTaskClick` prop but `ProjectDetailView` passes it without handler; `TaskBar` calls `onClick?.(task.task_id)` on click
- **Existing Dialog component** (`ui/Dialog.tsx`) uses Headless UI Transition; already used by `TaskDetail`

## Dependencies

- `InlineEditableField` component (exists at `frontend/src/components/tasks/inline-editable-field.tsx`)
- `Dialog` component (exists at `frontend/src/components/ui/Dialog.tsx`)
- `useUpdateTask` hook (exists at `frontend/src/hooks/useTasks.ts`)
- `TaskDetail` component (exists — modal with inline editing, comments)

## Architecture Decision

Reuse existing `TaskDetail` modal component across all views (List, Kanban, Gantt).
- Left click -> open `TaskDetail` modal
- Middle click / Ctrl+click -> navigate to full task detail page (existing behavior)
- No new components needed; just wire existing modal into Kanban and Gantt views

## Unresolved Questions

1. Should Gantt TaskBar tooltip be updated to show "click to edit" hint?
2. Should the modal show the rich-text editor for description (like TaskDetailPage) or keep the simple textarea (like current TaskDetail)?
