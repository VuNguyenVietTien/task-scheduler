'use client';

import { Task, TaskStatus, TaskStatuses } from '@/types/task';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { 
  DndContext, 
  DragEndEvent,
  useSensors, 
  useSensor, 
  PointerSensor,
  DragOverlay,
  DragStartEvent,
  pointerWithin,
  MeasuringStrategy,
  UniqueIdentifier,
  closestCenter,
  CollisionDetection,
  DragOverEvent,
  dropAnimation,
  defaultDropAnimation,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { useUpdateTaskStatus } from '@/hooks/useTaskMutations';
import { DroppableColumn } from './DroppableColumn';
import { SortableTaskItem } from './SortableTaskItem';

interface KanbanBoardProps {
  tasks: Task[];
  onTasksReorder?: (tasks: Task[]) => void;
}

interface Column {
  id: TaskStatus;
  title: string;
  tasks: Task[];
}

// Convert status to GraphQL enum format
const toGraphQLStatus = (status: TaskStatus): string => {
  const mapping = {
    [TaskStatuses.TODO]: 'TODO',
    [TaskStatuses.DOING]: 'DOING',
    [TaskStatuses.DONE]: 'DONE',
    [TaskStatuses.CLOSE]: 'CLOSE',
    [TaskStatuses.PENDING]: 'PENDING',
    [TaskStatuses.REVIEW]: 'REVIEW',
    [TaskStatuses.BLOCKED]: 'BLOCKED',
    [TaskStatuses.REJECTED]: 'REJECTED',
    [TaskStatuses.ARCHIVED]: 'ARCHIVED',
  };
  return mapping[status];
};

const COLUMN_DEFINITIONS = [
  { id: TaskStatuses.TODO, title: 'Todo' },
  { id: TaskStatuses.DOING, title: 'In Progress' },
  { id: TaskStatuses.PENDING, title: 'Pending' },
  { id: TaskStatuses.REVIEW, title: 'Review' },
  { id: TaskStatuses.BLOCKED, title: 'Blocked' },
  { id: TaskStatuses.DONE, title: 'Done' },
  { id: TaskStatuses.CLOSE, title: 'Closed' },
  { id: TaskStatuses.REJECTED, title: 'Rejected' },
  { id: TaskStatuses.ARCHIVED, title: 'Archived' },
] as const;

const VALID_STATUSES = new Set(Object.values(TaskStatuses));

const measuring = {
  droppable: {
    strategy: MeasuringStrategy.Always
  }
};

// Improved drop animation for smoother transitions
const customDropAnimationConfig = {
  ...defaultDropAnimation,
  dragSourceOpacity: 0.5,
  duration: 300,
  easing: 'cubic-bezier(0.2, 1, 0.1, 1)',
};

export function KanbanBoard({ tasks, onTasksReorder }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [clonedTasks, setClonedTasks] = useState<Task[]>(tasks);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
  const [updateTaskStatus, { loading }] = useUpdateTaskStatus();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset the cloned tasks when the original tasks change
  useEffect(() => {
    setClonedTasks(tasks);
  }, [tasks]);

  const columns = useMemo(() => {
    return COLUMN_DEFINITIONS.map(col => ({
      ...col,
      tasks: clonedTasks
        .filter(task => task.status === col.id)
        .sort((a, b) => a.priority_order - b.priority_order)
    }));
  }, [clonedTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 0, 
        tolerance: 5,
        distance: 5,
      },
    })
  );

  const findContainer = useCallback((id: UniqueIdentifier): Column | undefined => {
    if (!id) return undefined;

    const idString = String(id);
    
    // First check if id is a column id
    if (VALID_STATUSES.has(idString as TaskStatus)) {
      return columns.find(col => col.id === idString);
    }
    
    // Then check if id is a task id
    for (const column of columns) {
      const task = column.tasks.find(task => task.task_id === id);
      if (task) {
        return column;
      }
    }
    
    return undefined;
  }, [columns]);

  const getTaskById = useCallback((id: UniqueIdentifier): Task | undefined => {
    return columns
      .flatMap(col => col.tasks)
      .find(task => task.task_id === id);
  }, [columns]);

  // Improved collision detection that gives priority to columns for better UX
  const collisionDetectionStrategy: CollisionDetection = useCallback((args) => {
    // First, detect collisions with columns
    const columnIntersections = pointerWithin({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        container => VALID_STATUSES.has(String(container.id) as TaskStatus)
      )
    });
    
    if (columnIntersections.length > 0) {
      return columnIntersections;
    }
    
    // If not over a column, use closest center for more accurate task placement
    return closestCenter(args);
  }, []);

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    setActiveId(active.id);
    document.body.classList.add('dragging');
  }, []);

  const handleDragOver = useCallback(({ active, over }: DragOverEvent) => {
    if (!over) {
      setOverId(null);
      return;
    }
    
    setOverId(over.id);
    
    // Optimize UI updates by avoiding unnecessary reordering while dragging
    // But show visual feedback of where it will go
  }, []);

  const handleDragEnd = useCallback(async ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    setOverId(null);
    document.body.classList.remove('dragging');

    if (!over) return;

    try {
      const activeTask = getTaskById(active.id);
      if (!activeTask) return;
      
      const overContainer = findContainer(over.id);
      if (!overContainer) return;
      
      const activeContainer = findContainer(active.id);
      if (!activeContainer) return;
      
      // Create an optimistic update to the UI first
      const newTasks = [...clonedTasks];
      const targetTask = newTasks.find(t => t.task_id === activeTask.task_id);
      
      if (targetTask && activeContainer.id !== overContainer.id) {
        // If moving to a different column, update the status
        const oldStatus = targetTask.status;
        targetTask.status = overContainer.id;
        
        // Update UI immediately for responsive feel
        setClonedTasks(newTasks);
        
        try {
          // Then attempt API update
          const newStatus = toGraphQLStatus(overContainer.id as TaskStatus);
          console.log('Updating task status:', { taskId: activeTask.task_id, status: newStatus });
          
          // Perform optimistic UI update to avoid flickering
          await updateTaskStatus({
            variables: {
              input: {
                taskId: activeTask.task_id,
                status: newStatus
              }
            }
          });
          
          // On success, notify parent of changes
          if (onTasksReorder) {
            onTasksReorder(newTasks);
          }
        } catch (error) {
          console.error('Failed to update task:', error);
          
          // On error, revert the optimistic update
          if (targetTask) {
            targetTask.status = oldStatus;
            setClonedTasks([...newTasks]);
          }
        }
      }
    } catch (error) {
      console.error('Error in drag end handler:', error);
    }
  }, [findContainer, getTaskById, clonedTasks, updateTaskStatus, onTasksReorder]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverId(null);
    document.body.classList.remove('dragging');
    
    // If needed, revert any temporary UI changes made during drag
  }, []);

  const activeTask = useMemo(() => {
    if (!activeId) return null;
    return getTaskById(activeId);
  }, [activeId, getTaskById]);

  return (
    <div className="flex gap-4 h-full overflow-x-auto p-4 pb-8">
      <DndContext 
        sensors={sensors}
        collisionDetection={collisionDetectionStrategy}
        measuring={measuring}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex gap-4">
          {columns.map(column => (
            <SortableContext
              key={column.id}
              items={column.tasks.map(task => task.task_id)}
              strategy={verticalListSortingStrategy}
            >
              <DroppableColumn
                id={column.id}
                title={column.title}
                tasks={column.tasks}
                activeId={activeId}
                overId={overId}
              />
            </SortableContext>
          ))}
        </div>

        <DragOverlay dropAnimation={customDropAnimationConfig}>
          {activeTask && (
            <div className="opacity-95 scale-105 rotate-1 shadow-xl">
              <SortableTaskItem 
                task={activeTask} 
                isDragOverlay={true}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <style jsx global>{`
        body.dragging {
          cursor: grabbing !important;
        }

        body.dragging * {
          cursor: grabbing !important;
        }

        [data-dragging="true"] {
          opacity: 0.5;
        }

        .task-card-enter {
          opacity: 0;
          transform: scale(0.9);
        }
        
        .task-card-enter-active {
          opacity: 1;
          transform: scale(1);
          transition: opacity 300ms, transform 300ms;
        }
        
        .task-card-exit {
          opacity: 1;
          transform: scale(1);
        }
        
        .task-card-exit-active {
          opacity: 0;
          transform: scale(0.9);
          transition: opacity 300ms, transform 300ms;
        }
        
        .task-drag-preview {
          transform: rotate(2deg) scale(1.05);
          opacity: 0.9;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
        }
        
        /* Spotlight effect for dropping */
        .drop-spotlight {
          background: radial-gradient(circle at center, rgba(59, 130, 246, 0.1) 0%, transparent 70%);
          animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
          0% { opacity: 0.3; }
          50% { opacity: 0.6; }
          100% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
