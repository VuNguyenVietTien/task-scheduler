'use client';

import { Task } from '@/types/task';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';

interface TaskListProps {
  tasks: Task[];
  onReorder: (newOrder: Task[]) => void;
}

export function TaskList({ tasks, onReorder }: TaskListProps) {
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;

    if (active.id !== over.id) {
      const oldIndex = tasks.findIndex((task) => task.task_id === active.id);
      const newIndex = tasks.findIndex((task) => task.task_id === over.id);
      
      // Tạo mảng mới với thứ tự tasks đã thay đổi
      const newOrder = arrayMove(tasks, oldIndex, newIndex);
      
      // Cập nhật lại priority_order cho tất cả tasks dựa trên vị trí mới
      const updatedTasks = newOrder.map((task, index) => ({
        ...task,
        priority_order: index + 1,
        // Reset start_date và end_date để tính toán lại
        start_date: undefined,
        end_date: undefined
      }));
      
      onReorder(updatedTasks);
    }
  };

  return (
    <div className="w-64 border-r bg-cyan-50/30 p-4 overflow-y-auto">
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={tasks.map(task => ({ id: task.task_id }))}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard key={task.task_id} task={task} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
