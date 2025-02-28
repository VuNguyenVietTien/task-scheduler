'use client';

import React from 'react';
import { Task, TaskStatus } from '@/types/task';

interface TaskBarProps {
  task: Task;
  width: number;
  x: number;
  y: number;
  height: number;
  onClick?: (taskId: string) => void;
}

export function TaskBar({ task, width, x, y, height, onClick }: TaskBarProps) {
  const getStatusColor = () => {
    switch (task.status) {
      case TaskStatus.PLANNED:
        return 'bg-slate-100 border-slate-300';
      case TaskStatus.IN_PROGRESS:
        return 'bg-blue-100 border-blue-300';
      case TaskStatus.DONE:
        return 'bg-green-100 border-green-300';
      default:
        return 'bg-slate-100 border-slate-300';
    }
  };

  const getPriorityColor = () => {
    switch (task.priority) {
      case 'high':
        return 'bg-red-100';
      case 'medium':
        return 'bg-yellow-100';
      case 'low':
        return 'bg-green-100';
      default:
        return 'bg-slate-100';
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(task.id)}
      onKeyPress={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick?.(task.id);
        }
      }}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${x}px, ${y - height/2}px)`,
      }}
      className={`
        relative flex items-center rounded-md border shadow-sm cursor-pointer
        hover:shadow-md transition-shadow
        ${getStatusColor()}
      `}
    >
      <div className="absolute inset-0 flex items-center px-2 truncate">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`
            flex-shrink-0 w-2 h-2 rounded-full
            ${getPriorityColor()}
          `} />
          <span className="truncate text-sm font-medium">
            {task.title}
          </span>
          {task.assignees?.length > 0 && (
            <span className="flex-shrink-0 text-xs text-slate-500">
              {task.assignees[0].name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
