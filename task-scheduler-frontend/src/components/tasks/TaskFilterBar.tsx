import { TaskFilter, TaskStatus, Priority, User } from '@/types/task';
import { useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';

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
  const [isOpen, setIsOpen] = useState(false);

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
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        Filter Tasks
        {(selectedStatus || selectedPriority || selectedAssignee || dateRange.start || dateRange.end || searchQuery) && (
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Active Filters</span>
        )}
      </button>

      <Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="Filter Tasks"
        className="w-[calc(100%-64px)] max-w-[90%]"
      >
        <div className="p-8 space-y-8 min-w-[800px]">
          {/* Search Group */}
          <div className="space-y-4 pb-6 border-b border-slate-200">
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                id="search"
                className="block w-full rounded-lg border-slate-300 border-2 focus:border-blue-500 focus:ring focus:ring-blue-200 pl-10 py-3 text-base"
                placeholder="Enter keywords to search tasks by title or description..."
                value={searchQuery}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setSearchQuery(newValue);
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    handleFilterChange({ searchQuery: '' });
                  }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-500"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Status & Priority Group */}
          <div className="space-y-4 pb-6 border-b border-slate-200">
            <h3 className="text-base font-medium text-slate-900">Status & Priority</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-1">
                  Status
                </label>
                <select
                  id="status"
                  className="block w-full rounded-lg border-slate-300 border-2 focus:border-blue-500 focus:ring focus:ring-blue-200 py-2"
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

              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-slate-700 mb-1">
                  Priority
                </label>
                <select
                  id="priority"
                  className="block w-full rounded-lg border-slate-300 border-2 focus:border-blue-500 focus:ring focus:ring-blue-200 py-2"
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
            </div>
          </div>

          {/* Assignee Group */}
          <div className="space-y-4 pb-6 border-b border-slate-200">
            <h3 className="text-base font-medium text-slate-900">Assignee</h3>
            <div>
              <select
                id="assignee"
                className="block w-full rounded-lg border-slate-300 border-2 focus:border-blue-500 focus:ring focus:ring-blue-200 py-2"
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
          </div>

          {/* Date Range Group */}
          <div className="space-y-4 pb-6 border-b border-slate-200">
            <h3 className="text-base font-medium text-slate-900">Date Range</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-slate-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  className="block w-full rounded-lg border-slate-300 border-2 focus:border-blue-500 focus:ring focus:ring-blue-200 py-2"
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
                  className="block w-full rounded-lg border-slate-300 border-2 focus:border-blue-500 focus:ring focus:ring-blue-200 py-2"
                  value={dateRange.end}
                  onChange={(e) => {
                    const value = e.target.value;
                    const newRange = { ...dateRange, end: value };
                    setDateRange(newRange);
                    handleFilterChange({ dateRange: newRange });
                  }}
                />
              </div>
            </div>
          </div>

          {/* Additional Options */}
          <div className="grid grid-cols-3 gap-4 pt-2">
            <button
              onClick={() => handleFilterChange({ searchQuery })}
              className="w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out whitespace-nowrap"
            >
              <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Apply Filters
            </button>

            <button
              className="w-full inline-flex justify-center items-center px-6 py-3 border border-slate-300 text-sm font-medium rounded-lg shadow-sm text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out whitespace-nowrap"
              onClick={() => {
                setSearchQuery('');
                setSelectedStatus(undefined);
                setSelectedPriority(undefined);
                setSelectedAssignee('');
                setDateRange({ start: '', end: '' });
                onFilterChange({});
                setIsOpen(false);
              }}
            >
              Clear All Filters
            </button>

            <button
              onClick={onToggleCompleted}
              className={`w-full inline-flex justify-center items-center px-6 py-3 border text-sm font-medium rounded-lg shadow-sm transition-all duration-200 ease-in-out transform active:scale-95 whitespace-nowrap
                ${showCompletedTasks 
                  ? 'border-transparent text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' 
                  : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-50 focus:ring-blue-500'
                }`}
            >
              {showCompletedTasks ? 'Hide Completed' : 'Show Completed'}
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
