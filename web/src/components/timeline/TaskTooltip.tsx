import { Task } from '@/types/task';
import { formatDateRange } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface TaskTooltipProps {
  task: Task;
  targetRef: React.RefObject<HTMLDivElement>;
}

export function TaskTooltip({ task, targetRef }: TaskTooltipProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const updatePosition = () => {
      if (!targetRef.current) return;
      
      const rect = targetRef.current.getBoundingClientRect();
      setPosition({
        x: rect.left + rect.width / 2,
        y: rect.top
      });
    };

    // Update position initially and on scroll
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    return () => window.removeEventListener('scroll', updatePosition, true);
  }, [targetRef]);

  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${position.x}px`,
    top: `${position.y}px`,
    transform: 'translate(-50%, -100%)',
    marginTop: '-8px',
    zIndex: 1000
  };

  const dateRange = formatDateRange(task.start_date, task.due_date);

  return (
    <div
      className="bg-white shadow-lg rounded-lg border border-slate-200 p-3 max-w-sm"
      style={tooltipStyle}
    >
      <div className="mb-2">
        <h4 className="font-medium text-slate-900">{task.title}</h4>
        {task.description && (
          <p className="text-sm text-slate-600 line-clamp-2 mt-1">
            {task.description}
          </p>
        )}
      </div>

      <div className="space-y-1 text-sm text-slate-600">
        {/* Date Range */}
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{dateRange}</span>
        </div>

        {/* Effort */}
        {task.effort && (
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{task.effort}h effort</span>
          </div>
        )}

        {/* Assignee */}
        {task.assignee && (
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <div className="flex items-center gap-2">
              {task.assignee.avatarUrl && (
                <img
                  src={task.assignee.avatarUrl}
                  alt={task.assignee.username}
                  title={task.assignee.username}
                  className="w-6 h-6 rounded-full ring-2 ring-white"
                />
              )}
              <span>{task.assignee.username}</span>
            </div>
          </div>
        )}

        {/* Status */}
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="capitalize">{task.status.replace(/_/g, ' ').toLowerCase()}</span>
        </div>

        {/* Priority */}
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          <span className="capitalize">{task.priority.toLowerCase()}</span>
        </div>
      </div>

      {/* Triangle pointer */}
      <div 
        className="absolute w-3 h-3 bg-white transform rotate-45 left-1/2 -translate-x-1/2 translate-y-1/2 border-r border-b border-slate-200"
        style={{ bottom: '0' }}
      />
    </div>
  );
}
