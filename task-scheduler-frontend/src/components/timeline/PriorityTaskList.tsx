'use client';

import { Task } from '@/types/task';
import { PriorityTaskCard } from './PriorityTaskCard';
import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

interface PriorityTaskListProps {
  tasks: Task[];
  onTaskClick?: (taskId: string) => void;
  onTaskReorder?: (taskId: string, newIndex: number) => void;
}

export function PriorityTaskList({ tasks, onTaskClick, onTaskReorder }: PriorityTaskListProps) {
  const [orderedTasks, setOrderedTasks] = useState(tasks);
  
  // Setup DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    if (active.id !== over.id) {
      const taskId = active.id as string;
      const oldIndex = orderedTasks.findIndex(t => t.task_id === taskId);
      const newIndex = orderedTasks.findIndex(t => t.task_id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Tạo mảng tasks mới với task được di chuyển
        const newTasks = [...orderedTasks];
        const [movedTask] = newTasks.splice(oldIndex, 1);
        newTasks.splice(newIndex, 0, movedTask);

        setOrderedTasks(newTasks);
        onTaskReorder?.(taskId, newIndex);
      }
    }
  };

  return (
    <div className="space-y-6 p-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        <div className="space-y-3">
          <SortableContext 
            items={orderedTasks.map(t => t.task_id)}
            strategy={verticalListSortingStrategy}
          >
            {orderedTasks.map(task => (
              <PriorityTaskCard 
                key={task.task_id}
                task={task}
                onClick={onTaskClick}
              />
            ))}
          </SortableContext>
        </div>
      </DndContext>
    </div>
  );
}
