'use client';

import { Task, TaskStatus, TaskStatuses } from '@/types/task';
import { useEffect, useState } from 'react';
import { DndContext, DragEndEvent, useSensors, useSensor, PointerSensor } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useReorderTasks } from '@/hooks/useTasks';
import { SortableTaskItem } from './SortableTaskItem';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

interface KanbanBoardProps {
  tasks: Task[];
  onTasksReorder?: (tasks: Task[]) => void;
}

interface Column {
  id: TaskStatus;
  title: string;
  tasks: Task[];
}

export function KanbanBoard({ tasks, onTasksReorder }: KanbanBoardProps) {
  const [columns, setColumns] = useState<Column[]>([]);
  const reorderTasks = useReorderTasks();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    // Initialize columns with tasks
    const initialColumns: Column[] = [
      { id: TaskStatuses.BACKLOG, title: 'Backlog', tasks: [] },
      { id: TaskStatuses.PLANNED, title: 'Planned', tasks: [] },
      { id: TaskStatuses.IN_PROGRESS, title: 'In Progress', tasks: [] },
      { id: TaskStatuses.IN_REVIEW, title: 'In Review', tasks: [] },
      { id: TaskStatuses.DONE, title: 'Done', tasks: [] },
    ];

    // Distribute tasks to their respective columns
    tasks.forEach(task => {
      const column = initialColumns.find(col => col.id === task.status);
      if (column) {
        column.tasks.push(task);
      }
    });

    setColumns(initialColumns);
  }, [tasks]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const targetColumnId = over.id as TaskStatus;

    // Find the task that was dragged
    const draggedTask = tasks.find(t => t.id === taskId);
    if (!draggedTask) return;

    // Update the task's status
    const updatedTasks = tasks.map(task => 
      task.id === taskId
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
  };

  return (
    <div className="flex gap-4 h-full overflow-x-auto p-4">
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
                items={column.tasks.map(task => task.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="p-2 space-y-2">
                  {column.tasks.map(task => (
                    <SortableTaskItem key={task.id} task={task} />
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
