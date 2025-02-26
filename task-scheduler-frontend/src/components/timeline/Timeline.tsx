import { Task } from '@/types/task';
import { TaskBar } from './TaskBar';
import { TimelineSkeleton } from './TimelineSkeleton';
import { useState, useRef, useEffect } from 'react';
import { getDatesBetween } from '@/lib/utils';

interface TimelineProps {
  tasks: Task[];
  isLoading?: boolean;
  onTaskClick?: (taskId: string) => void;
}

interface DateRange {
  startDate: Date;
  endDate: Date;
}

export function Timeline({ tasks, isLoading = false, onTaskClick }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: new Date(), endDate: new Date() });

  if (isLoading) {
    return <TimelineSkeleton rows={Math.min(tasks.length || 5, 10)} />;
  }

  // Calculate date range from tasks
  useEffect(() => {
    if (tasks.length === 0) return;

    const dates = tasks
      .flatMap(task => [
        task.startDate ? new Date(task.startDate) : null,
        task.deadline ? new Date(task.deadline) : null
      ])
      .filter((date): date is Date => date !== null);

    if (dates.length === 0) return;

    const startDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const endDate = new Date(Math.max(...dates.map(d => d.getTime())));

    // Add padding days
    startDate.setDate(startDate.getDate() - 2);
    endDate.setDate(endDate.getDate() + 2);

    setDateRange({ startDate, endDate });
  }, [tasks]);

  // Update dimensions on resize
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const days = getDatesBetween(dateRange.startDate, dateRange.endDate);
  const dayWidth = Math.max(80, dimensions.width / days.length);
  const rowHeight = 40;

  // Calculate task positions
  const getTaskPosition = (task: Task) => {
    if (!task.startDate || !task.deadline) return null;

    const startDate = new Date(task.startDate);
    const endDate = new Date(task.deadline);

    const startIdx = days.findIndex(d => d.getTime() === startDate.getTime());
    if (startIdx === -1) return null;

    const endIdx = days.findIndex(d => d.getTime() === endDate.getTime());
    if (endIdx === -1) return null;

    return {
      x: startIdx * dayWidth,
      width: (endIdx - startIdx + 1) * dayWidth,
      y: rowHeight * tasks.indexOf(task) + 40 // Add offset for header
    };
  };

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-lg border border-slate-200">
        <div className="text-slate-500 text-center">
          <p>No tasks scheduled</p>
          <p className="text-sm">Add tasks to see them in the timeline</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-auto" ref={containerRef}>
      <div
        style={{ 
          width: `${days.length * dayWidth}px`,
          minHeight: `${tasks.length * rowHeight + 80}px`
        }}
        className="relative bg-white"
      >
        {/* Date Headers */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200">
          <div className="flex" style={{ height: '40px' }}>
            {days.map((day, i) => (
              <div
                key={day.toISOString()}
                style={{ width: `${dayWidth}px` }}
                className={`
                  flex-shrink-0 border-r border-slate-200 p-2
                  ${day.getDay() === 0 || day.getDay() === 6 ? 'bg-slate-50' : ''}
                `}
              >
                <div className="text-xs text-slate-600">
                  {day.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Task Bars */}
        {tasks.map(task => {
          const position = getTaskPosition(task);
          if (!position) return null;

          return (
            <TaskBar
              key={task.id}
              task={task}
              width={position.width}
              x={position.x}
              y={position.y}
              height={30}
              onClick={onTaskClick}
            />
          );
        })}

        {/* Grid Lines */}
        {days.map((day, i) => (
          <div
            key={day.toISOString()}
            style={{
              position: 'absolute',
              left: `${i * dayWidth}px`,
              top: '40px',
              width: '1px',
              height: '100%'
            }}
            className={`
              ${day.getDay() === 0 || day.getDay() === 6 
                ? 'bg-slate-100'
                : 'bg-slate-200'
              }
            `}
          />
        ))}
      </div>
    </div>
  );
}
