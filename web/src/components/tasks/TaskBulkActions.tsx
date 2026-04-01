import { TaskStatus, Priority, TaskStatuses, Priorities } from '@/types/task';
import { STATUS_LABELS, PRIORITY_LABELS, getStatusLabel, getPriorityLabel } from '@/constants/task-display-labels';

interface TaskBulkActionsProps {
  selectedCount: number;
  onBulkStatusChange?: (status: TaskStatus) => void;
  onBulkPriorityChange?: (priority: Priority) => void;
  onExport?: () => void;
  onDelete?: () => void;
  onClearSelection: () => void;
}

export function TaskBulkActions({
  selectedCount,
  onBulkStatusChange,
  onBulkPriorityChange,
  onExport,
  onDelete,
  onClearSelection
}: TaskBulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium text-slate-700">
          Đã chọn {selectedCount} công việc
        </span>
        
        {/* Clear Selection */}
        <button
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          onClick={onClearSelection}
          title="Bỏ chọn tất cả"
          aria-label="Bỏ chọn tất cả công việc"
        >
          Bỏ chọn
        </button>
        
        {/* Status Change */}
        {onBulkStatusChange && (
          <select
            className="input max-w-[150px]"
            onChange={(e) => onBulkStatusChange(e.target.value as TaskStatus)}
            defaultValue=""
            aria-label="Thay đổi trạng thái hàng loạt"
          >
            <option value="" disabled>Trạng thái</option>
            {Object.values(TaskStatuses).map((status) => (
              <option key={status} value={status}>
                {getStatusLabel(status)}
              </option>
            ))}
          </select>
        )}

        {/* Priority Change */}
        {onBulkPriorityChange && (
          <select
            className="input max-w-[150px]"
            onChange={(e) => onBulkPriorityChange(e.target.value as Priority)}
            defaultValue=""
            aria-label="Thay đổi độ ưu tiên hàng loạt"
          >
            <option value="" disabled>Ưu tiên</option>
            {Object.values(Priorities).map((priority) => (
              <option key={priority} value={priority}>
                {getPriorityLabel(priority)}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center space-x-2">
        {onExport && (
          <button 
            className="btn-secondary"
            onClick={onExport}
            aria-label="Xuất dữ liệu"
          >
            Xuất
          </button>
        )}
        {onDelete && (
          <button 
            className="btn-secondary text-red-600 hover:text-red-700"
            onClick={onDelete}
            aria-label="Xóa các công việc đã chọn"
          >
            Xóa
          </button>
        )}
      </div>
    </div>
  );
}
