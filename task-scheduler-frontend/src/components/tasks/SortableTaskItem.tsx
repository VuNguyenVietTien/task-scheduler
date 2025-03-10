'use client';

import { Task } from '@/types/task';
import { format } from 'date-fns';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UserAvatar } from '@/components/common/UserAvatar';

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
    isDragging,
  } = useSortable({
    id: task.task_id,
    data: {
      type: 'Task',
      task
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ? `transform 200ms ease, opacity 200ms ease` : undefined,
  };

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
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        bg-white rounded-lg select-none cursor-grab active:cursor-grabbing 
        ${getPriorityColor(task.priority)}
        ${isDragging 
          ? 'opacity-50 shadow-xl ring-2 ring-blue-500 scale-105 z-50 rotate-1' 
          : 'opacity-100 shadow hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.01]'
        }
        transition-all duration-200 ease-out
        transform-gpu will-change-transform
        touch-manipulation
      `}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-medium text-slate-900 truncate flex-1">
            {task.title}
          </h3>
          {task.due_date && (
            <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
              {formatDate(task.due_date)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mt-2">
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

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              {task.progress !== undefined && (
                <div className="flex items-center gap-1">
                  <div className="w-16 h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  <span>{task.progress}%</span>
                </div>
              )}
            </div>
            {task.effort && (
              <span className="px-1.5 py-0.5 bg-slate-100 rounded">
                {task.effort}h
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
