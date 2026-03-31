# Gantt Chart and Project Detail Page - Comprehensive Code Analysis Report

## Executive Summary

The ProjectManager web application implements a sophisticated Gantt chart (Timeline) view integrated with a project detail page. The system uses Redux for state management, drag-and-drop functionality for task reordering, and a complex task scheduling algorithm.

---

## 1. Gantt Chart Component(s)

### 1.1 Main Gantt Component: Timeline
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/components/timeline/Timeline.tsx`
- **Size:** 1,514 lines
- **Type:** Client-side React component using hooks
- **Key Features:**
  - Renders tasks as horizontal bars on a calendar-based timeline
  - Supports two view modes: 'project' (default) and 'user'
  - Integrates with drag-and-drop context (DnD Kit)
  - Manages date ranges with localStorage persistence
  - Handles task detail modal opening on click
  - Supports plan-based scheduling and auto-sorting

**Key Props:**
```typescript
interface TimelineProps {
  isLoading?: boolean;
  onTaskClick?: (taskId: string) => void;
  users?: AssignedUser[];
}
```

**State Management:**
- Uses Redux hooks to access `tasks`, `plans`, `activePlan`, and `taskOrderStore`
- Maintains local state for: `dateRange`, `planName`, `viewMode`, `selectedUserId`, task detail modal state

**Critical Dependencies:**
- `@dnd-kit/core` - Drag and drop functionality
- `@dnd-kit/sortable` - Sortable list implementation
- `sonner` - Toast notifications
- Custom utility: `taskScheduler.ts` - Task scheduling algorithm

### 1.2 Task Bar Component
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/components/timeline/TaskBar.tsx`
- **Size:** 150 lines
- **Purpose:** Renders individual task bars in the Gantt timeline

**Props:**
```typescript
interface TaskBarProps {
  task: Task;
  width: number;  // Pixel width of the bar
  x: number;      // X position in timeline
  y: number;      // Y position in rows
  height: number; // Bar height
  onClick?: (taskId: string, event?: React.MouseEvent) => void;
}
```

**Color Coding:**
- Uses task status to determine bar color (not priority)
- `TODO`: Gray (bg-gray-100)
- `DOING`: Blue (bg-blue-100)
- `DONE`: Green (bg-green-100)
- `BLOCKED`: Red (bg-red-100)
- `PENDING`: Yellow (bg-yellow-100)
- Other statuses have dedicated colors

**Tooltip:**
Shows on hover with details:
- Task title, priority order
- Assignee
- Effort (hours)
- Priority, Type, Category
- Progress percentage
- Status and tags
- Date range (start to due date)

### 1.3 Priority Task List Component
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/components/timeline/PriorityTaskList.tsx`
- **Size:** 281 lines
- **Purpose:** Sidebar list showing tasks that can be reordered

**Props:**
```typescript
interface PriorityTaskListProps {
  tasks: Task[];
  onTaskClick?: (taskId: string) => void;
  onTaskReorder?: (taskId: string, newIndex: number) => void;
  activePlanId?: string | null;
  autoSort?: boolean;
  title: string;
  showCount?: boolean;
  headerAction?: React.ReactNode;
  containerClassName?: string;
  maxHeight?: string;
}
```

**Sorting Logic:**
- If `activePlanId` exists: sorts by `priority_order` from plan
- If all tasks have `priority_order`: sorts by `priority_order`
- Otherwise: sorts by priority (CRITICAL > URGENT > HIGH > MEDIUM > LOW)
- Filters out completed tasks (DONE status)

### 1.4 Additional Timeline Components

**PriorityTaskCard.tsx** (133 lines)
- Card display for tasks in the priority list
- Shows: title, priority badge, effort, dates, assignee, progress bar
- Supports drag-and-drop via `useSortable` hook

**TaskTooltip.tsx** (119 lines)
- Tooltip component shown on hover
- Displays comprehensive task information
- Positioned relative to task element

**TimelineSkeleton.tsx**
- Loading skeleton while data loads

---

## 2. Project Detail Page Integration

### 2.1 Main Project Detail Component
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/app/projects/[id]/page.tsx`
- **Size:** 47 lines
- **Pattern:** App Router with dynamic segments

**Structure:**
```typescript
export default function ProjectDetail({ params }: { params: { id: string } }) {
  // Wraps ProjectPageWrapper with ProtectedRoute + Suspense
  // Passes project ID to ProjectPage component
}
```

### 2.2 Project Page Wrapper
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/components/projects/ProjectPage.tsx`
- **Size:** 103 lines
- **Role:** Fetches project data from Redux store

**Data Flow:**
1. Dispatches `fetchProject(id)` action
2. Maps Redux project data to `ProjectData` type
3. Passes to `ProjectDetailView` component

### 2.3 Project Detail View (Main Container)
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/components/projects/ProjectDetailView.tsx`
- **Size:** 361 lines
- **Purpose:** Main view container that switches between different tab views

**Supported Views:**
```typescript
type ViewType = 'list' | 'kanban' | 'gantt' | 'members' | 'report' | 'documents';
```

**Gantt View Rendering (lines 351-355):**
```typescript
{activeView === 'gantt' && (
  <div className="card">
    <Timeline />
  </div>
)}
```

**Data Initialization:**
1. Fetches tasks from Redux: `fetchProjectTasks(project.id)`
2. Fetches members: `fetchProjectMembers(project.id)`
3. Fetches plans: `fetchProjectPlans(project.id)`
4. Fetches latest plan: `fetchLatestProjectPlan(project.id)`
5. Processes tasks based on plan presence using `processTasksBasedOnPlan()`
6. Sets `autoSort` based on whether plan exists

### 2.4 Project Layout
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/app/projects/[id]/layout.tsx`
- **Size:** 33 lines
- **Purpose:** Fetches project data and members on route load

---

## 3. Task Data Structures

### 3.1 Task Interface
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/types/task.ts`

**Complete Task Interface:**
```typescript
interface Task {
  // ID fields
  task_id: string;
  id?: string;  // Alias for backward compatibility
  project_id: string;
  projectId?: string;  // Alias
  parent_task_id?: string;

  // Basic info
  title: string;
  description?: string;
  assignee?: UserBasic;
  priority_order: number;

  // Dates
  start_date?: string;
  original_start_date?: string;
  db_start_date?: string;
  force_recalculate?: boolean;
  due_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  created_at?: string;
  updated_at?: string;

  // Progress tracking
  effort?: number;  // Hours
  progress?: number;  // Percentage 0-100

  // Status and categorization
  status: TaskStatus;
  priority: Priority;
  type?: TaskType;
  category?: TaskCategory;
  progress_type?: ProgressType;

  // Additional info
  created_by: string | UserBasic;
  is_deleted?: boolean;
  tags?: TaskTag[];
  child_tasks?: Task[];
  attachments?: any[];
  comments?: any[];
  checklist?: any[];
  custom_fields?: Record<string, any>;
  deadline?: string;
}
```

### 3.2 Task Enums and Types

**TaskStatus:** `'TODO' | 'DOING' | 'DONE' | 'CLOSE' | 'PENDING' | 'REVIEW' | 'BLOCKED' | 'REJECTED' | 'ARCHIVED'`

**Priority:** `'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL'`

**TaskType:** `'Feature' | 'Bug' | 'Enhancement' | 'Documentation'`

**TaskCategory:** `'Frontend' | 'Backend' | 'Design' | 'Testing' | 'DevOps'`

**ProgressType:** `'study' | 'investigate' | 'code' | 'test' | 'review_code' | 'review_test_report' | 'release'`

**TaskTag:** `'Urgent' | 'High Priority' | 'Low Priority' | 'In Progress' | 'Blocked'`

### 3.3 Task Filter Interface
```typescript
interface TaskFilter {
  searchQuery?: string;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
  projectId?: string;
  startDate?: string;
  endDate?: string;
}
```

### 3.4 Assignee Structure
```typescript
interface UserBasic {
  userId: string;
  username: string;
  avatarUrl?: string;
  role?: string;
}
```

---

## 4. Filter Implementation

### 4.1 Task Filter Bar
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/components/tasks/TaskFilterBar.tsx`
- **Size:** 343 lines
- **Type:** Dialog-based filter UI

**Filter Capabilities:**
- **Search:** Text search by title or description
- **Status:** Dropdown select from all TaskStatus enums
- **Priority:** Dropdown select from all Priority levels
- **Project:** Multi-project filter (if available)
- **Assignee:** Dropdown select from available assignees
- **Date Range:** Start and end date pickers
- **Completed Tasks Toggle:** Show/hide completed tasks

**Props:**
```typescript
interface TaskFilterBarProps {
  onFilterChange: (filter: TaskFilter) => void;
  assignees: User[];
  projects: ProjectData[];
  showCompletedTasks: boolean;
  onToggleCompleted: () => void;
}
```

**Features:**
- Visual indicator showing active filters
- "Clear All Filters" button
- Apply/Cancel buttons
- Show/Hide Completed toggle

### 4.2 Task Filter Modal
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/components/tasks/TaskFilterModal.tsx`
- **Size:** 463 lines
- **Type:** Tabbed modal interface

**Tab Organization:**
1. **General Tab:** Search, Status, Priority, Project
2. **Date Tab:** Start and end date filters
3. **People Tab:** Assignee filter
4. **Saved Tab:** Save and load filter presets

**Filter Persistence:**
- Saves filters to `localStorage` under key `'savedTaskFilters'`
- Allows naming and reusing filter combinations
- Shows count of active conditions

### 4.3 Display Labels
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/constants/task-display-labels.ts`

Vietnamese labels for all enums:
- Status labels: "Cần làm", "Đang làm", "Hoàn thành", etc.
- Priority labels: "Thấp", "Trung bình", "Cao", "Khẩn cấp", "Nghiêm trọng"
- Type labels: "Tính năng", "Lỗi", "Cải tiến", "Tài liệu"
- Category labels: "Giao diện", "Máy chủ", "Thiết kế", "Kiểm thử", "Vận hành"
- Progress type labels: "Nghiên cứu", "Điều tra", "Lập trình", etc.

---

## 5. Redux State Management

### 5.1 Tasks Slice
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/redux/features/tasksSlice.ts`

**State Interface:**
```typescript
interface TasksState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  pagination: PaginationData;
  filters: TaskFilter;
}
```

**Key Actions:**
- `fetchProjectTasks(projectId)` - Async thunk to fetch all tasks for a project
- `updateTaskStatus` - Update task status
- `updateTaskAssignee` - Update task assignee
- `updateTaskLocally` - Local optimistic update

### 5.2 Task Order Store
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/redux/features/taskOrderStore.ts`
- **Size:** Large file with complex logic

**State Interface:**
```typescript
interface TaskOrderState {
  orderedTasks: TaskOrderItem[];
  sourceTaskIds: string[];
  isPlanLoaded: boolean;
  currentPlanId: string | null;
  calculatedTaskDates: Record<string, { startDate?: string; endDate?: string }>;
  autoSort: boolean;
}
```

**TaskOrderItem Interface:**
```typescript
interface TaskOrderItem {
  taskId: string;
  title?: string;
  priorityOrder: number;
  startDate?: string;
  endDate?: string;
  effort?: number;
  assigneeId?: string;
  assigneeName?: string;
  priority?: string;
  fromPlan?: boolean;
  status?: string;
  type?: string;
  category?: string;
  progressType?: string;
  progress?: number;
}
```

**Key Reducers:**
- `updateTaskOrder` - Update task ordering
- `updateTasksWithDates` - Update with calculated dates
- `resetTaskOrder` - Reset to initial state
- `initializeFromTasks` - Initialize from Task array
- `updateCalculatedDates` - Track calculated date ranges
- `updateAutoSort` - Toggle auto-sort behavior

---

## 6. Task Scheduling & Date Calculation

### 6.1 Task Scheduler Utility
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/utils/taskScheduler.ts`

**Key Functions:**
- `processTasksAndUpdateStore()` - Main function to process tasks and update Redux
- `processTasksBasedOnPlan()` - Process tasks when plan is available
- `calculateTaskSchedule()` - Calculate start and end dates based on effort
- `sortTasksByPriority()` - Sort by priority (CRITICAL/URGENT/HIGH/MEDIUM/LOW)
- `convertTaskOrderToTask()` - Convert Redux state back to Task object
- `isWeekend()` - Check if date is weekend
- `getNextWorkDay()` - Get next working day (skips weekends)
- `findNextAvailableStartDate()` - Find first available start date for task

**WorkSchedule Interface:**
```typescript
interface WorkSchedule {
  startDate: Date;
  endDate: Date;
}
```

**Algorithm Logic:**
1. Takes tasks with `effort` (hours) and `priority_order`
2. Calculates working day schedule (excludes weekends)
3. Updates `start_date` and `due_date` fields
4. Respects existing dates if already set
5. Can be forced to recalculate with `force_recalculate` flag

---

## 7. Key Data Flow Diagrams

### 7.1 Gantt Chart Loading Flow
```
ProjectDetailView
  ↓
  fetchProjectTasks() → Redux tasks
  fetchProjectMembers() → Redux members
  fetchProjectPlans() → Redux plans
  fetchLatestProjectPlan() → Redux activePlan
  ↓
  handleDataProcessing()
    ↓
    processTasksBasedOnPlan() → taskOrderStore
    ↓
    updateAutoSort()
  ↓
  <Timeline component rendered with orderedTasks from Redux>
```

### 7.2 Task Reordering Flow
```
PriorityTaskList (drag-drop)
  ↓
  handleDragEnd()
  ↓
  processTasksAndUpdateStore()
  ↓
  dispatch(updateTaskOrderAndDates)
  ↓
  Redux taskOrderStore updated
  ↓
  Timeline re-renders with new order
```

### 7.3 Task Filter Flow
```
TaskFilterBar/Modal
  ↓
  handleFilterChange(newFilter)
  ↓
  onFilterChange callback
  ↓
  Redux filters slice updated
  ↓
  Components re-filter displayed tasks
```

---

## 8. File Location Reference

### Core Components
- Gantt Timeline: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/timeline/Timeline.tsx`
- Task Bar: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/timeline/TaskBar.tsx`
- Priority List: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/timeline/PriorityTaskList.tsx`
- Priority Card: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/timeline/PriorityTaskCard.tsx`
- Task Tooltip: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/timeline/TaskTooltip.tsx`

### Project Detail
- Project Detail Page: `/Users/TienVNV/Desktop/ProjectManager/web/src/app/projects/[id]/page.tsx`
- Project Page: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/projects/ProjectPage.tsx`
- Project Detail View: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/projects/ProjectDetailView.tsx`
- Project Layout: `/Users/TienVNV/Desktop/ProjectManager/web/src/app/projects/[id]/layout.tsx`

### Filter Components
- Filter Bar: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/tasks/TaskFilterBar.tsx`
- Filter Modal: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/tasks/TaskFilterModal.tsx`
- Display Labels: `/Users/TienVNV/Desktop/ProjectManager/web/src/constants/task-display-labels.ts`

### Types & Utils
- Task Types: `/Users/TienVNV/Desktop/ProjectManager/web/src/types/task.ts`
- Task Scheduler: `/Users/TienVNV/Desktop/ProjectManager/web/src/utils/taskScheduler.ts`

### Redux Slices
- Tasks Slice: `/Users/TienVNV/Desktop/ProjectManager/web/src/redux/features/tasksSlice.ts`
- Task Order Store: `/Users/TienVNV/Desktop/ProjectManager/web/src/redux/features/taskOrderStore.ts`
- Plans Slice: `/Users/TienVNV/Desktop/ProjectManager/web/src/redux/features/plansSlice.ts`

### Old Pages (Legacy)
- Old Gantt Page: `/Users/TienVNV/Desktop/ProjectManager/web/src/pages/projects/[id]/gantt.tsx`
- GanttChart Component: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/tasks/GanttChart.tsx` (appears empty)

---

## 9. Technical Stack Summary

**Frontend Framework:** React 18+ (App Router - Next.js 13+)
**State Management:** Redux Toolkit
**UI Components:** Tailwind CSS + Headless UI
**Drag & Drop:** @dnd-kit (modern, headless drag-drop library)
**Icons:** Lucide React, Heroicons
**Date Handling:** date-fns
**GraphQL:** Apollo Client
**Form State:** Custom React hooks

---

## 10. Key Implementation Notes

1. **Bidirectional Task ID Support:** The Task interface supports both `task_id` and `id` for backward compatibility
2. **Status-Based Coloring:** TaskBar colors are based on status, not priority (despite priority field existing)
3. **Work Schedule:** The app respects weekends by default when calculating task dates
4. **Plan Integration:** When a plan is active, task ordering from the plan takes precedence over priority-based sorting
5. **Local Storage:** Both date range and filter presets are persisted to localStorage
6. **Optimistic Updates:** The system supports local task updates while pending API calls
7. **Memo Optimization:** Components use useMemo extensively to prevent unnecessary re-renders

---

## 11. Unresolved Questions / Areas for Enhancement

1. **Filter Application to Gantt:** How are filters from TaskFilterBar applied to Timeline display? Need to trace integration.
2. **Date Calculation Logic:** Detailed algorithm for `calculateTaskSchedule()` - working hours per day assumption?
3. **Plan Data Structure:** Full schema of Plan/PlanTask objects and their relationship to TaskOrderItem?
4. **Concurrent Modifications:** How conflicts are handled when same task is modified in multiple views simultaneously?
5. **Performance:** How the timeline handles 1000+ tasks efficiently?

