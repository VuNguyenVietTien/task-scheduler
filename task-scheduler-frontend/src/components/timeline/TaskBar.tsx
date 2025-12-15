import { Task } from '@/types/task';
import { formatDateRange, cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

interface TaskBarProps {
  task: Task;
  width: number;
  x: number;
  y: number;
  height: number;
  onClick?: (taskId: string) => void;
}

const getPriorityColor = (priority: string | undefined) => {
  switch (priority?.toLowerCase()) {
    case 'high':
      return 'bg-red-500 hover:bg-red-600';
    case 'medium':
      return 'bg-orange-400 hover:bg-orange-500';
    case 'low':
      return 'bg-blue-400 hover:bg-blue-500';
    default:
      return 'bg-gray-400 hover:bg-gray-500';
  }
};

// Hàm quyết định màu dựa trên status thay vì priority
const getStatusColor = (status: string | number): string => {
  if (!status) return 'bg-gray-300';

  switch (String(status).toLowerCase()) {
    case 'todo':
    case 'to_do':
      return 'bg-gray-100 text-gray-800 border border-gray-200';
    case 'doing':
    case 'in_progress':
      return 'bg-blue-100 text-blue-800 border border-blue-200';
    case 'done':
      return 'bg-green-100 text-green-800 border border-green-200';
    case 'close':
      return 'bg-purple-100 text-purple-800 border border-purple-200';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
    case 'review':
      return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
    case 'blocked':
      return 'bg-red-100 text-red-800 border border-red-200';
    case 'rejected':
      return 'bg-pink-100 text-pink-800 border border-pink-200';
    case 'archived':
      return 'bg-gray-300 text-gray-900 border border-gray-400';
    case 'cancelled':
      return 'bg-red-100 text-red-800 border border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border border-gray-200';
  }
};

const getStatusBadge = (status: string | undefined) => {
  switch (status?.toLowerCase()) {
    case 'done':
      return 'Hoàn thành';
    case 'in_progress':
      return 'Đang làm';
    case 'to_do':
      return 'Cần làm';
    case 'blocked':
      return 'Bị chặn';
    default:
      return 'Không xác định';
  }
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
        onClick={() => onClick?.(task.task_id)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className="truncate font-medium pl-2">
          {task.title}
        </span>


      </div>

      {showTooltip && (
        <div
          className="fixed bg-gray-800 text-white p-2 rounded shadow-lg text-xs z-50"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y - 5}px`,
            transform: 'translate(-50%, -100%)',
            maxWidth: '300px'
          }}
        >
          <div className="font-bold border-b border-gray-700 pb-1 mb-2">{task.title}</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div>Thứ tự: {task.priority_order}</div>
            <div>Người làm: {task.assignee?.username || 'Chưa gán'}</div>
            <div>Công việc: {task.effort !== undefined ? `${task.effort}h` : 'N/A'}</div>
            <div>Độ ưu tiên: {task.priority || 'N/A'}</div>
            <div>Loại: {task.type || 'N/A'}</div>
            <div>Phân loại: {task.category || 'N/A'}</div>
            <div>Tiến độ: {task.progress || 0}%</div>
            <div>Tiến trình: {task.progress_type || 'N/A'}</div>
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
        </div>
      )}
    </>
  );
}
