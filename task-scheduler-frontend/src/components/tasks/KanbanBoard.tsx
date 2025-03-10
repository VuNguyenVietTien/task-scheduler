'use client';

import { Task, TaskStatus, TaskStatuses } from '@/types/task';
import { useEffect, useState } from 'react';
import { 
  DndContext, 
  DragEndEvent,
  useSensors, 
  useSensor, 
  PointerSensor,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  closestCenter,
  pointerWithin,
  getFirstCollision,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable';
import { useUpdateTaskStatus } from '@/hooks/useTaskMutations';
import { useTaskPriorityOrder } from '@/hooks/useTaskPriorityOrder';
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

export function KanbanBoard({ tasks, onTasksReorder }: KanbanBoardProps) {
  const [columns, setColumns] = useState<Column[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [lastDroppableId, setLastDroppableId] = useState<string | null>(null);
  const [updateTaskStatus] = useUpdateTaskStatus();
  const { reorderTask } = useTaskPriorityOrder();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    const initialColumns = COLUMN_DEFINITIONS.map(col => ({
      ...col,
      tasks: tasks
        .filter(task => task.status === col.id)
        .sort((a, b) => a.priority_order - b.priority_order)
    }));
    setColumns(initialColumns);
  }, [tasks]);

  useEffect(() => {
    if (activeId) {
      const handleMouseMove = (event: MouseEvent) => {
        setMousePosition({
          x: event.clientX,
          y: event.clientY,
        });
      };

      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
    }
  }, [activeId]);

  const findColumn = (id: string) => {
    // Check if id is a column id
    const column = columns.find(col => col.id === id);
    if (column) return column;

    // If not, find column containing task with id
    return columns.find(col => col.tasks.some(task => task.task_id === id));
  };

  const findTask = (id: string) => {
    const task = tasks.find(t => t.task_id === id);
    if (task) return task;

    // Check tasks in columns
    for (const column of columns) {
      const found = column.tasks.find(t => t.task_id === id);
      if (found) return found;
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    
    // Add a class to body when dragging starts
    document.body.classList.add('dragging');
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !active) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();

    const activeColumn = findColumn(activeId);
    const overColumn = findColumn(overId);

    if (!activeColumn || !overColumn || activeColumn === overColumn) return;

    // Store the last droppable id for smooth column switching
    setLastDroppableId(overId);

    setColumns(prev => {
      const activeTask = findTask(activeId);
      if (!activeTask) return prev;

      return prev.map(col => {
        // Remove from source
        if (col.id === activeColumn.id) {
          return {
            ...col,
            tasks: col.tasks.filter(t => t.task_id !== activeId)
          };
        }
        // Add to target
        if (col.id === overColumn.id) {
          const updatedTasks = [...col.tasks];
          
          // Find the insertion index based on mouse position
          const overTaskIndex = updatedTasks.findIndex(t => t.task_id === overId);
          const insertIndex = overTaskIndex >= 0 ? overTaskIndex : updatedTasks.length;
          
          updatedTasks.splice(insertIndex, 0, {
            ...activeTask,
            status: overColumn.id
          });

          return {
            ...col,
            tasks: updatedTasks
          };
        }
        return col;
      });
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    document.body.classList.remove('dragging');
    setLastDroppableId(null);

    if (!over || !active) {
      setActiveId(null);
      return;
    }

    const activeId = active.id.toString();
    const overId = over.id.toString();

    try {
      const activeColumn = findColumn(activeId);
      const overColumn = findColumn(overId);

      if (!activeColumn || !overColumn) return;

      const activeTask = findTask(activeId);
      if (!activeTask) return;

      // Update task status if column changed
      if (activeColumn.id !== overColumn.id) {
        await updateTaskStatus({
          variables: {
            taskId: activeId,
            status: overColumn.id
          }
        });

        // Calculate new priority order based on drop position
        const overTaskIndex = overColumn.tasks.findIndex(t => t.task_id === overId);
        const newOrder = overTaskIndex >= 0 ? overTaskIndex + 1 : overColumn.tasks.length + 1;

        await reorderTask(activeId, newOrder);

        // Update local state
        const updatedTasks = tasks.map(task =>
          task.task_id === activeId
            ? {
                ...task,
                status: overColumn.id,
                priority_order: newOrder
              }
            : task
        );

        const newColumns = COLUMN_DEFINITIONS.map(col => ({
          ...col,
          tasks: updatedTasks
            .filter(task => task.status === col.id)
            .sort((a, b) => a.priority_order - b.priority_order)
        }));

        setColumns(newColumns);
        onTasksReorder?.(updatedTasks);
      } else {
        // Reorder within same column
        const oldIndex = activeColumn.tasks.findIndex(t => t.task_id === activeId);
        const newIndex = activeColumn.tasks.findIndex(t => t.task_id === overId);

        if (oldIndex !== newIndex) {
          await reorderTask(activeId, newIndex + 1);

          setColumns(prev => 
            prev.map(col => {
              if (col.id === activeColumn.id) {
                const newTasks = arrayMove(col.tasks, oldIndex, newIndex);
                return {
                  ...col,
                  tasks: newTasks
                };
              }
              return col;
            })
          );
        }
      }
    } catch (error) {
      console.error('Failed to update task:', error);

      // Revert to original state on error
      setColumns(prev => 
        COLUMN_DEFINITIONS.map(col => ({
          ...col,
          tasks: tasks
            .filter(task => task.status === col.id)
            .sort((a, b) => a.priority_order - b.priority_order)
        }))
      );
    }

    setActiveId(null);
  };

  const handleDragCancel = () => {
    document.body.classList.remove('dragging');
    setLastDroppableId(null);
    setActiveId(null);
  };

  const activeTask = activeId ? findTask(activeId) : null;

  return (
    <div className="flex gap-4 h-full overflow-x-auto p-4 pb-8">
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex gap-4">
          {columns.map(column => (
            <DroppableColumn
              key={column.id}
              id={column.id}
              title={column.title}
              tasks={column.tasks}
              isLastDroppable={lastDroppableId === column.id}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: '0.5',
              },
            },
          }),
        }}>
          {activeTask && (
            <div className="transform-gpu touch-none">
              <SortableTaskItem 
                task={activeTask} 
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

        .overflow-x-auto {
          scrollbar-width: thin;
          scrollbar-color: #CBD5E1 #F1F5F9;
        }

        .overflow-x-auto::-webkit-scrollbar {
          height: 8px;
        }

        .overflow-x-auto::-webkit-scrollbar-track {
          background: #F1F5F9;
          border-radius: 4px;
        }

        .overflow-x-auto::-webkit-scrollbar-thumb {
          background-color: #CBD5E1;
          border-radius: 4px;
        }

        .overflow-x-auto::-webkit-scrollbar-thumb:hover {
          background-color: #94A3B8;
        }
      `}</style>
    </div>
  );
}

// Helper for drop animation
const defaultDropAnimationSideEffects = ({
  styles = {},
}: {
  styles?: Record<string, React.CSSProperties>;
} = {}) => (parameters: any) => {
  const { active } = parameters;
  if (!active?.node) return;

  if (styles.active) {
    Object.assign(active.node.style, styles.active);
  }

  return () => {
    if (!active?.node) return;
    if (styles.active) {
      Object.assign(
        active.node.style,
        Object.fromEntries(
          Object.entries(styles.active).map(([key]) => [key, ''])
        )
      );
    }
  };
};
