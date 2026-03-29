---
title: "Fix Real-Time Task Updates in Modal/Gantt/Kanban"
description: "Ensure task edits in detail modal reflect immediately in Gantt and Kanban views without full refetch"
status: completed
priority: P1
effort: 2h
branch: feat/vercel-supabase-migration
tags: [bugfix, ux, state-management, redux]
created: 2026-03-29
---

# Fix Real-Time Task Updates in Modal/Gantt/Kanban

## Problem

When editing task fields (status, dates, etc.) in the task detail modal opened from Gantt chart or Kanban board, changes don't reflect in the parent view until a full page reload or data refetch. Poor UX.

## Root Cause Analysis

Two distinct issues found:

### Issue 1: Timeline `handleTaskDetailUpdate` doesn't update task list
- **File**: `web/src/components/timeline/Timeline.tsx:547-549`
- `handleTaskDetailUpdate` only updates `selectedTaskForDetail` (the modal's local state)
- It does NOT update `orderedTasks` or Redux state, so the Gantt bars don't change
- KanbanBoard correctly updates both `selectedTask` AND `clonedTasks` — Timeline is missing the second part

### Issue 2: Redux store not updated after modal save
- `TaskDetail.tsx:131` calls `onTaskUpdate(taskId, updates)` after save
- This callback only updates local component state in parent views
- The Redux `tasksSlice` is never updated, so other components reading from Redux stay stale
- No `window.dispatchEvent` calls for cross-component sync

## Solution

**Phase 1**: Fix Timeline's `handleTaskDetailUpdate` to also update the task in `orderedTasks` / Redux store
**Phase 2**: Fix TaskDetail to dispatch Redux update after successful save so all views stay in sync

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 1 | [Fix Timeline task update propagation](./phase-01-fix-timeline-update.md) | completed | phase-01 |
| 2 | [Fix TaskDetail Redux sync after save](./phase-02-fix-taskdetail-redux-sync.md) | completed | phase-02 |

## Key Dependencies

- `web/src/components/timeline/Timeline.tsx` — Gantt chart view
- `web/src/components/tasks/KanbanBoard.tsx` — Kanban board view (reference for correct pattern)
- `web/src/components/tasks/TaskDetail.tsx` — Task detail modal
- `web/src/redux/features/tasksSlice.ts` — Redux tasks state
- `web/src/redux/features/taskOrderStore.ts` — Task ordering for Gantt

## Success Criteria

- [ ] Editing status in modal updates Kanban columns immediately
- [ ] Editing dates in modal updates Gantt bars immediately
- [ ] No full data refetch triggered
- [ ] No regressions in drag-drop or inline editing
