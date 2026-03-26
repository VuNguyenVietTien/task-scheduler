# Frontend Tab Structure - Quick Reference Guide

## What I Found

You have a **two-level tab system** in your Next.js app:

### Level 1: Project-Level Tabs (5 Views)
Located in: `/projects/[id]` page

**Tabs:** list | kanban | gantt | members | report

- **State:** URL parameter `?tab=<name>`
- **Implementation:** `ProjectDetailView.tsx` uses conditional rendering
- **Data:** Redux store (shared across all views)
- **Default:** `list`

### Level 2: Task-Level Tabs (4 Tabs)
Located in: Task detail page

**Tabs:** description | details | comments | subtasks

- **State:** React state in `TabsLayout.tsx`
- **Implementation:** Context-based `Tabs.tsx` component
- **Data:** Props passed from parent
- **UI Pattern:** Reusable context provider with triggers/content

---

## Critical Files

### Project-Level Navigation
1. **`frontend/src/app/projects/[id]/page.tsx`**
   - Extracts `?tab=` from URL with `useSearchParams()`
   - Passes as `initialTab` prop

2. **`frontend/src/components/projects/ProjectDetailView.tsx`**
   - Main tab switcher (line 21-22 defines ViewType)
   - `activeView` state synced with URL via useEffect
   - Renders views conditionally (lines 324-365)

3. **`frontend/src/app/projects/[id]/layout.tsx`**
   - Redux data fetching at layout level
   - Fetches tasks, members, and project data

### Task-Level Navigation
1. **`frontend/src/components/tasks/tabs/TabsLayout.tsx`**
   - Hard-coded 4 tabs
   - Takes `activeTab` and `setActiveTab` props
   - Renders tab buttons and content

2. **`frontend/src/components/ui/Tabs.tsx`**
   - Generic reusable component
   - React Context for `selectedTab`
   - Exports: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`

### View Components
- **List:** `/components/tasks/TaskListView.tsx`
- **Kanban:** `/components/tasks/KanbanBoard.tsx`
- **Gantt:** `/components/tasks/GanttChart.tsx` (or Timeline)
- **Members:** `/components/projects/MembersView.tsx`
- **Reports:** `/components/reports/ProjectReportView.tsx`

---

## How Tab Navigation Works

### Project-Level Flow
```
URL: /projects/123?tab=kanban
      ↓
useSearchParams() → "kanban"
      ↓
ProjectPageWrapper → initialTab: "kanban"
      ↓
ProjectPage → receives initialTab prop
      ↓
ProjectDetailView → useState(toViewType("kanban"))
      ↓
{activeView === 'kanban' && <KanbanBoard />}
```

### Task-Level Flow
```
Parent component
      ↓
TabsLayout (activeTab, setActiveTab)
      ↓
<Tabs defaultValue={activeTab}>
      ↓
<TabsList> with <TabsTrigger> buttons
      ↓
<TabsContent> conditionally renders
```

---

## Data Sharing

**Redux Store** (project-level views share this):
- `tasksSlice` → `tasks[]`, `loading`, `error`
- `membersSlice` → `members[]`, `loading`, `error`
- `projectSlice` → `project{}`, `loading`, `error`

**Props** (task-level tabs use this):
- Parent passes pre-calculated data
- Each tab receives what it needs

**Apollo Client** (individual queries):
- Cached GraphQL results
- Example: `GET_PROJECT_OVERVIEW`, `GET_PROJECT_TASKS`

---

## Key Implementation Details

### Validation
```typescript
type ViewType = 'list' | 'kanban' | 'gantt' | 'members' | 'report';
const VALID_VIEWS: ViewType[] = ['list', 'kanban', 'gantt', 'members', 'report'];

function toViewType(tab?: string): ViewType {
  return VALID_VIEWS.includes(tab as ViewType) ? (tab as ViewType) : 'list';
}
```

### URL Sync
```typescript
const [activeView, setActiveView] = useState<ViewType>(toViewType(initialTab));

useEffect(() => {
  const validated = toViewType(initialTab);
  if (validated !== activeView) {
    setActiveView(validated);
  }
}, [initialTab]); // Syncs when URL changes
```

### Tab Context
```typescript
type TabsContextValue = {
  selectedTab: string;
  setSelectedTab: (value: string) => void;
};

// Components: Tabs, TabsList, TabsTrigger, TabsContent
// Each tab button calls setSelectedTab(tabValue)
// Each TabsContent checks if selectedTab === tabValue, renders if true
```

---

## Sidebar Integration

**`frontend/src/components/layout/Sidebar.tsx`**
- No tab-specific buttons
- Links to `/projects/[id]` without tabs
- Sidebar drives navigation to project
- Internal project page manages tabs via URL

---

## What's NOT Here

No explicit tab bar component. Navigation happens through:
- URL changes (project-level) → sidebar or internal links
- State management (task-level) → TabsLayout

No central "tab registry". Tabs are:
- Hard-coded in ViewType (project-level)
- Hard-coded in TabsLayout (task-level)

---

## Common Tasks

### Add a New Project View
1. Add to `ViewType`: `type ViewType = '...' | 'newview'`
2. Add to `VALID_VIEWS`: `['...', 'newview']`
3. Add conditional in `ProjectDetailView` rendering
4. Create component `/components/path/NewViewComponent.tsx`
5. Import and use in rendering

### Add a New Task Tab
1. Add to tabs array in `TabsLayout.tsx` (lines 19-24)
2. Create component `/components/tasks/tabs/NewTabComponent.tsx`
3. Add to `tabComponents` object passed to `TabsLayout`
4. Component receives props from parent

### Share Data Between Views
1. Update Redux slice action
2. Dispatch in `ProjectDetailView` useEffect
3. Select in `ProjectDetailView` with `useAppSelector`
4. Pass to view as prop

---

## File Locations Summary

```
frontend/
├── src/
│   ├── app/projects/[id]/
│   │   ├── page.tsx          ← URL param extraction
│   │   └── layout.tsx        ← Redux data fetch
│   ├── components/
│   │   ├── projects/
│   │   │   ├── ProjectPage.tsx
│   │   │   ├── ProjectDetailView.tsx  ← Main switcher
│   │   │   └── MembersView.tsx
│   │   ├── tasks/
│   │   │   ├── TaskListView.tsx
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── GanttChart.tsx
│   │   │   └── tabs/
│   │   │       ├── TabsLayout.tsx    ← Task tab switcher
│   │   │       ├── DetailsTab.tsx
│   │   │       ├── CommentsTab.tsx
│   │   │       ├── DescriptionTab.tsx
│   │   │       └── SubtasksTab.tsx
│   │   ├── ui/
│   │   │   └── Tabs.tsx              ← Reusable UI
│   │   ├── reports/
│   │   │   └── ProjectReportView.tsx
│   │   └── layout/
│   │       └── Sidebar.tsx
│   └── redux/features/
│       ├── tasksSlice.ts
│       ├── membersSlice.ts
│       ├── projectSlice.ts
│       └── plansSlice.ts
```

---

## Key Takeaways

1. **URL-driven** - Project tabs stored in URL (bookmarkable, shareable)
2. **Redux-powered** - All project views share Redux data
3. **Two patterns** - Project uses conditional render, Tasks use Context
4. **Type-safe** - ViewType ensures valid tabs only
5. **Decoupled** - Views receive props, don't manage their own state
6. **Extensible** - Easy to add new views or tabs

---

Reports Generated: 2026-03-26
