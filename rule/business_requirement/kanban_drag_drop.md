# Kanban Board Drag & Drop Requirements

## Core Functionality

### 1. Visual Feedback
- Drop target highlighting with light blue background (rgba(37, 99, 235, 0.1))
- Dashed border outline on drop targets
- No opacity changes on non-dragged cards
- Smooth transitions during drag and drop

### 2. Drag & Drop Behavior
- Intuitive card dragging between columns
- Proper placeholder spacing during drag
- Maintain card spacing and layout
- Prevent glitchy animations

### 3. State Management
- Immediate optimistic updates
- Proper error handling with rollback
- Cache management using React Query
- No unwanted state reversions

## Technical Requirements

### 1. Components
```typescript
// DragDropProvider props
interface DragDropProviderProps {
  children: ReactNode;
  onDragEnd: (result: DropResult) => void;
}

// KanbanBoard props
interface KanbanBoardProps {
  tasks: Task[];
  projectId: string;
}
```

### 2. Task Status Update
```typescript
interface UpdateTaskStatusVariables {
  taskId: string;
  newStatus: TaskStatus;
  previousStatus: TaskStatus;
  projectId: string;
}
```

### 3. Cache Configuration
- Infinite stale time
- Manual cache invalidation
- 5-minute cache retention
- Disabled automatic refetching

## UI/UX Guidelines

### 1. Drop Target Styling
```css
/* Active drop target */
[data-rbd-droppable-id][data-is-dragging-over="true"] {
  background-color: rgba(37, 99, 235, 0.1);
  box-shadow: inset 0 0 0 2px rgba(37, 99, 235, 0.4);
  border-radius: 0.5rem;
}
```

### 2. Animation Requirements
- Smooth transitions (duration: 200ms)
- Subtle card rotation during drag
- Clear drop zone indicators
- Responsive cursor changes

## Implementation Notes

### 1. Error Handling
- Capture and log all errors
- Provide visual feedback on failure
- Revert to previous state on error
- Maintain data consistency

### 2. Performance
- Minimize re-renders
- Efficient cache updates
- Smooth animations
- Proper cleanup on unmount

### 3. Testing
- Test drag and drop interactions
- Verify state management
- Check error scenarios
- Validate visual feedback
