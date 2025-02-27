'use client';

import { Task } from '@/types/task';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableTaskItemProps {
  task: Task;
}

export function SortableTaskItem({ task }: SortableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: task.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        p-3 bg-white rounded-md shadow-sm cursor-grab
        ${isDragging ? 'opacity-50 ring-2 ring-blue-500' : 'hover:shadow-md'}
        transition-all duration-200
      `}
    >
      <h4 className="font-medium text-gray-900">{task.title}</h4>
      <p className="text-sm text-gray-500 mt-1">{task.description}</p>
      {/* Add any additional task information here */}
    </div>
  );
}
