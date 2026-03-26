# Phase 4: Add Task Edit Modal to Timeline (Gantt)

## Context Links
- Timeline: `frontend/src/components/timeline/Timeline.tsx`
- TaskBar: `frontend/src/components/timeline/TaskBar.tsx`
- ProjectDetailView: `frontend/src/components/projects/ProjectDetailView.tsx` (renders `<Timeline />`)

## Overview
- **Priority**: P2
- **Status**: complete
- **Description**: Wire up task click in Gantt/Timeline to open TaskDetail modal instead of doing nothing

## Key Insights
- `Timeline` component accepts `onTaskClick?: (taskId: string) => void` prop
- `TaskBar` already calls `onClick?.(task.task_id)` on click (TaskBar.tsx line 92)
- `ProjectDetailView` renders `<Timeline />` WITHOUT passing `onTaskClick` (line 362)
- Two approaches: (A) handle modal inside Timeline, or (B) handle in ProjectDetailView
- **Approach A preferred** — keeps modal logic co-located with task data in Timeline

## Requirements
### Functional
- Left click on Gantt bar -> open TaskDetail modal
- Ctrl+click / middle click -> navigate to full task detail page
- Modal edits should refresh Gantt view data

### Non-functional
- Minimal changes to Timeline (already large component)

## Related Code Files
### Modify
- `frontend/src/components/timeline/Timeline.tsx` — add modal state, render TaskDetail
- `frontend/src/components/timeline/TaskBar.tsx` — pass MouseEvent to onClick for ctrl/middle detection

### Minor touch
- `frontend/src/components/projects/ProjectDetailView.tsx` — no change needed if modal is inside Timeline

## Implementation Steps

1. **Update TaskBar onClick** to pass event info:
   ```typescript
   // TaskBar.tsx - update onClick prop type
   onClick?: (taskId: string, event: React.MouseEvent) => void;

   // Update the onClick call:
   onClick={(e) => onClick?.(task.task_id, e)}
   ```

2. **Add modal state and imports to Timeline**:
   ```typescript
   import { TaskDetail } from '@/components/tasks/TaskDetail';
   import { useAuth } from '@/contexts/AuthContext';

   const [selectedTask, setSelectedTask] = useState<Task | null>(null);
   const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
   const { user } = useAuth();
   ```

3. **Add internal click handler in Timeline**:
   ```typescript
   const handleTaskBarClick = useCallback((taskId: string, event: React.MouseEvent) => {
     // Ctrl+click / middle click -> new tab
     if (event.ctrlKey || event.metaKey || event.button === 1) {
       // Find task to get project_id
       const task = orderedTasks.find(t => t.task_id === taskId);
       if (task) {
         window.open(`/projects/${task.project_id}/tasks/${taskId}`, '_blank');
       }
       return;
     }

     // Left click -> open modal
     const task = orderedTasks.find(t => t.task_id === taskId);
     if (task) {
       setSelectedTask(task);
       setIsTaskDetailOpen(true);
     }

     // Also call external handler if provided
     onTaskClick?.(taskId);
   }, [orderedTasks, onTaskClick]);
   ```

4. **Pass handleTaskBarClick to TaskBar** instances (replace existing onTaskClick usage)

5. **Add handleTaskUpdate and render TaskDetail modal** at bottom of Timeline JSX (same pattern as Phase 3)

## Todo List
- [ ] Update TaskBar onClick to pass MouseEvent
- [ ] Add modal state to Timeline
- [ ] Add handleTaskBarClick with ctrl/middle detection
- [ ] Wire handleTaskBarClick to TaskBar instances
- [ ] Add handleTaskUpdate callback
- [ ] Render TaskDetail modal in Timeline JSX
- [ ] Test: click bar opens modal
- [ ] Test: ctrl+click opens new tab
- [ ] Test: modal save refreshes Gantt

## Success Criteria
- Clicking Gantt bar opens task edit modal
- Ctrl+click opens full detail page in new tab
- Saved changes reflect in Gantt chart

## Risk Assessment
- Medium — Timeline is a large component; changes should be minimal (state + handler + modal render)
- TaskBar onClick signature change is backward-compatible (event is optional param)

## Security Considerations
- None

## Next Steps
- Phase 5: update TaskListView click behavior
