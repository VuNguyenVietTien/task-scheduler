'use client';

import { Task, getStatusColor } from '@/types/task';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: task.task_id });

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
      className="p-4 mb-2 bg-white/80 backdrop-blur-sm rounded-lg border border-violet-100/30 shadow-sm cursor-pointer
        hover:shadow hover:bg-white/90 hover:-translate-y-[1px] transition-all"
    >
      <h3 className="font-medium text-violet-900">{task.task_name}</h3>
      <div className="text-sm mt-2 space-y-1">
        <p className="text-violet-600">Effort: {task.effort}h ({Math.ceil(task.effort / 8)} days)</p>
        <p className="text-violet-600">Employee: {task.employee_id}</p>
        {task.start_date && (
          <p className="text-violet-600">Start: {format(new Date(task.start_date), 'dd/MM/yyyy')}</p>
        )}
        <div className="flex items-center mt-2">
          <div
            className="w-2 h-2 rounded-full mr-2"
            style={{ backgroundColor: getStatusColor(task.status) }}
          />
          <span className="text-xs font-medium capitalize text-violet-700">{task.status}</span>
        </div>
      </div>
    </div>
  );
}
