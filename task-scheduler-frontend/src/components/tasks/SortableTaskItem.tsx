'use client';

import { Task } from '@/types/task';
import { format } from 'date-fns';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UserAvatar } from '@/components/common/UserAvatar';
import { useMemo } from 'react';

interface SortableTaskItemProps {
  task: Task;
  isOver?: boolean;
  isDragOverlay?: boolean;
  dragPosition?: 'before' | 'after' | 'self' | 'none';
}

export function SortableTaskItem({ 
  task,
  isOver = false,
  isDragOverlay = false,
  dragPosition = 'none',
}: SortableTaskItemProps) {
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
      task,
      status: task.status,
    },
    disabled: isDragOverlay,
  });

  const style = useMemo(() => ({
    transform: CSS.Transform.toString(transform),
    transition: [
      'transform 200ms cubic-bezier(0.2, 1, 0.1, 1)',
      'box-shadow 200ms cubic-bezier(0.2, 1, 0.1, 1)',
      'opacity 200ms ease',
      'border-color 200ms ease',
      'background-color 200ms ease',
    ].join(', '),
  }), [transform]);

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

  const getTaskStateClasses = () => {
    if (isDragOverlay) {
      return 'opacity-95 shadow-lg ring-2 ring-blue-400/50 scale-[1.02] z-50 bg-white task-drag-preview';
    }
    if (isDragging) {
      return 'opacity-30 shadow-sm scale-[0.98] z-0 bg-white';
    }
    if (isOver) {
      return 'shadow-md scale-[1.02] ring-2 ring-blue-400/40 bg-blue-50/50 z-20';
    }
    
    // For cards that need to move to make space
    if (dragPosition === 'before') {
      return 'hover:shadow-sm hover:-translate-y-0.5 bg-white';
    }
    if (dragPosition === 'after') {
      return 'hover:shadow-sm hover:-translate-y-0.5 bg-white';
    }
    
    return 'hover:shadow-sm hover:-translate-y-0.5 bg-white';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        relative rounded-lg select-none touch-manipulation
        ${getPriorityColor(task.priority)}
        ${getTaskStateClasses()}
        transition-all duration-200 ease-out transform-gpu
        will-change-transform
      `}
      data-task-id={task.task_id}
      data-status={task.status}
      data-priority={task.priority}
      data-dragging={isDragging}
      data-is-over={isOver}
      data-drag-position={dragPosition}
      data-is-overlay={isDragOverlay}
    >
      <div className="p-3 relative">
        {/* Task Header */}
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

        {/* Task Details */}
        <div className="flex items-center justify-between gap-2 mt-2">
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

          {/* Progress and Effort */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
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
            {task.effort && (
              <span className="px-1.5 py-0.5 bg-slate-100 rounded">
                {task.effort}h
              </span>
            )}
          </div>
        </div>

        {/* Drag Handle Indicator */}
        {!isDragging && !isDragOverlay && (
          <div 
            className={`
              absolute inset-y-0 left-0 w-1 bg-current opacity-0
              group-hover:opacity-100 transition-opacity duration-200
            `}
          />
        )}

        {/* Drop Indicator */}
        {isOver && !isDragging && !isDragOverlay && (
          <div 
            className="
              absolute inset-0 pointer-events-none rounded
              bg-gradient-to-b from-blue-400/10 to-blue-400/20
              border-2 border-blue-400/40
              transition-opacity duration-200
              drop-spotlight
            "
          />
        )}
      </div>

      {/* Drag Preview Overlay */}
      {(isDragging || isDragOverlay) && (
        <div 
          className={`
            absolute inset-0 rounded-lg pointer-events-none
            ${isDragOverlay 
              ? 'bg-white/10 border-2 border-blue-500/50 shadow-xl'
              : 'bg-blue-400/5 border-2 border-blue-400/30'
            }
            transition-opacity duration-200
          `}
        />
      )}
    </div>
  );
}
