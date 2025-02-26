import { Task } from '@/types/task';
import { TaskBar } from './TaskBar';
import { TimelineSkeleton } from './TimelineSkeleton';
import { PriorityTaskList } from './PriorityTaskList';
import { useState, useRef, useEffect, useCallback } from 'react';
import { getDatesBetween } from '@/lib/utils';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { useReorderTasks } from '@/hooks/useTasks';

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

  // State for managing ordered tasks
  const [orderedTasks, setOrderedTasks] = useState<Task[]>(tasks);
  const reorderTasks = useReorderTasks();

  // Update orderedTasks when tasks prop changes
  useEffect(() => {
    setOrderedTasks([...tasks].sort((a, b) => a.priorityOrder - b.priorityOrder));
  }, [tasks]);

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
  const rowHeight = 48; // Increased row height

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    
    // Only handle drags within priorityList
    if (result.source.droppableId !== 'priorityList' || 
        result.destination.droppableId !== 'priorityList') {
      return;
    }

    const { source, destination } = result;
    if (source.index === destination.index) return;

    // Create new ordered array
    const newOrderedTasks = Array.from(orderedTasks);
    const [movedTask] = newOrderedTasks.splice(source.index, 1);
    newOrderedTasks.splice(destination.index, 0, movedTask);

    // Calculate new priority orders
    const taskOrders = newOrderedTasks.map((task, index) => ({
      taskId: task.id,
      priorityOrder: index + 1
    }));

    // Update local state immediately for smooth animation
    setOrderedTasks(newOrderedTasks);

    // Update on server
    reorderTasks.mutate({
      projectId: tasks[0].projectId,
      taskOrders
    });
  }, [orderedTasks, tasks, reorderTasks]);

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
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4">
        <PriorityTaskList tasks={orderedTasks} />
        <div className="flex-1 overflow-auto" ref={containerRef}>
          <div
            style={{ 
              width: `${days.length * dayWidth}px`,
              minHeight: `${orderedTasks.length * rowHeight + 80}px`
            }}
            className="relative bg-white"
          >
            {/* Date Headers */}
            <div className="sticky top-0 z-40 bg-white border-b border-slate-200" style={{ zIndex:1}}>
              <div className="flex items-center justify-between p-2 border-b">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-slate-600">Start:</label>
                    <input
                      type="date"
                      value={dateRange.startDate.toISOString().split('T')[0]}
                      onChange={(e) => {
                        const newDate = new Date(e.target.value);
                        setDateRange(prev => ({
                          ...prev,
                          startDate: newDate
                        }));
                      }}
                      className="px-2 py-1 text-sm border rounded"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-slate-600">End:</label>
                    <input
                      type="date"
                      value={dateRange.endDate.toISOString().split('T')[0]}
                      onChange={(e) => {
                        const newDate = new Date(e.target.value);
                        setDateRange(prev => ({
                          ...prev,
                          endDate: newDate
                        }));
                      }}
                      className="px-2 py-1 text-sm border rounded"
                    />
                  </div>
                </div>
              </div>
              <div className="flex" style={{ height: '40px' }}>
                {days.map((day, i) => (
                  <div
                    key={day.toISOString()}
                    style={{ width: `${dayWidth}px` }}
                    className={`
                      flex-shrink-0 border-r border-slate-200 p-2
                      ${day.getDay() === 0 || day.getDay() === 6 ? 'bg-slate-100' : ''}
                      ${day.toISOString().split('T')[0] === new Date().toISOString().split('T')[0] ? 'bg-blue-50 font-semibold' : ''}
                    `}
                  >
                    <div className="text-xs text-slate-600">
                      {day.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit'
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Grid Container */}
            <div className="relative inset-0" /*style={{ top: '80px' }}*/>
              {/* Grid Background */}
              <div 
                className="grid border-t border-slate-200"
                style={{
                  gridTemplateColumns: `repeat(${days.length}, ${dayWidth}px)`,
                  gridTemplateRows: `repeat(${orderedTasks.length}, ${rowHeight}px)`,
                  gridAutoFlow: 'row',
                  height: `${orderedTasks.length * rowHeight}px`,
                  minHeight: rowHeight
                }}
              >
                {days.map((day) => (
                  orderedTasks.map((_, rowIndex) => (
                    <div
                      key={`${day.toISOString()}-${rowIndex}`}
                      className={`
                        border-r border-b border-slate-200 relative
                        ${day.getDay() === 0 || day.getDay() === 6 ? 'bg-slate-100/70' : ''}
                        ${day.toISOString().split('T')[0] === new Date().toISOString().split('T')[0] ? 'bg-blue-50/70' : ''}
                      `}
                    />
                  ))
                ))}
              </div>

              {/* Task Bars */}
              {orderedTasks.map((task, rowIndex) => {
                const dayIndex = days.findIndex(day => 
                  day.toISOString().split('T')[0] === task.startDate?.split('T')[0]
                );
                
                // If task starts before the current view range
                const taskStart = new Date(task.startDate!);
                const taskEnd = new Date(task.deadline!);
                let startIndex = dayIndex;
                
                // Adjust for tasks that start before the view range
                if (taskStart < dateRange.startDate) {
                  startIndex = 0;
                }

                const taskDuration = Math.ceil(
                  (taskEnd.getTime() - Math.max(taskStart.getTime(), dateRange.startDate.getTime())) / (24 * 60 * 60 * 1000)
                );

                if (taskDuration <= 0) return null;

                return (
                  <div
                    key={task.id}
                    style={{
                      position: 'absolute',
                      left: `${startIndex * dayWidth}px`,
                      top: `${rowIndex * rowHeight}px`,
                      width: `${taskDuration * dayWidth}px`,
                      height: `${rowHeight}px`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      padding: '0 8px',
                      pointerEvents: 'none' // This makes the container pass through clicks
                    }}
                    className="z-30"
                  >
                    <TaskBar
                      task={task}
                      width={taskDuration * dayWidth}
                      x={0}
                      y={rowHeight / 2}
                      height={36}
                      onClick={onTaskClick}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </DragDropContext>
  );
}
