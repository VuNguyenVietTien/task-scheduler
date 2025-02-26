import { Task } from '@/types/task';
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DONE':
        return 'bg-green-500';
      case 'IN_PROGRESS':
        return 'bg-blue-500';
      case 'IN_REVIEW':
        return 'bg-purple-500';
      case 'PLANNED':
        return 'bg-amber-500';
      case 'BACKLOG':
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
          hover:brightness-110 transition-all duration-200`}
        style={{
          position: 'absolute',
          left: `${x}px`,
          top: `${y}px`,
          width: `${width}px`,
          height: `${height}px`,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {width > 50 && (
          <div className="px-2 py-1 text-xs text-white truncate">
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
