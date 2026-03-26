# Frontend Tab Structure Exploration Report

## Overview

The Next.js frontend uses a **URL-driven tab navigation system** with URL search parameters (`?tab=`) to manage different views in the project detail pages. Tabs exist at two levels: **project-level views** (main tabs) and **task-level tabs** (nested tabs within task details).

---

## 1. Project-Level Tab System

### Location
- **Page:** `/Users/TienVNV/Desktop/ProjectManager/frontend/src/app/projects/[id]/page.tsx`
- **View Component:** `/Users/TienVNV/Desktop/ProjectManager/frontend/src/components/projects/ProjectDetailView.tsx`
- **Layout:** `/Users/TienVNV/Desktop/ProjectManager/frontend/src/app/projects/[id]/layout.tsx`

### Tab Names (5 Tabs)
```typescript
type ViewType = 'list' | 'kanban' | 'gantt' | 'members' | 'report';
const VALID_VIEWS: ViewType[] = ['list', 'kanban', 'gantt', 'members', 'report'];
```

| Tab Name | Component | Purpose |
|----------|-----------|---------|
| `list` | `TaskListView` | Task list view (default) |
| `kanban` | `KanbanBoard` | Kanban board view |
| `gantt` | `Timeline` | Gantt/Timeline chart |
| `members` | `MembersView` | Project members management |
| `report` | `ProjectReportView` | Project reports/analytics |

### How Tab Navigation Works

**URL-based routing:**
- Tab state is stored in URL search parameter: `?tab=list`, `?tab=kanban`, etc.
- Navigation via sidebar or internal navigation updates the `tab` query parameter
- URL changes trigger `initialTab` prop update

**Code Flow:**

1. **Page component** (`page.tsx` line 32-36):
```typescript
function ProjectPageWrapper({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const tab = searchParams?.get('tab') || 'list';  // Get tab from URL
  return <DynamicProjectContent id={id} initialTab={tab} />;
}
```

2. **ProjectPage component** (line 31-102):
   - Receives `initialTab` prop
   - Passes it to `ProjectDetailView`
   - Fetches project data from Redux

3. **ProjectDetailView component** (line 32-42):
```typescript
const [activeView, setActiveView] = useState<ViewType>(toViewType(initialTab));

// Sync with URL changes
useEffect(() => {
  const validated = toViewType(initialTab);
  if (validated !== activeView) {
    setActiveView(validated);
  }
}, [initialTab]); // Syncs when URL tab param changes
```

### Tab Implementation Details

**Validation:**
```typescript
function toViewType(tab?: string): ViewType {
  return VALID_VIEWS.includes(tab as ViewType) ? (tab as ViewType) : 'list';
}
```

**Rendering conditional tabs (lines 324-365):**
```typescript
{activeView === 'members' ? (
  <MembersView ... />
) : activeView === 'report' ? (
  <ProjectReportView ... />
) : (
  // TaskListView, KanbanBoard, Timeline
)}
```

---

## 2. Task-Level Tab System

### Location
- **Main file:** `/Users/TienVNV/Desktop/ProjectManager/frontend/src/components/tasks/tabs/TabsLayout.tsx`
- **UI Component:** `/Users/TienVNV/Desktop/ProjectManager/frontend/src/components/ui/Tabs.tsx`

### Tab Names (4 Tabs)
```typescript
const tabs = [
  { id: 'description', label: 'Mô tả' },
  { id: 'details', label: 'Thông tin chi tiết' },
  { id: 'comments', label: 'Bình luận' },
  { id: 'subtasks', label: 'Công việc con' }
];
```

| Tab ID | Component | Purpose |
|--------|-----------|---------|
| `description` | `DescriptionTab` | Task description/content |
| `details` | `DetailsTab` | Task metadata (status, priority, dates, effort) |
| `comments` | `CommentsTab` | Task comments and discussions |
| `subtasks` | `SubtasksTab` | Child tasks management |

### Tab Component Structure

**TabsLayout** (`TabsLayout.tsx`):
- Takes `activeTab`, `setActiveTab`, and `tabComponents` props
- Renders tab buttons with active state styling
- Shows content based on `activeTab` state

**UI Components** (`Tabs.tsx`):
- React Context-based system
- Components: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- Manages selected tab state
- Supports controlled and uncontrolled modes

```typescript
// TabsContext manages selected tab state
type TabsContextValue = {
  selectedTab: string;
  setSelectedTab: (value: string) => void;
};

// Components:
- <Tabs defaultValue="tab1"> - Container
- <TabsList> - Tab button container
- <TabsTrigger value="tab1"> - Individual tab button
- <TabsContent value="tab1"> - Tab panel (conditionally renders)
```

---

## 3. Data Sharing Between Tabs

### Redux Store
**Location:** `/redux/features/`

All view tabs share data via Redux slices:
- `tasksSlice` - Project tasks
- `membersSlice` - Project members
- `projectSlice` - Project details
- `plansSlice` - Project plans
- `taskOrderStore` - Task ordering/sorting

**ProjectDetailView** uses:
```typescript
const dispatch = useAppDispatch();
const { tasks: reduxTasks, loading: loadingTasks } = useAppSelector(state => state.tasks);
const { members: reduxMembers, loading: loadingMembers } = useAppSelector(state => state.members);
const { plans } = useAppSelector(state => state.plans);
```

### Apollo Client (GraphQL)
- Individual tab components use Apollo hooks for specific queries
- Example: `OverviewTab` uses `GET_PROJECT_OVERVIEW` query
- Cached results in Apollo cache shared across tabs

### Component Props
- Task-level tabs receive props from parent component
- Parents pass calculated data (formatted dates, progress, etc.)
- Prevents redundant calculations

### Data Flow Example

**Project-level (ProjectDetailView):**
1. Fetch tasks from Redux: `dispatch(fetchProjectTasks(projectId))`
2. Fetch members from Redux: `dispatch(fetchProjectMembers(projectId))`
3. Transform and pass to views:
```typescript
const displayedTasks = reduxTasks.map(transformTask);
const displayedMembers = reduxMembers.map(member => ({...}));

// Pass to different views
<TaskListView tasks={displayedTasks} />
<KanbanBoard tasks={displayedTasks} />
<MembersView members={displayedMembers} />
```

---

## 4. Sidebar Navigation Structure

### Location
`/Users/TienVNV/Desktop/ProjectManager/frontend/src/components/layout/Sidebar.tsx`

**Main navigation items:**
```typescript
const navigation = [
  { name: 'Dashboard', href: '/', icon: '📊' },
  { name: 'Projects', href: '/projects', icon: '📂' },
  { name: 'Calendar', href: '/calendar', icon: '📅' },
  { name: 'Reports', href: '/reports', icon: '📈' },
];
```

### How Sidebar Interacts with Tabs

**Linking to tabs:**
- Sidebar links to `/projects/[id]?tab=list` or similar
- Uses `usePathname()` to determine active section
- Dynamic tab selection through URL parameters

**No explicit tab buttons in sidebar**
- Tab buttons are rendered conditionally within the project detail view
- Sidebar drives navigation to project, internal logic manages tabs

---

## 5. Project Detail Page Layout

### File Structure
```
frontend/src/app/projects/[id]/
├── page.tsx              # Route component with useSearchParams
├── layout.tsx            # Layout with Redux data fetching
├── add-task/
│   └── page.tsx
└── tasks/
    └── [taskId]/
        ├── page.tsx
        └── create-subtask/
            └── page.tsx
```

### Layout Flow

```
[id]/page.tsx (gets ?tab from URL)
  ↓
  ProjectPageWrapper (extracts tab param)
    ↓
    ProjectPage (dynamic import, loads Redux data)
      ↓
      ProjectDetailView (manages activeView state)
        ↓
        Renders active view: TaskListView | KanbanBoard | Timeline | MembersView | ProjectReportView
```

### Layout Component (`layout.tsx`)
- Uses Redux to fetch project and members at layout level
- Data available to all child pages via context
- Skips fetch on task detail pages (conditional logic)

```typescript
useEffect(() => {
  const isTaskDetailPage = pathname && pathname.includes(`/projects/${projectId}/tasks/`);
  
  if (!isTaskDetailPage) {
    dispatch(fetchProject(projectId));
  }
  
  if (!members || members.length === 0) {
    dispatch(fetchProjectMembers(projectId));
  }
}, [projectId, pathname, dispatch, members]);
```

---

## 6. Component Files Summary

### Project-Level Tab Components
| File Path | Purpose |
|-----------|---------|
| `frontend/src/components/projects/ProjectPage.tsx` | Wrapper component, data fetch, loading states |
| `frontend/src/components/projects/ProjectDetailView.tsx` | Main view switcher, tab logic, data transformation |
| `frontend/src/components/projects/MembersView.tsx` | Members list/management view |
| `frontend/src/components/tasks/TaskListView.tsx` | Task list view |
| `frontend/src/components/tasks/KanbanBoard.tsx` | Kanban board view |
| `frontend/src/components/tasks/GanttChart.tsx` | Gantt/Timeline view |
| `frontend/src/components/reports/ProjectReportView.tsx` | Reports view |

### Task-Level Tab Components
| File Path | Purpose |
|-----------|---------|
| `frontend/src/components/tasks/tabs/TabsLayout.tsx` | Tab navigation for task details |
| `frontend/src/components/tasks/tabs/DescriptionTab.tsx` | Task description content |
| `frontend/src/components/tasks/tabs/DetailsTab.tsx` | Task metadata (status, priority, dates) |
| `frontend/src/components/tasks/tabs/CommentsTab.tsx` | Task comments/discussion |
| `frontend/src/components/tasks/tabs/SubtasksTab.tsx` | Child tasks |

### Generic Tab UI Component
| File Path | Purpose |
|-----------|---------|
| `frontend/src/components/ui/Tabs.tsx` | Reusable Tabs with Context (Tabs, TabsList, TabsTrigger, TabsContent) |

---

## 7. Legacy/Deprecated Tab Components

The following files appear to be deprecated (based on git status showing removal):
```
RM frontend/src/components/project/MemberRoleSelect.tsx
RM frontend/src/components/project/MembersTab.tsx
RM frontend/src/components/projects/MembersView.tsx
RM frontend/src/components/projects/ProjectDetailView.tsx
RM frontend/src/components/tasks/KanbanBoard.tsx
RM frontend/src/components/tasks/TaskDetail.tsx
RM frontend/src/components/tasks/TaskDetailPage.tsx
RM frontend/src/components/reports/ProjectReportView.tsx
RM frontend/src/components/reports/ReportView.tsx
```

**Note:** These files show as removed in git but still exist. Current implementation files are active.

---

## 8. Key Design Patterns

### 1. **URL-Driven State**
- Tab state stored in URL (`?tab=` parameter)
- Bookmarkable navigation
- Browser back/forward support
- Survives page reloads

### 2. **Redux for Shared State**
- Single source of truth for project data
- Prevents duplicate API calls
- Available to all tab views
- Optimistic updates possible

### 3. **Context-Based Tab UI**
- Generic reusable Tabs component
- Context provides selected tab state
- Automatically syncs multiple instances
- Extensible for future tabs

### 4. **Conditional Rendering**
- Views render based on `activeView` state
- Only active view components mount (except for data fetching)
- Memory efficient

### 5. **Props-Driven Task Tabs**
- Task detail page passes data as props
- TabsLayout orchestrates tab rendering
- Each tab component receives pre-calculated data
- Decoupled from parent data fetching

---

## Summary Table

| Aspect | Project-Level | Task-Level |
|--------|---------------|-----------|
| **Navigation Type** | URL query param (`?tab=`) | React state |
| **Tab Count** | 5 | 4 |
| **State Management** | Redux + URL | React state |
| **Location** | ProjectDetailView | Task detail page |
| **UI Pattern** | Conditional rendering | Context-based Tabs component |
| **Data Sharing** | Redux store, Apollo cache | Props passed down |
| **Tab Names** | list, kanban, gantt, members, report | description, details, comments, subtasks |

---

## Files to Reference

**Project Setup:**
- `/frontend/src/app/projects/[id]/page.tsx` - Route entry point
- `/frontend/src/app/projects/[id]/layout.tsx` - Layout/data provider
- `/frontend/src/components/projects/ProjectDetailView.tsx` - Main tab switcher

**Data Management:**
- `/redux/features/tasksSlice.ts`
- `/redux/features/membersSlice.ts`
- `/redux/features/projectSlice.ts`

**Task Tabs:**
- `/frontend/src/components/tasks/tabs/TabsLayout.tsx`
- `/frontend/src/components/ui/Tabs.tsx`

**Views:**
- `/frontend/src/components/tasks/TaskListView.tsx`
- `/frontend/src/components/tasks/KanbanBoard.tsx`
- `/frontend/src/components/projects/MembersView.tsx`

---

Generated: 2026-03-26
