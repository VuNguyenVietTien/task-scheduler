'use client';

import { Task } from '@/types/task';
import { format } from 'date-fns';
import { UserAvatar } from '@/components/common/UserAvatar';

interface SortableTaskCardProps {
  task: Task;
}

export function SortableTaskCard({ task }: SortableTaskCardProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return 'border-l-4 border-l-red-600';
      case 'high':
        return 'border-l-4 border-l-orange-600';
      case 'medium':
        return 'border-l-4 border-l-amber-600';
      case 'low':
        return 'border-l-4 border-l-green-600';
      default:
        return 'border-l-4 border-l-slate-600';
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return null;
    return format(new Date(dateString), 'dd/MM');
  };

  return (
    <div
      className={`
        bg-white rounded-lg select-none relative shadow-lg ring-2 ring-blue-500 scale-[1.02] z-50
        ${getPriorityColor(task.priority)}
        touch-manipulation
      `}
    >
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-medium text-slate-900 truncate flex-1">
            {task.title}
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            {task.due_date && (
              <span className="text-xs text-slate-500 whitespace-nowrap">
                {formatDate(task.due_date)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          {task.assignee && (
            <div className="flex items-center gap-1">
              <UserAvatar 
                username={task.assignee.username}
                avatarUrl={task.assignee.avatarUrl}
                size="sm"
              />
              <span className="text-xs text-slate-600 truncate max-w-[100px]">
                {task.assignee.username}
              </span>
            </div>
          )}

          {task.effort && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <span>{task.progress || 0}%</span>
              <span>•</span>
              <span>{task.effort}h</span>
            </div>
          )}
        </div>
      </div>

      <div 
        className="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l"
      />
    </div>
  );
}