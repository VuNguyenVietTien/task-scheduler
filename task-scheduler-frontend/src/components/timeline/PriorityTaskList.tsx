'use client';

import { Task, Priorities } from '@/types/task';
import { PriorityTaskCard } from './PriorityTaskCard';
import { useState, useEffect } from 'react';
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
  const [priorityGroups, setPriorityGroups] = useState<{[key: string]: Task[]}>({});
  
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

  // Group tasks by priority
  useEffect(() => {
    const groups = tasks.reduce((acc, task) => {
      const priority = task.priority.toLowerCase();
      if (!acc[priority]) {
        acc[priority] = [];
      }
      acc[priority].push(task);
      return acc;
    }, {} as {[key: string]: Task[]});

    // Sort tasks within each priority group by priority_order
    Object.keys(groups).forEach(priority => {
      groups[priority].sort((a, b) => a.priority_order - b.priority_order);
    });

    setPriorityGroups(groups);
  }, [tasks]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    if (active.id !== over.id) {
      const taskId = active.id as string;
      const activeTask = tasks.find(t => t.task_id === taskId);
      if (!activeTask) return;

      const overTask = tasks.find(t => t.task_id === over.id);
      if (!overTask) return;

      // Only allow reordering within the same priority group
      if (activeTask.priority !== overTask.priority) return;

      const oldIndex = tasks.findIndex(t => t.task_id === taskId);
      const newIndex = tasks.findIndex(t => t.task_id === over.id);

      onTaskReorder?.(taskId, newIndex);

      // Update local state optimistically
      const currentGroup = [...priorityGroups[activeTask.priority]];
      const oldGroupIndex = currentGroup.findIndex(t => t.task_id === taskId);
      const newGroupIndex = currentGroup.findIndex(t => t.task_id === over.id);
      
      const [movedTask] = currentGroup.splice(oldGroupIndex, 1);
      currentGroup.splice(newGroupIndex, 0, movedTask);

      setPriorityGroups(prev => ({
        ...prev,
        [activeTask.priority]: currentGroup
      }));
    }
  };

  const renderPriorityGroup = (priority: string, tasks: Task[]) => {
    return (
      <div key={priority} className="mb-6 last:mb-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold capitalize">{priority}</h3>
          <span className="text-sm text-slate-500">{tasks.length} tasks</span>
        </div>
        <div className="space-y-3">
          <SortableContext 
            items={tasks.map(t => t.task_id)}
            strategy={verticalListSortingStrategy}
          >
            {tasks.map(task => (
              <PriorityTaskCard 
                key={task.task_id}
                task={task}
                onClick={onTaskClick}
              />
            ))}
          </SortableContext>
        </div>
      </div>
    );
  };

  // Render priority groups in order
  const priorityOrder = [
    Priorities.URGENT,
    Priorities.HIGH,
    Priorities.MEDIUM,
    Priorities.LOW,
  ].reverse(); // Reverse to show highest priority first

  return (
    <div className="space-y-6 p-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        {priorityOrder.map(priority => (
          priorityGroups[priority] && 
          renderPriorityGroup(priority, priorityGroups[priority])
        ))}
      </DndContext>
    </div>
  );
}
