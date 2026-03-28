import { Task } from '@/types/task';
import { formatDateRange, cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { STATUS_LABELS, PRIORITY_LABELS, TYPE_LABELS, CATEGORY_LABELS, PROGRESS_TYPE_LABELS, getLabel } from '@/constants/task-display-labels';

interface TaskBarProps {
  task: Task;
  width: number;
  x: number;
  y: number;
  height: number;
  onClick?: (taskId: string, event?: React.MouseEvent) => void;
}

const getPriorityColor = (priority: string | undefined) => {
  switch (priority?.toUpperCase()) {
    case 'HIGH':
      return 'bg-red-500 hover:bg-red-600';
    case 'MEDIUM':
      return 'bg-orange-400 hover:bg-orange-500';
    case 'LOW':
      return 'bg-blue-400 hover:bg-blue-500';
    default:
      return 'bg-gray-400 hover:bg-gray-500';
  }
};

// Hàm quyết định màu dựa trên status thay vì priority
const getStatusColor = (status: string | number): string => {
  if (!status) return 'bg-gray-300';

  switch (String(status).toUpperCase()) {
    case 'TODO':
      return 'bg-gray-100 text-gray-800 border border-gray-200';
    case 'DOING':
      return 'bg-blue-100 text-blue-800 border border-blue-200';
    case 'DONE':
      return 'bg-green-100 text-green-800 border border-green-200';
    case 'CLOSE':
      return 'bg-purple-100 text-purple-800 border border-purple-200';
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
    case 'REVIEW':
      return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
    case 'BLOCKED':
      return 'bg-red-100 text-red-800 border border-red-200';
    case 'REJECTED':
      return 'bg-pink-100 text-pink-800 border border-pink-200';
    case 'ARCHIVED':
      return 'bg-gray-300 text-gray-900 border border-gray-400';
    case 'CANCELLED':
      return 'bg-red-100 text-red-800 border border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border border-gray-200';
  }
};

const getStatusBadge = (status: string | undefined) => {
  return getLabel(STATUS_LABELS, status, 'Khong xac dinh');
};

export function TaskBar({ task, width, x, y, height, onClick }: TaskBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (barRef.current && showTooltip) {
      const rect = barRef.current.getBoundingClientRect();
      setTooltipPosition({
        x: rect.left + rect.width / 2,
        y: rect.top
      });
    }
  }, [showTooltip]);

  // Lấy màu dựa vào status thay vì priority
  const bgColor = getStatusColor(task.status);

  return (
    <>
      <div
        ref={barRef}
        className={`${bgColor} rounded-sm text-gray-800 text-xs relative cursor-pointer group shadow hover:brightness-95 transition-all overflow-hidden`}
        style={{
          width: `${Math.max(width, 20)}px`,
          height: `${height}px`,
          display: 'flex',
          alignItems: 'center'
        }}
        onClick={(e) => onClick?.(task.task_id, e)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className="truncate font-medium pl-2">
          {task.title}
        </span>


      </div>

      {showTooltip && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed bg-gray-800 text-white p-2 rounded shadow-lg text-xs"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y - 5}px`,
            transform: 'translate(-50%, -100%)',
            maxWidth: '300px',
            zIndex: 9999,
          }}
        >
          <div className="font-bold border-b border-gray-700 pb-1 mb-2">{task.title}</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div>Thứ tự: {task.priority_order}</div>
            <div>Người làm: {task.assignee?.username || 'Chưa gán'}</div>
            <div>Công sức: {task.effort !== undefined ? `${task.effort}h` : 'Chưa thiết lập'}</div>
            <div>Ưu tiên: {getLabel(PRIORITY_LABELS, task.priority)}</div>
            <div>Loại: {getLabel(TYPE_LABELS, task.type)}</div>
            <div>Phân loại: {getLabel(CATEGORY_LABELS, task.category)}</div>
            <div>Tiến độ: {task.progress || 0}%</div>
            <div>Tiến trình: {getLabel(PROGRESS_TYPE_LABELS, task.progress_type)}</div>
          </div>
          <div className="mt-2 border-t border-gray-700 pt-1">
            <div className="mb-1">Thời gian: {formatDateRange(task.start_date, task.due_date)}</div>
            <div className="flex items-center gap-2">
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] ${getStatusColor(task.status)}`}>
                {getStatusBadge(task.status)}
              </span>
              {task.tags && task.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {task.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-block rounded-full px-2 py-0.5 text-[10px] bg-gray-600 text-white"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
