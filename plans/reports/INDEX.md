# Frontend Tab Structure Exploration - Report Index

## Generated Reports

This exploration investigated the Next.js frontend tab structure at `/projects/[id]` and how tabs are implemented across the application.

### Report Files

1. **`QUICK-REFERENCE.md`** ⭐ START HERE
   - Concise overview of tab system (2-level)
   - Critical files and how they work
   - Key implementation details
   - Common tasks (add new views/tabs)
   - **Best for:** Quick understanding, developers, decision-making

2. **`Explore-260326-0833-frontend-tab-structure.md`**
   - Comprehensive detailed report
   - 8 sections covering all aspects
   - Design patterns explained
   - Summary table comparing levels
   - **Best for:** Deep understanding, reference, documentation

3. **`tab-architecture-summary.txt`**
   - ASCII visual diagrams
   - Two-level system visualized
   - Data sharing architecture diagram
   - Navigation flow diagrams
   - **Best for:** Visual learners, presentations, understanding flow

4. **`tab-implementation-file-paths.txt`**
   - Exhaustive file listing
   - Every component with description
   - Redux slices explained
   - GraphQL queries and mutations
   - Import paths reference
   - **Best for:** Implementation, finding files, code navigation

---

## Key Findings Summary

### Two-Level Tab System

**Level 1: Project-Level (5 Views)**
- URL-driven (`?tab=list|kanban|gantt|members|report`)
- Implemented in: `ProjectDetailView.tsx`
- Data: Redux store (shared)
- Pattern: Conditional rendering

**Level 2: Task-Level (4 Tabs)**
- State-driven (React state in component)
- Implemented in: `TabsLayout.tsx` + `Tabs.tsx`
- Data: Props passed down
- Pattern: Context-based component

### Central Files

| File | Purpose | Type |
|------|---------|------|
| `frontend/src/app/projects/[id]/page.tsx` | URL extraction | Route |
| `frontend/src/components/projects/ProjectDetailView.tsx` | Main switcher | View |
| `frontend/src/components/tasks/tabs/TabsLayout.tsx` | Task tabs | Component |
| `frontend/src/components/ui/Tabs.tsx` | Reusable UI | Component |
| `frontend/src/app/projects/[id]/layout.tsx` | Data fetch | Layout |

### Data Flow

```
Project-Level:
  URL (?tab=X) → useSearchParams() → ProjectDetailView → Redux selectors → View components

Task-Level:
  Parent state (activeTab) → TabsLayout → Tabs context → Tab components
```

---

## Navigation Patterns

### Project-Level Navigation
- URL-driven, bookmarkable, browser history support
- Synced via `useEffect` watching `initialTab`
- Validated against `VALID_VIEWS` enum
- Default view: `list`

### Task-Level Navigation
- State-driven within component
- Context provides `selectedTab` state
- `TabsTrigger` buttons call `setSelectedTab`
- `TabsContent` conditionally renders

---

## Data Sharing Methods

1. **Redux Store** - Shared across all project-level views
   - `tasksSlice`, `membersSlice`, `projectSlice`, `plansSlice`
   - Single fetch per project, reused by all views

2. **Props** - Passed to task-level tabs
   - Parent calculates, passes formatted data
   - Tabs don't manage own data fetching

3. **Apollo Cache** - GraphQL query caching
   - Individual components can use queries
   - Results cached, reused across tabs

---

## When to Use Each Report

- **Need quick understanding?** → `QUICK-REFERENCE.md`
- **Need visual/diagram?** → `tab-architecture-summary.txt`
- **Adding new tab/view?** → `QUICK-REFERENCE.md` (Common Tasks section)
- **Need exact file paths?** → `tab-implementation-file-paths.txt`
- **Full documentation?** → `Explore-260326-0833-frontend-tab-structure.md`
- **Explaining to team?** → `tab-architecture-summary.txt` (ASCII diagrams)

---

## Quick Links

### To Add a New Project View:
1. See `QUICK-REFERENCE.md` → "Common Tasks" section
2. Edit `ProjectDetailView.tsx` type definition
3. Create view component
4. Add conditional rendering

### To Add a New Task Tab:
1. See `QUICK-REFERENCE.md` → "Common Tasks" section
2. Edit `TabsLayout.tsx` tabs array
3. Create tab component
4. Pass in `tabComponents` object

### To Share Data Between Views:
1. See `QUICK-REFERENCE.md` → "Data Sharing" section
2. Update relevant Redux slice
3. Dispatch in `ProjectDetailView.useEffect`
4. Select and pass as props

---

## Architecture Overview

The tab system is built on three principles:

1. **URL-Driven State (Project Level)**
   - Enables bookmarking, sharing, browser history
   - Type-safe validation
   - Syncs with Redux data

2. **Context-Based UI (Task Level)**
   - Reusable, extensible component
   - Simple state management
   - Props-driven data

3. **Redux for Shared Data**
   - Single source of truth
   - Prevents duplicate API calls
   - Available to all components

---

## File Organization

```
Reports Location: /Users/TienVNV/Desktop/ProjectManager/plans/reports/

├── INDEX.md (this file)
├── QUICK-REFERENCE.md ⭐
├── Explore-260326-0833-frontend-tab-structure.md
├── tab-architecture-summary.txt
└── tab-implementation-file-paths.txt
```

---

## Related Code Locations

**Route Entry:** `/frontend/src/app/projects/[id]/page.tsx`

**Layout/Data:** `/frontend/src/app/projects/[id]/layout.tsx`

**Main View:** `/frontend/src/components/projects/ProjectDetailView.tsx`

**Views:**
- `/frontend/src/components/tasks/TaskListView.tsx`
- `/frontend/src/components/tasks/KanbanBoard.tsx`
- `/frontend/src/components/tasks/GanttChart.tsx`
- `/frontend/src/components/projects/MembersView.tsx`
- `/frontend/src/components/reports/ProjectReportView.tsx`

**Task Tabs:**
- `/frontend/src/components/tasks/tabs/TabsLayout.tsx`
- `/frontend/src/components/ui/Tabs.tsx`
- `/frontend/src/components/tasks/tabs/DescriptionTab.tsx`
- `/frontend/src/components/tasks/tabs/DetailsTab.tsx`
- `/frontend/src/components/tasks/tabs/CommentsTab.tsx`
- `/frontend/src/components/tasks/tabs/SubtasksTab.tsx`

**Redux:** `/redux/features/`
- `tasksSlice.ts`
- `membersSlice.ts`
- `projectSlice.ts`
- `plansSlice.ts`

---

## Questions Answered

✓ How project detail pages work
✓ What tabs exist (list, kanban, gantt, members, report)
✓ How tab navigation works (URL + useEffect + conditional rendering)
✓ Sidebar structure and integration
✓ How data is shared between tabs (Redux, props, Apollo cache)
✓ Task-level tab implementation (Context-based)
✓ File organization and locations
✓ Design patterns used
✓ How to extend the system

---

Exploration completed: 2026-03-26
Reports saved to: `/Users/TienVNV/Desktop/ProjectManager/plans/reports/`
