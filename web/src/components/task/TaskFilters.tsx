'use client';

import { useState } from 'react';
import { TaskStatus } from '@/types/task';
import { TaskFilter, TaskSort } from '@/hooks/useTaskFilters';

interface TaskFiltersProps {
  onFilterChange: (filters: TaskFilter) => void;
  onSortChange: (sort: TaskSort) => void;
  initialFilters?: TaskFilter;
  initialSort?: TaskSort;
}

export function TaskFilters({
  onFilterChange,
  onSortChange,
  initialFilters = {},
  initialSort = { field: 'deadline', direction: 'asc' }
}: TaskFiltersProps) {
  const [filters, setFilters] = useState<TaskFilter>(initialFilters);
  const [sort, setSort] = useState<TaskSort>(initialSort);

  const handleFilterChange = (
    key: keyof TaskFilter,
    value: string | undefined
  ) => {
    const newFilters = {
      ...filters,
      [key]: value || undefined
    };

    // Remove undefined values
    Object.keys(newFilters).forEach(key => {
      if (newFilters[key as keyof TaskFilter] === undefined) {
        delete newFilters[key as keyof TaskFilter];
      }
    });

    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleSortChange = (field: TaskSort['field'], direction: TaskSort['direction']) => {
    const newSort = { field, direction };
    setSort(newSort);
    onSortChange(newSort);
  };

  return (
    <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4 bg-white p-4 rounded-lg shadow">
      {/* Status Filter */}
      <div className="flex-1">
        <label htmlFor="status" className="block text-sm font-medium text-gray-700">
          Status
        </label>
        <select
          id="status"
          value={filters.status || ''}
          onChange={(e) => handleFilterChange('status', e.target.value as TaskStatus || undefined)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
        >
          <option value="">All</option>
          {Object.values(TaskStatus).map(status => (
            <option key={status} value={status}>
              {status.replace(/_/g, ' ').toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      {/* Priority Filter */}
      <div className="flex-1">
        <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
          Priority
        </label>
        <select
          id="priority"
          value={filters.priority || ''}
          onChange={(e) => handleFilterChange('priority', e.target.value || undefined)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
        >
          <option value="">All</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Sort Options */}
      <div className="flex-1">
        <label htmlFor="sort" className="block text-sm font-medium text-gray-700">
          Sort By
        </label>
        <select
          id="sort"
          value={`${sort.field}-${sort.direction}`}
          onChange={(e) => {
            const [field, direction] = e.target.value.split('-') as [TaskSort['field'], TaskSort['direction']];
            handleSortChange(field, direction);
          }}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
        >
          <option value="deadline-asc">Due Date (Earliest)</option>
          <option value="deadline-desc">Due Date (Latest)</option>
          <option value="priority-desc">Priority (Highest)</option>
          <option value="priority-asc">Priority (Lowest)</option>
          <option value="created-asc">Created (Oldest)</option>
          <option value="created-desc">Created (Newest)</option>
        </select>
      </div>
    </div>
  );
}
