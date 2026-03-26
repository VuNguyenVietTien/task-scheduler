# Phase 2: Project Detail Compression

## Context Links
- ProjectDetailView: `src/components/projects/ProjectDetailView.tsx` (432 lines)
- Phase 1 sidebar: [phase-01-sidebar-refactor.md](phase-01-sidebar-refactor.md)
- Project page: `src/app/projects/[id]/page.tsx`

## Overview
- **Priority:** P1
- **Status:** complete
- **Description:** Remove project header (title, due date, member count) and tab bar from ProjectDetailView. Navigation now lives in sidebar (Phase 1). Content starts immediately at top of main area.

## Key Insights
- ProjectDetailView lines 336-382: header block + tab bar = ~46 lines to remove
- Tab switching logic (`activeView` state) moves to URL-driven from sidebar
- Data fetching logic (lines 55-158) must stay intact - it's project-scoped
- The "Them cong viec" (Add Task) button in header needs relocation
- `h-[calc(100vh-240px)]` on content div (line 384) needs adjustment since header is gone

## Requirements

### Functional
- Remove `<h1>` project title, due date, member count block (lines 337-363)
- Remove tab bar `<div className="border-b">` (lines 365-382)
- `activeView` driven by `tab` URL param (from Phase 1) instead of local state
- "Them cong viec" button → move to TaskListView header or keep as floating action
- Content fills full height: `h-[calc(100vh-80px)]` (only header 64px + padding)

### Non-Functional
- No data fetching regressions
- Smooth transition when switching tabs via sidebar

## Architecture

Before:
```
ProjectDetailView
├── Header (title + "Add Task" button + metadata)
├── Tab Bar (list/kanban/gantt/members/report)
└── Content Area (conditional render based on activeView)
```

After:
```
ProjectDetailView
├── Content Area (conditional render based on URL tab param)
└── (optional) Floating "Add Task" in TaskListView
```

## Related Code Files

### Modify
- `src/components/projects/ProjectDetailView.tsx` - Remove header + tabs, accept `activeTab` prop
- `src/components/tasks/TaskListView.tsx` - Add "Them cong viec" button in its own header if not already present

### No Change
- All data fetching hooks, Redux slices, GraphQL queries unchanged
- Child view components (TaskListView, KanbanBoard, Timeline, MembersView, ProjectReportView) unchanged

## Implementation Steps

1. **Update ProjectDetailView props**
   - Add `activeTab?: ViewType` prop (default: `'list'`)
   - Remove `useState<ViewType>('list')` for `activeView`
   - Use `activeTab` prop directly for conditional rendering

2. **Remove header block** (lines 336-363)
   - Delete the `<div className="mb-6">` containing title, add-task button, due date, member count

3. **Remove tab bar** (lines 365-382)
   - Delete the `<div className="border-b border-slate-200 mb-6">` with tab buttons
   - Delete the `tabs` array definition (lines 253-299)

4. **Adjust content container**
   - Change `h-[calc(100vh-240px)]` to `h-[calc(100vh-100px)]` (header 64px + padding 36px)
   - Remove top padding `p-6` from outer div or reduce to `p-2`

5. **Relocate "Add Task" button**
   - Add inline "Them cong viec" link/button at top-right of TaskListView
   - Only show when `activeTab === 'list'`

6. **Update ProjectPage to pass tab param**
   - Read `searchParams.tab` in `projects/[id]/page.tsx`
   - Pass as `activeTab` to ProjectDetailView

## Todo List
- [ ] Add `activeTab` prop to ProjectDetailView
- [ ] Remove header block (title + metadata)
- [ ] Remove tab bar and `tabs` array
- [ ] Adjust content container height calc
- [ ] Relocate "Add Task" button to TaskListView
- [ ] Update ProjectPage to pass URL tab param
- [ ] Verify all 5 views still render correctly
- [ ] Test data fetching still works (no regressions)

## Success Criteria
- No project header or tab bar in main content area
- Content area uses full available height
- Tab switching via sidebar (Phase 1) correctly renders each view
- "Add Task" remains accessible
- All existing functionality preserved

## Risk Assessment
- **Risk:** Removing header loses project context for user → **Mitigation:** Sidebar shows active project highlighted; project name visible in sidebar tree
- **Risk:** Height calc breakage on different screen sizes → **Mitigation:** Test on common viewports (1080p, 1440p)

## Security Considerations
- No new security surface; existing auth checks unchanged

## Next Steps
- Verify integration with Phase 1 sidebar navigation end-to-end
