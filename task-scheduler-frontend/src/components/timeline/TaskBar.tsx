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

const getStatusColor = (status: string | undefined) => {
  switch (status?.toLowerCase()) {
    case 'done':
      return 'bg-green-500 hover:bg-green-600';
    case 'in_progress':
      return 'bg-blue-500 hover:bg-blue-600';
    case 'blocked':
      return 'bg-red-500 hover:bg-red-600';
    default:
      return 'bg-gray-400 hover:bg-gray-500';
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

  // Lấy màu dựa trên trạng thái nếu đã hoàn thành, nếu không thì dựa trên độ ưu tiên
  const barColor = task.status === 'done' 
    ? getStatusColor(task.status) 
    : getPriorityColor(task.priority);
  
  return (
    <>
      <div 
        ref={barRef}
        className={cn(
          'rounded px-2 py-1 text-xs text-white cursor-pointer',
          'transition-colors duration-200 ease-in-out',
          'whitespace-nowrap overflow-hidden text-ellipsis',
          barColor
        )}
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
        <span className="truncate font-medium">
          {task.title}
        </span>
        
        {task.status === 'done' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full border-t border-white border-dashed opacity-70"></div>
          </div>
        )}
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
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] text-white ${getStatusColor(task.status)}`}>
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
