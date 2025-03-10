'use client';

import { Task, Priority, Priorities } from '@/types/task';
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
    isDragging
  } = useSortable({ id: task.task_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case Priorities.URGENT:
        return 'border-l-4 border-l-red-600';
      case Priorities.HIGH:
        return 'border-l-4 border-l-orange-600';
      case Priorities.MEDIUM:
        return 'border-l-4 border-l-amber-600';
      case Priorities.LOW:
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
        bg-white rounded-lg select-none relative
        ${getPriorityColor(task.priority)}
        ${isDragging 
          ? 'shadow-lg ring-2 ring-blue-500 scale-[1.02] z-50' 
          : 'shadow-sm hover:shadow-md'
        }
        transition-all duration-100 ease-in-out
        touch-manipulation
      `}
    >
      {/* Task Content */}
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-medium text-slate-900 truncate flex-1">
            {task.title}
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            {/* Due Date */}
            {task.due_date && (
              <span className="text-xs text-slate-500 whitespace-nowrap">
                {formatDate(task.due_date)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          {/* Assignee */}
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

          {/* Progress */}
          {task.effort && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <span>{task.progress || 0}%</span>
              <span>•</span>
              <span>{task.effort}h</span>
            </div>
          )}
        </div>
      </div>

      {/* Drag Handle */}
      <div 
        className={`
          absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-0
          group-hover:opacity-50 rounded-l
          transition-opacity duration-150
          ${isDragging ? 'opacity-100' : ''}
        `}
      />
    </div>
  );
}
