# Task List: Migrate Features from feat/v1.02

## Pages to Migrate
- [ ] Home/Dashboard Page
  - task-scheduler-frontend/src/app/dashboard/page.tsx
- [ ] Projects Pages
  - task-scheduler-frontend/src/app/projects/page.tsx
  - task-scheduler-frontend/src/app/projects/[id]/page.tsx (with LoadingFallback)
  - task-scheduler-frontend/src/app/projects/[id]/add-task/page.tsx

## Authentication & Protection
- [ ] Authentication Components
  - task-scheduler-frontend/src/components/auth/ProtectedRoute.tsx

## Project Views and Components
- [ ] Project View Container
  - task-scheduler-frontend/src/components/projects/ProjectDetailView.tsx (Main view with tab switching)

- [ ] Task List View (Tab 1)
  - task-scheduler-frontend/src/components/tasks/TaskListView.tsx (Container component)
  - task-scheduler-frontend/src/components/tasks/TaskList.tsx (Task list logic)
  - task-scheduler-frontend/src/components/tasks/TaskCard.tsx (Individual task)
  - task-scheduler-frontend/src/components/tasks/TaskFilterBar.tsx (Filtering)
  - task-scheduler-frontend/src/components/tasks/TaskDetails.tsx (Task details)
  - task-scheduler-frontend/src/components/tasks/TaskForm.tsx (Task creation/editing)

- [ ] Kanban Board View (Tab 2)
  - task-scheduler-frontend/src/components/tasks/KanbanBoard.tsx (Drag-drop board)
  - task-scheduler-frontend/src/components/tasks/SortableTaskItem.tsx (Draggable task)
  - task-scheduler-frontend/src/components/tasks/TaskCard.tsx (Shared with list view)

- [ ] Timeline/Gantt View (Tab 3)
  - task-scheduler-frontend/src/components/timeline/Timeline.tsx (Main timeline with DnD)
  - task-scheduler-frontend/src/components/timeline/PriorityTaskList.tsx (Priority tasks)
  - task-scheduler-frontend/src/components/timeline/PriorityTaskCard.tsx (Priority task)
  - task-scheduler-frontend/src/components/timeline/TaskBar.tsx (Timeline bar)
  - task-scheduler-frontend/src/components/timeline/TaskTooltip.tsx (Hover details)
  - task-scheduler-frontend/src/components/timeline/TimelineSkeleton.tsx (Loading state)
  - task-scheduler-frontend/src/lib/utils.ts (Date handling utilities)

## Supporting Components
- [ ] Project Components
  - task-scheduler-frontend/src/components/projects/ProjectDetailView.tsx
- [ ] DnD Components
  - task-scheduler-frontend/src/components/dnd/DragDropProvider.tsx
  - task-scheduler-frontend/src/components/dnd/StrictModeDroppable.tsx
- [ ] UI Navigation
  - task-scheduler-frontend/src/components/ui/navigation/Header.tsx
  - task-scheduler-frontend/src/components/ui/navigation/SideNav.tsx
  - task-scheduler-frontend/src/components/ui/Dialog.tsx

## Data and State Management
- [ ] Hooks and API Integration
  - task-scheduler-frontend/src/hooks/useProjectTasks.ts (Project tasks data)
  - task-scheduler-frontend/src/hooks/useTaskStatusUpdate.ts (Task updates)
  - task-scheduler-frontend/src/hooks/useTasks.ts (Task operations)

- [ ] Mock Data (for development/testing)
  - task-scheduler-frontend/src/data/mockTasks.ts
  - task-scheduler-frontend/src/data/mockData.json

- [ ] Types and Schemas
  - task-scheduler-frontend/src/types/project.ts (Project type definitions)
  - task-scheduler-frontend/src/types/task.ts (Task type definitions)
  - task-scheduler-frontend/src/schemas/taskForm.ts (Form validation)

## Required Dependencies
- [ ] DnD Kit
  - @dnd-kit/core (DndContext, closestCenter, sensors)
  - @dnd-kit/modifiers (restrictToVerticalAxis)
  - @dnd-kit/sortable (arrayMove, SortableContext)
  - @dnd-kit/utilities (CSS helpers)
- [ ] UI Libraries
  - @headlessui/react (Dialogs, Dropdowns)
  - @heroicons/react (Icons)
  - clsx (Class conditionals)
  - tailwindcss (Styling)
- [ ] Form Handling
  - @hookform/resolvers
  - react-hook-form
  - zod (Validation)
- [ ] Data Fetching
  - @tanstack/react-query
- [ ] Date Handling
  - date-fns (getDatesBetween, formatting)

## Migration Steps
1. [ ] Create new branch from latest code
2. [ ] Copy identified files maintaining directory structure
3. [ ] Update imports and dependencies
4. [ ] Test each component individually
5. [ ] Test integrated functionality
6. [ ] Update styles and ensure consistency
7. [ ] Document any breaking changes or updates needed

## Notes
- Features to be migrated from feat/v1.02 branch
- Focus on maintaining functionality of:
  - Home page navigation and layout
  - Project listing and management
  - Project details with 3 tab views (Task List, Kanban, Gantt Chart)
- Ensure all drag-and-drop functionality is preserved
- Maintain existing styling and UI consistency
- Loading states and fallbacks to be included
- Protected routes implementation for authenticated access
- Suspense boundaries for data loading
