import React, { useEffect, useState } from 'react';
import { Task, TaskStatus, TaskFilter } from '@/types/task';
import { TaskCard } from './TaskCard';
import clsx from 'clsx';

export interface TaskListProps {
  tasks: Task[];
  loading?: boolean;
  groupByStatus?: boolean;
  onTaskClick: (taskId: string) => void;
  onTaskStatusChange: (taskId: string, status: TaskStatus) => void;
  onFilterChange: (filter: TaskFilter) => void;
  onSortChange: (sort: { field: string; direction: 'asc' | 'desc' }) => void;
}

const FilterButtons: React.FC<{
  onFilterChange: (filter: TaskFilter) => void;
}> = ({ onFilterChange }) => {
  const statusLabels: Record<TaskStatus, string> = {
    [TaskStatus.IN_PROGRESS]: 'In Progress',
    [TaskStatus.PLANNED]: 'Planned',
    [TaskStatus.BACKLOG]: 'Backlog',
    [TaskStatus.IN_REVIEW]: 'In Review',
    [TaskStatus.DONE]: 'Done',
    [TaskStatus.CANCELLED]: 'Cancelled',
  };

  const priorityLabels: Record<string, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low'
  };

  return (
    <div className="mb-6 flex gap-4">
      <div role="group" aria-label="Filter by status" className="flex gap-2">
        {Object.entries(statusLabels).map(([status, label]) => (
          <button
            key={status}
            onClick={() => onFilterChange({ status: status as TaskStatus })}
            className={clsx(
              'px-3 py-1 rounded-full text-sm font-medium',
              'transition-colors duration-200',
              'hover:bg-gray-100',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="group" aria-label="Filter by priority" className="flex gap-2">
        {(['high', 'medium'] as const).map(priority => (
          <button
            key={priority}
            onClick={() => onFilterChange({ priority })}
            className={clsx(
              'px-3 py-1 rounded-full text-sm font-medium',
              priority === 'high' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
            )}
          >
            {priorityLabels[priority]}
          </button>
        ))}
      </div>
    </div>
  );
};

const SortButtons: React.FC<{
  onSortChange: (sort: { field: string; direction: 'asc' | 'desc' }) => void;
}> = ({ onSortChange }) => (
  <div className="mb-4">
    <button
      onClick={() => onSortChange({ field: 'deadline', direction: 'asc' })}
      className="px-3 py-1 text-sm font-medium text-gray-700 hover:text-gray-900"
      aria-label="Sort by deadline"
    >
      Sort by Deadline
    </button>
  </div>
);

const TaskGroup: React.FC<{
  status: TaskStatus;
  tasks: Task[];
  statusLabel: string;
  onTaskClick: (taskId: string) => void;
  onTaskStatusChange: (taskId: string, status: TaskStatus) => void;
}> = ({ status, tasks, statusLabel, onTaskClick, onTaskStatusChange }) => {
  const groupTasks = tasks.filter(task => task.status === status);
  if (groupTasks.length === 0) return null;

  return (
    <div key={status} role="region" aria-label={statusLabel} className="mb-8">
      <h2 className="text-lg font-semibold mb-4">{statusLabel}</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groupTasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={onTaskClick}
            onStatusChange={onTaskStatusChange}
          />
        ))}
      </div>
    </div>
  );
};

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  loading = false,
  groupByStatus = false,
  onTaskClick,
  onTaskStatusChange,
  onFilterChange,
  onSortChange,
}) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  const statusOrder = [
    TaskStatus.IN_PROGRESS,
    TaskStatus.PLANNED,
    TaskStatus.BACKLOG,
    TaskStatus.IN_REVIEW,
    TaskStatus.DONE,
    TaskStatus.CANCELLED,
  ];

  const statusLabels: Record<TaskStatus, string> = {
    [TaskStatus.IN_PROGRESS]: 'In Progress',
    [TaskStatus.PLANNED]: 'Planned',
    [TaskStatus.BACKLOG]: 'Backlog',
    [TaskStatus.IN_REVIEW]: 'In Review',
    [TaskStatus.DONE]: 'Done',
    [TaskStatus.CANCELLED]: 'Cancelled',
  };

  if (loading) {
    return (
      <div
        data-testid="task-list-loading"
        className="flex items-center justify-center h-64"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <p>No tasks found</p>
      </div>
    );
  }

  return (
    <div>
      <FilterButtons onFilterChange={onFilterChange} />
      <SortButtons onSortChange={onSortChange} />
      {groupByStatus ? (
        <>
          {statusOrder.map(status => (
            <TaskGroup
              key={status}
              status={status}
              tasks={tasks}
              statusLabel={statusLabels[status]}
              onTaskClick={onTaskClick}
              onTaskStatusChange={onTaskStatusChange}
            />
          ))}
        </>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tasks.filter(task => task.id).map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={onTaskClick}
              onStatusChange={onTaskStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
};
