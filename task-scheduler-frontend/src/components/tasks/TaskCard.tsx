import React from 'react';
import { Task, TaskStatus } from '@/types/task';
import { formatDate } from '@/lib/utils';
import clsx from 'clsx';

export interface TaskCardProps {
  task: Task;
  onClick: (taskId: string) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick, onStatusChange }) => {
  const isOverdue = task.deadline && new Date(task.deadline) < new Date();
  const isNearDeadline = task.deadline && 
    new Date(task.deadline).getTime() - Date.now() < 24 * 60 * 60 * 1000;

  const statusColors = {
    [TaskStatus.BACKLOG]: 'bg-gray-100 text-gray-800',
    [TaskStatus.PLANNED]: 'bg-blue-100 text-blue-800',
    [TaskStatus.IN_PROGRESS]: 'bg-yellow-100 text-yellow-800',
    [TaskStatus.IN_REVIEW]: 'bg-purple-100 text-purple-800',
    [TaskStatus.DONE]: 'bg-green-100 text-green-800',
    [TaskStatus.CANCELLED]: 'bg-red-100 text-red-800',
  };

  const priorityColors = {
    HIGH: 'bg-red-100 text-red-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800',
    LOW: 'bg-green-100 text-green-800',
    URGENT: 'bg-red-500 text-white',
  };

  return (
    <div
      className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
      onClick={() => onClick(task.id)}
      role="button"
      tabIndex={0}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-lg">{task.title}</h3>
        <div className="flex gap-2">
          <span
            className={clsx(
              'px-2 py-1 rounded-full text-xs font-medium',
              statusColors[task.status]
            )}
          >
            {task.status}
          </span>
          <span
            className={clsx(
              'px-2 py-1 rounded-full text-xs font-medium',
              priorityColors[task.priority]
            )}
          >
            {task.priority}
          </span>
        </div>
      </div>

      {task.description && (
        <p className="text-gray-600 text-sm mb-2">{task.description}</p>
      )}

      {task.effortHours && (
        <div className="text-sm text-gray-500 mb-2" data-testid="effort-hours">
          Effort: {task.effortHours}h
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="flex -space-x-2">
          {(task.assignees || []).map((assignee) => (
            <div
              key={assignee.id}
              className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center"
              title={assignee.name}
            >
              {assignee.avatarUrl ? (
                <img
                  src={assignee.avatarUrl}
                  alt={assignee.name}
                  className="w-full h-full rounded-full"
                />
              ) : (
                <span className="text-sm font-medium">
                  {assignee.name.charAt(0)}
                </span>
              )}
            </div>
          ))}
        </div>

        {task.deadline && (
          <div 
            className={clsx(
              'text-sm',
              isOverdue ? 'text-red-600' : isNearDeadline ? 'text-yellow-600' : 'text-gray-500'
            )}
            data-testid={isOverdue ? 'overdue-indicator' : isNearDeadline ? 'deadline-warning' : 'deadline-indicator'}
          >
            {formatDate(task.deadline)}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div
          role="progressbar"
          aria-valuenow={task.status === TaskStatus.DONE ? 100 : 0}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden"
        >
          <div
            className={clsx(
              'h-full transition-all duration-300',
              task.status === TaskStatus.DONE ? 'bg-green-500 w-full' : 'w-0'
            )}
          />
        </div>
      </div>

      {/* Status change button */}
      <button
        aria-label="Change status"
        onClick={(e) => {
          e.stopPropagation();
          const nextStatus = task.status === TaskStatus.DONE ? TaskStatus.IN_PROGRESS : TaskStatus.DONE;
          onStatusChange(task.id, nextStatus);
        }}
        className="mt-2 text-sm text-blue-600 hover:text-blue-800"
      >
        {task.status === TaskStatus.DONE ? 'Reopen' : 'Mark as Done'}
      </button>
    </div>
  );
};
