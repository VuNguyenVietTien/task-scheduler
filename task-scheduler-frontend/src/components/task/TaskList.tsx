'use client';

import { useTaskFilters } from '@/hooks/useTaskFilters';
import { TaskFilters } from './TaskFilters';
import { TaskItem } from './TaskItem';
import { Task } from '@/types/task';

interface TaskListProps {
  tasks: Task[];
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
}

export function TaskList({ tasks, onTaskUpdate }: TaskListProps) {
  const {
    filters,
    sort,
    filteredTasks,
    stats,
    handleFilterChange,
    handleSortChange
  } = useTaskFilters(tasks);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Task Statistics</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <h4 className="text-sm font-medium text-gray-500">Total Tasks</h4>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{stats.total}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500">By Priority</h4>
            <div className="mt-1 space-y-1">
              {Object.entries(stats.byPriority).map(([priority, count]) => (
                <div key={priority} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 capitalize">{priority}</span>
                  <span className="text-sm font-medium text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500">By Status</h4>
            <div className="mt-1 space-y-1">
              {Object.entries(stats.byStatus).map(([status, count]) => (
                <div key={status} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 capitalize">{status}</span>
                  <span className="text-sm font-medium text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <TaskFilters
        onFilterChange={handleFilterChange}
        onSortChange={handleSortChange}
        initialFilters={filters}
        initialSort={sort}
      />

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul role="list" className="divide-y divide-gray-200">
          {filteredTasks.map(task => (
            <li key={task.id}>
              <TaskItem task={task} onUpdate={onTaskUpdate} />
            </li>
          ))}
        </ul>
      </div>
      
      {filteredTasks.length === 0 && (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No tasks found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your filters to find what you&apos;re looking for.
          </p>
        </div>
      )}
    </div>
  );
}
