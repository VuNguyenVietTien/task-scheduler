'use client';

import { Task, TaskStatus, TaskStatuses } from '@/types/task';
import { useEffect, useState } from 'react';
import { DndContext, DragEndEvent, useSensors, useSensor, PointerSensor } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useUpdateTaskStatus } from '@/hooks/useTaskMutations';
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

const COLUMN_DEFINITIONS: Array<{id: TaskStatus; title: string}> = [
  { id: TaskStatuses.TODO, title: 'Todo' },
  { id: TaskStatuses.DOING, title: 'In Progress' },
  { id: TaskStatuses.PENDING, title: 'Pending' },
  { id: TaskStatuses.REVIEW, title: 'Review' },
  { id: TaskStatuses.BLOCKED, title: 'Blocked' },
  { id: TaskStatuses.DONE, title: 'Done' },
  { id: TaskStatuses.CLOSE, title: 'Closed' },
  { id: TaskStatuses.REJECTED, title: 'Rejected' },
  { id: TaskStatuses.ARCHIVED, title: 'Archived' },
];

export function KanbanBoard({ tasks, onTasksReorder }: KanbanBoardProps) {
  const [columns, setColumns] = useState<Column[]>([]);
  const [updateTaskStatus] = useUpdateTaskStatus();

  console.log('KanbanBoard: Received tasks', tasks);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    // Initialize columns with tasks
    const initialColumns: Column[] = COLUMN_DEFINITIONS.map(col => ({
      ...col,
      tasks: tasks.filter(task => task.status === col.id) || []
    }));

    setColumns(initialColumns);
  }, [tasks]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const targetColumnId = over.id as TaskStatus;

    // Find task being dragged
    const draggedTask = tasks.find(t => t.task_id === taskId);
    if (!draggedTask) return;

    try {
      // Call mutation to update status
      await updateTaskStatus({
        variables: {
          taskId,
          status: targetColumnId
        }
      });

      // Update UI optimistically
      const updatedTasks = tasks.map(task =>
        task.task_id === taskId
          ? { ...task, status: targetColumnId }
          : task
      );

      // Update columns
      const newColumns = columns.map(column => ({
        ...column,
        tasks: updatedTasks.filter(task => task.status === column.id)
      }));

      setColumns(newColumns);
      onTasksReorder?.(updatedTasks);
      
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  return (
    <div className="flex gap-4 h-full overflow-x-auto p-4 pb-8">
      <DndContext 
        onDragEnd={handleDragEnd}
        sensors={sensors}
        modifiers={[restrictToVerticalAxis]}
      >
        <div className="flex gap-4">
          {columns.map(column => (
            <div
              key={column.id}
              className="flex-1 min-w-[300px] bg-gray-50 rounded-lg"
            >
              <div className="p-3 font-medium text-gray-700 border-b bg-white rounded-t-lg">
                {column.title} ({column.tasks.length})
              </div>
              <SortableContext 
                items={column.tasks.map(task => task.task_id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="p-2 space-y-2 min-h-[200px]">
                  {column.tasks.map(task => (
                    <SortableTaskItem key={task.task_id} task={task} />
                  ))}
                </div>
              </SortableContext>
            </div>
          ))}
        </div>
      </DndContext>
    </div>
  );
}
