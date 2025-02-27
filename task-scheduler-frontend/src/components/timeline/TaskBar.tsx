import { Task, TaskStatus, TaskStatuses } from '@/types/task';
import { TaskTooltip } from './TaskTooltip';
import { useState, useCallback, useRef } from 'react';

interface TaskBarProps {
  task: Task;
  width: number;
  x: number;
  y: number;
  height: number;
  onClick?: (taskId: string) => void;
}

export function TaskBar({ task, width, x, y, height, onClick }: TaskBarProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatuses.DONE:
        return 'bg-green-500';
      case TaskStatuses.IN_PROGRESS:
        return 'bg-blue-500';
      case TaskStatuses.IN_REVIEW:
        return 'bg-purple-500';
      case TaskStatuses.PLANNED:
        return 'bg-amber-500';
      case TaskStatuses.BACKLOG:
        return 'bg-slate-500';
      default:
        return 'bg-slate-300';
    }
  };

  const handleMouseEnter = useCallback(() => {
    setShowTooltip(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onClick?.(task.id);
  }, [task.id, onClick]);

  return (
    <>
      <div
        ref={barRef}
        className={`${getStatusColor(task.status)} rounded shadow-sm cursor-pointer 
          hover:brightness-110 transition-all duration-200 pointer-events-auto`}
        style={{
          position: 'absolute',
          width: `${width}px`,
          height: `${height}px`,
          transform: 'translateY(-50%)',
          top: `${y}px`,
          left: `${x}px`,
          zIndex: 999
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {width > 50 && (
          <div className="px-2 py-1 text-xs text-white truncate flex items-center h-full">
            {task.title}
          </div>
        )}
      </div>

      {showTooltip && (
        <TaskTooltip
          task={task}
          targetRef={barRef}
        />
      )}
    </>
  );
}
