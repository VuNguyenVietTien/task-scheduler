---
title: "UI Refactor: Sidebar Tree + Role-Based Dashboard"
description: "Refactor sidebar to tree-style navigation with project tabs, add role-based dashboard, compress project detail view, fix Gantt buttons, add task type column"
status: complete
priority: P1
effort: 16h
branch: feat/v2.30
tags: [ui, refactor, sidebar, dashboard, frontend]
created: 2026-03-25
---

# UI Refactor: Sidebar Tree + Role-Based Dashboard

## Phases

| # | Phase | Effort | Status |
|---|-------|--------|--------|
| 1 | [Sidebar tree refactor](phase-01-sidebar-refactor.md) | 6h | complete |
| 2 | [Project detail compression](phase-02-project-detail-compression.md) | 2h | complete |
| 3 | [Role-based dashboard](phase-03-dashboard-refactor.md) | 5h | complete |
| 4 | [Gantt responsive buttons](phase-04-gantt-responsive-buttons.md) | 0.5h | complete |
| 5 | [Task list type column](phase-05-task-list-type-column.md) | 2.5h | complete |

## Dependencies

- Phase 2 depends on Phase 1 (sidebar owns the tabs now)
- Phase 3 is independent, can run in parallel with 1+2
- Phases 4 and 5 are independent

## Design System

See [design-system.md](design-system.md) for complete specification:
- **Colors:** Trust Blue (#2563EB) primary, dark sidebar (slate-900), light content (slate-50)
- **Typography:** Inter, text-sm (14px) body, text-2xl (24px) headings
- **Sidebar:** w-60, bg-slate-900, tree-style with expand/collapse
- **Cards/Tables:** bg-white, rounded-lg, border-slate-200
- **Status badges:** Color-coded per status/type/priority
- **Icons:** Heroicons Outline (nav), Solid (inline) - NO emojis

## Key Decisions

- Sidebar fetches projects via `GET_USER_PROJECTS` (existing query)
- Sidebar manages active project + active tab state (URL-driven or Redux)
- Backend `tasks(assigneeId)` query already exists for dashboard
- `useAuth()` provides `user.role` for PM vs member dashboard view
- Remove `/reports`, `/calendar`, `/settings` routes from sidebar (pages remain accessible via direct URL)

## Branch Strategy

Create `feat/v2.30` from `feat/v2.29`. One commit per phase.
