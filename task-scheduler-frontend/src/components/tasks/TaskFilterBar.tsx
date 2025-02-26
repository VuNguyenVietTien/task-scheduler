import { TaskFilter, TaskStatus, Priority, User } from '@/types/task';
import { useState } from 'react';

interface TaskFilterBarProps {
  onFilterChange: (filter: TaskFilter) => void;
  assignees: User[];
  showCompletedTasks: boolean;
  onToggleCompleted: () => void;
}

export function TaskFilterBar({ 
  onFilterChange, 
  assignees, 
  showCompletedTasks, 
  onToggleCompleted 
}: TaskFilterBarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | undefined>();
  const [selectedPriority, setSelectedPriority] = useState<Priority | undefined>();
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const handleFilterChange = (
    updates: {
      searchQuery?: string;
      status?: TaskStatus;
      priority?: Priority;
      assigneeId?: string;
      dateRange?: { start: string; end: string };
    }
  ) => {
    const newFilter: TaskFilter = {};
    const currentSearchQuery = updates.searchQuery !== undefined ? updates.searchQuery : searchQuery;
    const currentStatus = updates.status !== undefined ? updates.status : selectedStatus;
    const currentPriority = updates.priority !== undefined ? updates.priority : selectedPriority;
    const currentAssignee = updates.assigneeId !== undefined ? updates.assigneeId : selectedAssignee;
    const currentDateRange = updates.dateRange || dateRange;

    if (currentSearchQuery) {
      newFilter.searchQuery = currentSearchQuery;
    }

    if (currentStatus) {
      newFilter.status = currentStatus;
    }

    if (currentPriority) {
      newFilter.priority = currentPriority;
    }

    if (currentAssignee) {
      newFilter.assigneeId = currentAssignee;
    }

    if (currentDateRange.start) {
      newFilter.startDate = currentDateRange.start;
    }

    if (currentDateRange.end) {
      newFilter.endDate = currentDateRange.end;
    }

    onFilterChange(newFilter);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* Search Input */}
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-slate-700 mb-1">
            Search Tasks
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              id="search"
              className="input pl-10"
              placeholder="Search by title or description"
              value={searchQuery}
              onChange={(e) => {
                const newValue = e.target.value;
                setSearchQuery(newValue);
                handleFilterChange({ searchQuery: newValue });
              }}
            />
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-1">
            Status
          </label>
          <select
            id="status"
            className="input"
            value={selectedStatus || ''}
            onChange={(e) => {
              const value = e.target.value as TaskStatus;
              setSelectedStatus(value || undefined);
              handleFilterChange({ status: value || undefined });
            }}
          >
            <option value="">All Statuses</option>
            {Object.values(TaskStatus).map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        {/* Priority Filter */}
        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-slate-700 mb-1">
            Priority
          </label>
          <select
            id="priority"
            className="input"
            value={selectedPriority || ''}
            onChange={(e) => {
              const value = e.target.value as Priority;
              setSelectedPriority(value || undefined);
              handleFilterChange({ priority: value || undefined });
            }}
          >
            <option value="">All Priorities</option>
            {Object.values(Priority).map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </div>

        {/* Assignee Filter */}
        <div>
          <label htmlFor="assignee" className="block text-sm font-medium text-slate-700 mb-1">
            Assignee
          </label>
          <select
            id="assignee"
            className="input"
            value={selectedAssignee}
            onChange={(e) => {
              const value = e.target.value;
              setSelectedAssignee(value);
              handleFilterChange({ assigneeId: value });
            }}
          >
            <option value="">All Assignees</option>
            {assignees.map((assignee) => (
              <option key={assignee.id} value={assignee.id}>
                {assignee.name}
              </option>
            ))}
          </select>
        </div>

        {/* Show Completed Tasks Toggle */}
        <div className="flex items-end">
          <button
            onClick={onToggleCompleted}
            className={`btn ${showCompletedTasks ? 'btn-primary' : 'btn-secondary'} w-full`}
          >
            {showCompletedTasks ? 'Hide Completed' : 'Show Completed'}
          </button>
        </div>
      </div>

      {/* Date Range Filters */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-slate-700 mb-1">
            Start Date
          </label>
          <input
            type="date"
            id="startDate"
            className="input"
            value={dateRange.start}
            onChange={(e) => {
              const value = e.target.value;
              const newRange = { ...dateRange, start: value };
              setDateRange(newRange);
              handleFilterChange({ dateRange: newRange });
            }}
          />
        </div>

        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-slate-700 mb-1">
            End Date
          </label>
          <input
            type="date"
            id="endDate"
            className="input"
            value={dateRange.end}
            onChange={(e) => {
              const value = e.target.value;
              const newRange = { ...dateRange, end: value };
              setDateRange(newRange);
              handleFilterChange({ dateRange: newRange });
            }}
          />
        </div>

        {/* Clear Filters Button */}
        <div className="flex items-end">
          <button
            className="btn-secondary w-full"
            onClick={() => {
              setSearchQuery('');
              setSelectedStatus(undefined);
              setSelectedPriority(undefined);
              setSelectedAssignee('');
              setDateRange({ start: '', end: '' });
              onFilterChange({});
            }}
          >
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  );
}
