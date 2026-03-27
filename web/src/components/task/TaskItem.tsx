'use client';

import { Task, TaskStatus } from '@/types/task';

interface TaskItemProps {
  task: Task;
  onUpdate?: (taskId: string, updates: Partial<Task>) => void;
}

const priorityColors = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800'
} as const;

const statusColors: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-700',
  doing: 'bg-blue-100 text-blue-700',
  done: 'bg-emerald-100 text-emerald-700',
  close: 'bg-slate-100 text-slate-500',
  pending: 'bg-amber-100 text-amber-700',
  review: 'bg-purple-100 text-purple-700',
  blocked: 'bg-red-100 text-red-700',
  rejected: 'bg-pink-100 text-pink-700',
  archived: 'bg-gray-100 text-gray-800',
};

export function TaskItem({ task, onUpdate }: TaskItemProps) {
  return (
    <div className="px-4 py-4 sm:px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <p className="text-sm font-medium text-gray-900 truncate">
            {task.title}
          </p>
          <div className="ml-2 flex-shrink-0 flex">
            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
              priorityColors[task.priority]
            }`}>
              {task.priority}
            </span>
            <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
              statusColors[task.status]
            }`}>
              {task.status}
            </span>
          </div>
        </div>
        <div className="ml-2 flex-shrink-0 flex items-center">
          <div className="text-sm text-gray-500">
            Due {new Date(task.deadline).toLocaleDateString()}
          </div>
          {task.assignee && (
            <div className="ml-4 text-sm text-gray-500">
              {task.assignee}
            </div>
          )}
        </div>
      </div>
      {task.description && (
        <div className="mt-2">
          <p className="text-sm text-gray-600 line-clamp-2">
            {task.description}
          </p>
        </div>
      )}
    </div>
  );
}
