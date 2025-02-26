import { TaskStatus, Priority } from '@/types/task';

interface TaskBulkActionsProps {
  selectedCount: number;
  onBulkStatusChange: (status: TaskStatus) => void;
  onBulkPriorityChange: (priority: Priority) => void;
  onExport: () => void;
  onDelete: () => void;
}

export function TaskBulkActions({
  selectedCount,
  onBulkStatusChange,
  onBulkPriorityChange,
  onExport,
  onDelete
}: TaskBulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium text-slate-700">
          {selectedCount} task{selectedCount !== 1 ? 's' : ''} selected
        </span>
        
        {/* Status Change */}
        <select
          className="input max-w-[150px]"
          onChange={(e) => onBulkStatusChange(e.target.value as TaskStatus)}
          defaultValue=""
        >
          <option value="" disabled>Change Status</option>
          {Object.values(TaskStatus).map((status) => (
            <option key={status} value={status}>
              {status.replace(/_/g, ' ')}
            </option>
          ))}
        </select>

        {/* Priority Change */}
        <select
          className="input max-w-[150px]"
          onChange={(e) => onBulkPriorityChange(e.target.value as Priority)}
          defaultValue=""
        >
          <option value="" disabled>Change Priority</option>
          {Object.values(Priority).map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center space-x-2">
        <button 
          className="btn-secondary"
          onClick={onExport}
        >
          Export
        </button>
        <button 
          className="btn-secondary text-red-600 hover:text-red-700"
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
