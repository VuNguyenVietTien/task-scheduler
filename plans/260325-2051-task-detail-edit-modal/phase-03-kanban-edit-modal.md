# Phase 3: Add Task Edit Modal to KanbanBoard

## Context Links
- KanbanBoard: `frontend/src/components/tasks/KanbanBoard.tsx`
- TaskDetail modal: `frontend/src/components/tasks/TaskDetail.tsx`
- ProjectDetailView: `frontend/src/components/projects/ProjectDetailView.tsx`

## Overview
- **Priority**: P2
- **Status**: complete
- **Description**: Add click handler to Kanban task cards that opens TaskDetail modal on left-click and navigates to full detail page on middle-click/ctrl+click

## Key Insights
- KanbanBoard currently has NO onClick handler on task cards (only drag behavior)
- Task cards are rendered inside `<Draggable>` wrappers (lines 593-642)
- TaskDetail modal is already used in TaskListView — same pattern can be reused
- Need to distinguish left-click (open modal) from ctrl+click/middle-click (navigate to page)
- Drag events should NOT trigger click — use a mouseDown/mouseUp distance check or rely on DnD library's click detection

## Requirements
### Functional
- Left click on task card -> open TaskDetail modal with all editable fields
- Ctrl+click / middle click -> navigate to `/projects/{projectId}/tasks/{taskId}`
- Drag should NOT trigger modal open
- Modal has save/cancel; updates reflect in Kanban immediately

### Non-functional
- No performance regression on drag-heavy interactions

## Architecture
```
KanbanBoard
├── state: selectedTask, isTaskDetailOpen
├── TaskCard (inside Draggable)
│   └── onClick handler (checks ctrl/middle vs left click)
└── TaskDetail modal (conditionally rendered)
```

## Related Code Files
### Modify
- `frontend/src/components/tasks/KanbanBoard.tsx` — add click handler, modal state, TaskDetail import

## Implementation Steps

1. **Add imports and state** to KanbanBoard:
   ```typescript
   import { TaskDetail } from './TaskDetail';
   import { useRouter } from 'next/navigation';
   import { useAuth } from '@/contexts/AuthContext';

   // Inside component:
   const [selectedTask, setSelectedTask] = useState<Task | null>(null);
   const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
   const router = useRouter();
   const { user } = useAuth();
   ```

2. **Add click handler function**:
   ```typescript
   const handleTaskCardClick = useCallback((e: React.MouseEvent, task: Task) => {
     // Ctrl+click or middle click -> navigate to full page
     if (e.ctrlKey || e.metaKey || e.button === 1) {
       e.preventDefault();
       const url = `/projects/${task.project_id}/tasks/${task.task_id}`;
       window.open(url, '_blank');
       return;
     }
     // Left click -> open modal
     setSelectedTask(task);
     setIsTaskDetailOpen(true);
   }, []);
   ```

3. **Add onClick to task card div** (line ~600, the div inside Draggable):
   ```tsx
   onClick={(e) => handleTaskCardClick(e, task)}
   ```

4. **Add handleTaskUpdate callback**:
   ```typescript
   const handleTaskUpdate = (taskId: string, updates: Partial<Task>) => {
     if (selectedTask) {
       setSelectedTask({ ...selectedTask, ...updates });
     }
     // Update clonedTasks to reflect change immediately
     setClonedTasks(prev => prev.map(t =>
       t.task_id === taskId ? { ...t, ...updates } : t
     ));
   };
   ```

5. **Render TaskDetail modal** at end of component JSX (before closing `</div>`):
   ```tsx
   {selectedTask && (
     <TaskDetail
       task={selectedTask}
       isOpen={isTaskDetailOpen}
       onClose={() => setIsTaskDetailOpen(false)}
       onTaskUpdate={handleTaskUpdate}
       currentUser={user || undefined}
     />
   )}
   ```

6. **Handle drag vs click conflict**: The DnD library (react-beautiful-dnd) already distinguishes drag from click. A quick click without movement fires onClick normally. No special handling needed.

## Todo List
- [ ] Add state variables: selectedTask, isTaskDetailOpen
- [ ] Add handleTaskCardClick with ctrl/meta/middle-click detection
- [ ] Add onClick to Draggable inner div
- [ ] Add handleTaskUpdate to sync modal changes back to Kanban state
- [ ] Render TaskDetail modal at bottom of component
- [ ] Test: left click opens modal
- [ ] Test: ctrl+click opens new tab
- [ ] Test: drag still works without triggering modal

## Success Criteria
- Left click on Kanban card opens editable modal
- Ctrl+click / middle click opens full detail in new tab
- Drag-and-drop still works correctly
- Changes saved in modal reflect in Kanban board immediately

## Risk Assessment
- Medium — drag vs click interaction. React-beautiful-dnd handles this well but needs testing
- KanbanBoard.tsx is ~657 lines, over the 200-line guideline but adding ~30 lines is acceptable

## Security Considerations
- None — reuses existing TaskDetail modal and update mechanisms

## Next Steps
- Phase 4: same pattern for Timeline/Gantt
