'use client';

import { Task, getStatusColor } from '@/types/task';
import { useState } from 'react';
import { isSameDay } from 'date-fns';
import { TaskTooltip } from './TaskTooltip';

interface TaskBarProps {
  task: Task;
  days: Date[];
}

export function TaskBar({ task, days }: TaskBarProps) {
  const [showDetails, setShowDetails] = useState(false);

  const getTaskPosition = () => {
    if (!task.start_date || !task.end_date) return null;

    const startDate = new Date(task.start_date);
    startDate.setHours(0, 0, 0, 0);

    // Tìm vị trí của task trong timeline
    const startIndex = days.findIndex(day => isSameDay(day, startDate));
    if (startIndex === -1) return null;

    // Tính số ngày thực hiện task
    const daysNeeded = Math.ceil(task.effort / 8);

    return { startIndex, daysNeeded };
  };

  const getBarStyle = () => {
    const position = getTaskPosition();
    if (!position) return { display: 'none' };

    const { startIndex, daysNeeded } = position;

    return {
      position: 'absolute' as const,
      left: `${startIndex * 96}px`,
      width: `${daysNeeded * 96 - 4}px`,
      height: '34px',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      margin: '0 2px',
      borderRadius: '17px',
      backgroundColor: getStatusColor(task.status),
      boxShadow: '0 2px 4px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.1)',
      color: '#FFFFFF',
      border: '1px solid rgba(255,255,255,0.1)',
      opacity: task.status === 'pending' ? 0.85 : 1,
      transition: 'all 0.2s ease',
      cursor: 'pointer',
      fontSize: '0.875rem',
      fontWeight: 500,
      zIndex: 20,
      top: '50%',
      transform: 'translateY(-50%)'
    };
  };

  const position = getTaskPosition();
  if (!position) return null;

  return (
    <div style={getBarStyle()}>
      <div 
        className="relative h-full flex items-center w-full"
        onMouseEnter={() => setShowDetails(true)}
        onMouseLeave={() => setShowDetails(false)}
      >
        <div className="truncate">
          {task.task_name}
        </div>
        {showDetails && (
          <div className="absolute left-0 top-full pt-2 z-[999]">
            <TaskTooltip task={task} />
          </div>
        )}
      </div>
    </div>
  );
}
