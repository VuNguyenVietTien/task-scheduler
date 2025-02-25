'use client';

import { Task } from '@/types/task';
import { format } from 'date-fns';

interface TaskTooltipProps {
  task: Task;
  style?: React.CSSProperties;
}

export function TaskTooltip({ task, style }: TaskTooltipProps) {
  return (
    <div 
      className="p-4 bg-white rounded-lg shadow-lg min-w-[320px] animate-fadeIn"
      style={{
        ...style,
        transformOrigin: 'top left',
      }}
    >
      <p className="font-medium text-lg mb-3 text-gray-900">{task.task_name}</p>
      <div className="text-sm text-gray-600 space-y-2.5">
        <div className="flex justify-between items-center">
          <span className="text-gray-500">Status</span>
          <span className="font-medium capitalize">{task.status}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">Effort</span>
          <span className="font-medium">{task.effort}h ({Math.ceil(task.effort / 8)} days)</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">Employee</span>
          <span className="font-medium">{task.employee_id}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">Priority</span>
          <span className="font-medium">{task.priority_order}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">Start</span>
          <span className="font-medium">{format(new Date(task.start_date!), 'dd/MM/yyyy')}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">End</span>
          <span className="font-medium">{format(new Date(task.end_date!), 'dd/MM/yyyy')}</span>
        </div>
      </div>
    </div>
  );
}