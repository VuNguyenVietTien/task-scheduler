# Kanban Board Implementation

## Component Structure

### DragDropProvider
- Location: `src/components/dnd/DragDropProvider.tsx`
- Purpose: Manages drag & drop context and styles
- Key Features:
  - Custom styling for drop targets
  - Clear visual feedback during drag
  - No opacity effects on non-dragged items

### KanbanBoard
- Location: `src/components/tasks/KanbanBoard.tsx`
- Responsibility: Renders columns and task cards
- Features:
  - Columnar layout with status grouping
  - Smooth card transitions
  - Proper placeholder handling

## State Management

### useTaskStatusUpdate Hook
- Location: `src/hooks/useTaskStatusUpdate.ts`
- Purpose: Handles task status mutations
- Implementation:
  - Optimistic updates for instant feedback
  - Proper cache invalidation
  - Error handling with rollback
  - Synchronous cache updates

### QueryClient Configuration
- Location: `src/lib/queryClient.ts`
- Settings:
  - Infinite stale time for manual control
  - Disabled automatic refetching
  - Cache time of 5 minutes
  - Mutation retry configuration

## Visual Design

### Drop Target Highlighting
- Blue background (rgba(37, 99, 235, 0.1))
- Dashed outline border
- Smooth transitions
- No opacity changes on other elements

### Task Card Styles
- Status-based color coding
- Shadow effects for depth
- Subtle rotation during drag
- Smooth transform animations

## Code Organization

### Key Files
```
src/
├── components/
│   ├── dnd/
│   │   ├── DragDropProvider.tsx
│   │   └── StrictModeDroppable.tsx
│   └── tasks/
│       └── KanbanBoard.tsx
├── hooks/
│   ├── useProjectTasks.ts
│   └── useTaskStatusUpdate.ts
└── lib/
    └── queryClient.ts
