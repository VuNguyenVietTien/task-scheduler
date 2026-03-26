# Phase 5: Update TaskListView Click Behavior (Modal vs Navigate)

## Context Links
- TaskListView: `frontend/src/components/tasks/TaskListView.tsx`
- handleTaskClick: lines 727-760
- TaskDetail modal already integrated: lines 1554-1562

## Overview
- **Priority**: P2
- **Status**: complete
- **Description**: Change left-click on task title to open TaskDetail modal (already integrated but unused for click), and preserve ctrl+click/middle-click for full page navigation

## Key Insights
- TaskListView **already has** `selectedTask` state, `isTaskDetailOpen` state, and renders `<TaskDetail>` modal (lines 1554-1562)
- BUT `handleTaskClick` (line 727) navigates via `router.push()` instead of opening the modal
- The fix is simply changing `handleTaskClick` to open modal on left-click and navigate on ctrl/middle-click
- This is the **smallest change** of all phases

## Requirements
### Functional
- Left click on task title -> open existing TaskDetail modal
- Ctrl+click / middle click -> navigate to full detail page (current behavior)
- Modal changes should update list data

### Non-functional
- No new components or state needed

## Related Code Files
### Modify
- `frontend/src/components/tasks/TaskListView.tsx` — update `handleTaskClick` function only

## Implementation Steps

1. **Update `handleTaskClick`** (line 727-760) to accept MouseEvent and branch:
   ```typescript
   const handleTaskClick = useCallback((taskId: string, event?: React.MouseEvent) => {
     // Find the task
     let foundTask: Task | undefined = tasks.find(t => t.task_id === taskId || t.id === taskId);
     if (!foundTask) {
       for (const parentTask of tasks) {
         if (parentTask.child_tasks?.length) {
           foundTask = parentTask.child_tasks.find(child => child.task_id === taskId || child.id === taskId);
           if (foundTask) break;
         }
       }
     }

     if (!foundTask) {
       console.warn(`Task not found: ${taskId}`);
       return;
     }

     // Ctrl+click / middle click -> navigate to full page
     if (event?.ctrlKey || event?.metaKey || event?.button === 1) {
       event.preventDefault();
       const url = `/projects/${foundTask.project_id}/tasks/${taskId}`;
       window.open(url, '_blank');
       return;
     }

     // Left click -> open modal
     setSelectedTask(foundTask);
     setIsTaskDetailOpen(true);

     if (onTaskClick) onTaskClick(taskId);
   }, [tasks, onTaskClick]);
   ```

2. **Update onClick calls** to pass the event:
   - Line 441: `onClick={(e) => handleTaskClick(childTask.task_id, e)}`
   - Line 1224: `onClick={(e) => handleTaskClick(task.task_id, e)}`
   - Search for any other `handleTaskClick` calls and update similarly

3. **Add onMouseDown handler** for middle-click support (middle click fires onMouseDown, not always onClick):
   ```tsx
   onMouseDown={(e) => {
     if (e.button === 1) { // middle click
       e.preventDefault();
       handleTaskClick(task.task_id, e as any);
     }
   }}
   ```

## Todo List
- [ ] Update handleTaskClick to accept MouseEvent param
- [ ] Branch: left click -> open modal, ctrl/middle -> navigate
- [ ] Update all onClick calls to pass event
- [ ] Add onMouseDown for middle-click detection
- [ ] Test: left click opens modal
- [ ] Test: ctrl+click opens in new tab
- [ ] Test: middle click opens in new tab
- [ ] Test: modal changes update list view

## Success Criteria
- Left click opens TaskDetail modal (already rendered in component)
- Ctrl+click / middle click navigates to full page in new tab
- Existing inline editing in table cells still works (stopPropagation already in place)

## Risk Assessment
- Low — TaskDetail modal is already integrated; only changing the click routing logic
- Inline cell editing uses stopPropagation so won't conflict

## Security Considerations
- None

## Unresolved Questions
- Should `onTaskClick` prop callback still fire on left-click (modal open) or only on navigation? Current plan: fire on both.
