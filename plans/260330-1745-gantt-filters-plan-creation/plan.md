---
title: "Gantt Chart Filters & Plan Creation Scoping"
description: "Add type/tags/status/priority filters to Gantt chart tab and limit plan creation to currently visible tasks."
status: completed
priority: P2
effort: 4h
issue:
branch: feat/vercel-supabase-migration
tags: [frontend, feature]
created: 2026-03-30
---

# Gantt Chart Filters & Plan Creation Scoping

## Overview

Two related improvements to `Timeline.tsx` (Gantt chart on `projects/[id]`):

1. **Gantt Filters** — Add filter bar above the Gantt allowing users to filter displayed tasks by type, tags, status, and priority.
2. **Plan creation scoping** — When saving a plan ("Lưu kế hoạch"), only include tasks currently visible on screen (i.e., passing the active filters), not all tasks.

## Context

- **Main file:** `web/src/components/timeline/Timeline.tsx` (1,514 lines)
- `orderedTasks` = lightweight Task objects from Redux `taskOrderStore` (no `type`/`tags`/`category`)
- `filteredTasks` = `orderedTasks` filtered by viewMode/user — drives all rendering
- Full task data (type, tags, category) lives in Redux `tasksSlice` (`tasks` state)
- `handleSavePlan` (line 814–887) collects from `orderedTaskItems`, filtered only by DONE/CLOSE status

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Create GanttFilterBar component | Pending | 1.5h | [phase-01](./phase-01-gantt-filter-bar.md) |
| 2 | Integrate filters into Timeline | Pending | 1.5h | [phase-02](./phase-02-timeline-integration.md) |
| 3 | Scope plan creation to visible tasks | Pending | 1h | [phase-03](./phase-03-plan-creation-scoping.md) |

## Dependencies

- No backend changes needed — purely frontend state/filter logic
- Timeline.tsx is the single entry point for both changes
- Full task data from `tasksSlice` needed for type/tags filtering
