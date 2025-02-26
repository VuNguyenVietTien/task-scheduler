import React from 'react';
import { Task, TaskStatus } from '@/types/task';
import clsx from 'clsx';

export interface SubtaskListProps {
  subtasks: Task[];
  onSubtaskClick: (subtaskId: string) => void;
  onStatusChange: (subtaskId: string, status: TaskStatus) => void;
  onAddSubtask: () => void;
  groupByStatus?: boolean;
  showEffortSummary?: boolean;
  showProgress?: boolean;
}

export const SubtaskList: React.FC<SubtaskListProps> = ({
  subtasks,
  onSubtaskClick,
  onStatusChange,
  onAddSubtask,
  groupByStatus = false,
  showEffortSummary = false,
  showProgress = false,
}) => {
  const totalEffortHours = subtasks.reduce((sum, task) => sum + (task.effortHours || 0), 0);
  const completedTasks = subtasks.filter(task => task.status === TaskStatus.DONE).length;
  const progressPercentage = Math.round((completedTasks / subtasks.length) * 100) || 0;

  const getStatusGroup = () => {
    const groups = Object.values(TaskStatus).reduce<Record<string, Task[]>>((acc, status) => {
      acc[status] = subtasks.filter(task => task.status === status);
      return acc;
    }, {});

    return Object.entries(groups).filter(([, tasks]) => tasks.length > 0);
  };

  const renderSubtaskItem = (subtask: Task) => (
    <div
      key={subtask.id}
      data-testid="subtask-item"
      className={clsx(
        'p-4 rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer',
        'bg-white dark:bg-gray-800',
        subtask.status === TaskStatus.DONE && 'opacity-75'
      )}
      onClick={() => onSubtaskClick(subtask.id)}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{subtask.title}</h4>
        <button
          data-testid="status-toggle"
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(subtask.id, subtask.status === TaskStatus.DONE ? TaskStatus.IN_PROGRESS : TaskStatus.DONE);
          }}
          className={clsx(
            'px-2 py-1 rounded-full text-xs font-medium',
            subtask.status === TaskStatus.DONE
              ? 'bg-green-100 text-green-800'
              : 'bg-yellow-100 text-yellow-800'
          )}
        >
          {subtask.status === TaskStatus.DONE ? 'Done' : 'In Progress'}
        </button>
      </div>

      {subtask.description && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {subtask.description}
        </p>
      )}

      {subtask.effortHours && (
        <div className="mt-2 text-xs text-gray-500">
          Effort: {subtask.effortHours}h
        </div>
      )}
    </div>
  );

  if (subtasks.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">No subtasks yet</p>
        <button
          onClick={onAddSubtask}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Add Subtask
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showEffortSummary && (
        <div className="text-sm text-gray-500">
          Total Effort: {totalEffortHours}h
        </div>
      )}

      {showProgress && (
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-500">{progressPercentage}% complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              role="progressbar"
              aria-valuenow={progressPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
              className={clsx(
                'h-2 rounded-full bg-blue-600 transition-all duration-300'
              )}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      )}

      {groupByStatus ? (
        <div className="space-y-6">
          {getStatusGroup().map(([status, tasks]) => (
            <div key={status} data-testid={`status-group-${status}`}>
              <h3 className="text-lg font-medium mb-3">
                {status.replace(/_/g, ' ')}
              </h3>
              <div className="space-y-3">
                {tasks.map(renderSubtaskItem)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {subtasks.map(renderSubtaskItem)}
        </div>
      )}

      <div className="mt-4">
        <button
          onClick={onAddSubtask}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Add Subtask
        </button>
      </div>
    </div>
  );
};
