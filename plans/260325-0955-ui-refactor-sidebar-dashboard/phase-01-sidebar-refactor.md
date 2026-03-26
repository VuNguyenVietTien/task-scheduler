# Phase 1: Sidebar Tree Refactor

## Context Links
- Current sidebar: `src/components/ui/navigation/Sidebar.tsx` (44 lines)
- Layout: `src/components/ui/navigation/Layout.tsx` (28 lines)
- Projects query: `src/graphql/queries/project.ts` (`GET_USER_PROJECTS`)
- ProjectDetailView tabs: `src/components/projects/ProjectDetailView.tsx` (lines 253-299)

## Overview
- **Priority:** P1
- **Status:** complete
- **Description:** Replace flat 5-item sidebar with tree-style navigation. Dashboard link at top, then expandable project folders. Each project expands to show sub-tabs: Tasks, Kanban, Gantt, Members, Reports.

## Key Insights
- Current sidebar is a simple static list of 5 links (Dashboard, Projects, Reports, Calendar, Settings)
- ProjectDetailView already defines ViewType: `'list' | 'kanban' | 'gantt' | 'members' | 'report'`
- `GET_USER_PROJECTS` returns `projectId, name, iconUrl, status` - sufficient for sidebar
- Layout uses fixed sidebar `w-64` with `pl-64` on main content - keep this pattern
- Sidebar needs to be stateful: track expanded project + active tab
- URL routing should reflect selection: `/projects/{id}?tab=kanban`

## Requirements

### Functional
- Dashboard link at top of sidebar (route: `/`)
- "Projects" section header with project list below
- Each project is expandable (click chevron to expand/collapse)
- Expanded project shows 5 sub-tabs: Danh sach (Tasks), Kanban, Gantt, Thanh vien (Members), Bao cao (Reports)
- Clicking a sub-tab navigates to `/projects/{id}?tab={tabId}` and renders that view in main content
- Active project + tab visually highlighted
- Collapsed state persisted in localStorage

### Non-Functional
- Sidebar must not re-fetch projects on every tab switch
- Smooth expand/collapse animation (CSS transition on max-height)
- Accessible: keyboard navigation, aria-expanded

## Architecture

```
Sidebar (new)
├── DashboardLink (static)
├── ProjectsSection
│   ├── SectionHeader ("Projects" + optional add button)
│   └── ProjectTreeItem[] (one per project)
│       ├── ProjectHeader (icon + name + chevron)
│       └── ProjectSubTabs (expand/collapse)
│           ├── Tasks tab
│           ├── Kanban tab
│           ├── Gantt tab
│           ├── Members tab
│           └── Reports tab
```

State management:
- `expandedProjects: Set<string>` in localStorage
- Active project/tab derived from URL (`useParams` + `useSearchParams`)
- Projects data from Apollo `useQuery(GET_USER_PROJECTS)` with cache-first policy

## Related Code Files

### Modify
- `src/components/ui/navigation/Sidebar.tsx` - Complete rewrite
- `src/components/ui/navigation/Layout.tsx` - Minor: pass sidebar state if needed
- `src/app/projects/[id]/page.tsx` - Read `tab` query param, pass to ProjectDetailView

### Create
- `src/components/ui/navigation/sidebar-project-tree-item.tsx` - Expandable project item (~80 lines)
- `src/hooks/use-sidebar-state.ts` - localStorage persistence for expanded state (~40 lines)

### No Change
- `src/graphql/queries/project.ts` - Reuse `GET_USER_PROJECTS`

## Implementation Steps

1. **Create `use-sidebar-state.ts` hook**
   - Manage `expandedProjects: Set<string>` with localStorage
   - `toggleProject(id)`, `isExpanded(id)` methods
   - Initialize from localStorage on mount

2. **Create `sidebar-project-tree-item.tsx`**
   - Props: `project`, `isExpanded`, `activeTab`, `onToggle`
   - Render project name + chevron icon (rotates on expand)
   - Render sub-tabs list when expanded with CSS transition
   - Each sub-tab is a `<Link>` to `/projects/{id}?tab={tabId}`
   - Highlight active tab based on current URL

3. **Rewrite `Sidebar.tsx`**
   - Fetch projects with `useQuery(GET_USER_PROJECTS)`
   - Render Dashboard link at top
   - Render "Projects" section header
   - Map projects to `ProjectTreeItem` components
   - Loading skeleton while projects load
   - Handle empty state (no projects)

4. **Update `Layout.tsx`**
   - No major changes needed, sidebar stays fixed w-64

5. **Update `projects/[id]/page.tsx`**
   - Read `?tab=` search param
   - Pass `initialTab` to ProjectPage/ProjectDetailView
   - Default to `'list'` if no tab param

6. **Update ProjectDetailView to accept initial tab from URL**
   - Accept `initialTab` prop
   - Sync `activeView` state with URL query param
   - Tab bar in ProjectDetailView still rendered (Phase 2 removes it)

## Todo List
- [ ] Create `use-sidebar-state.ts` hook
- [ ] Create `sidebar-project-tree-item.tsx` component
- [ ] Rewrite `Sidebar.tsx` with tree structure
- [ ] Update `projects/[id]/page.tsx` to read tab query param
- [ ] Update ProjectDetailView to accept initialTab prop
- [ ] Add expand/collapse CSS transitions
- [ ] Test keyboard navigation
- [ ] Verify sidebar doesn't re-fetch on tab switch

## Success Criteria
- Sidebar shows Dashboard + expandable project tree
- Clicking project sub-tab loads correct view in main content
- Expanded state persists across page refreshes
- No regression in project data loading

## Risk Assessment
- **Risk:** Apollo cache invalidation when project list changes → **Mitigation:** Use `cache-first` fetch policy, refetch on project create/delete events
- **Risk:** Deep sidebar items may overflow on long project names → **Mitigation:** `truncate` class with title tooltip

## Security Considerations
- Projects query is auth-gated (existing behavior)
- No new auth surface

## Next Steps
- Phase 2: Remove tab bar + header from ProjectDetailView (sidebar owns navigation now)
