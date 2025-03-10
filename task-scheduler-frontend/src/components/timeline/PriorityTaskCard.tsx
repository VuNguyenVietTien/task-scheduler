'use client';

import { Task } from '@/types/task';
import { format } from 'date-fns';
import { UserAvatar } from '@/components/common/UserAvatar';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PriorityTaskCardProps {
  task: Task;
  onClick?: (taskId: string) => void;
}

export function PriorityTaskCard({ task, onClick }: PriorityTaskCardProps) {
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

  const handleClick = () => {
    onClick?.(task.task_id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`
        bg-white rounded-lg shadow-sm hover:shadow p-3 cursor-pointer
        ${isDragging 
          ? 'shadow-lg ring-2 ring-blue-500 scale-[1.02] z-50' 
          : 'hover:scale-[1.02] transition-transform'
        }
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-slate-900 truncate">
            {task.title}
          </h3>
          {task.description && (
            <p className="mt-1 text-xs text-slate-500 truncate">
              {task.description}
            </p>
          )}
        </div>

        {/* Priority Indicator */}
        <div className="shrink-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize
            ${task.priority === 'urgent' ? 'bg-red-100 text-red-800' :
              task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
              task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-green-100 text-green-800'
            }`}
          >
            {task.priority}
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Assignee */}
          {task.assignee && (
            <div className="flex items-center gap-1">
              <UserAvatar 
                username={task.assignee.username}
                avatarUrl={task.assignee.avatarUrl}
                size="sm"
              />
              <span className="text-xs text-slate-600">
                {task.assignee.username}
              </span>
            </div>
          )}
        </div>

        {/* Due Date */}
        {task.due_date && (
          <span className="text-xs text-slate-500">
            {format(new Date(task.due_date), 'dd/MM')}
          </span>
        )}
      </div>

      {/* Progress Bar */}
      {task.progress !== undefined && (
        <div className="mt-2">
          <div className="w-full bg-slate-200 rounded-full h-1.5">
            <div 
              className="bg-blue-600 h-1.5 rounded-full" 
              style={{width: `${task.progress}%`}}
            />
          </div>
        </div>
      )}
    </div>
  );
}
