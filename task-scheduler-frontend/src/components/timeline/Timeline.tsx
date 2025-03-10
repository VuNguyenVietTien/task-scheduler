'use client';

import { Task } from '@/types/task';
import { AssignedUser } from '@/types/user';
import { TaskBar } from './TaskBar';
import { TimelineSkeleton } from './TimelineSkeleton';
import { PriorityTaskList } from './PriorityTaskList';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { getDatesBetween } from '@/lib/utils';
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { 
  arrayMove,
  sortableKeyboardCoordinates,
  SortableContext,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { useReorderTasks } from '@/hooks/useTasks';

interface TimelineProps {
  tasks: Task[];
  isLoading?: boolean;
  onTaskClick?: (taskId: string) => void;
  users: AssignedUser[];
}

type ViewMode = 'project' | 'user';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

const getTaskDurationDays = (task: Task): number => {
  // Nếu task có effort, tính số ngày dựa trên effort/8
  if (task.effort) {
    return Math.ceil(task.effort / 8);
  }
  // Nếu không có effort nhưng có start_date và due_date, tính số ngày giữa 2 ngày
  if (task.start_date && task.due_date) {
    const start = new Date(task.start_date);
    const end = new Date(task.due_date);
    return Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  }
  // Mặc định là 1 ngày
  return 1;
};

export function Timeline({ tasks, isLoading = false, onTaskClick, users }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: new Date(), endDate: new Date() });
  const [orderedTasks, setOrderedTasks] = useState<Task[]>(tasks);
  const reorderTasks = useReorderTasks();
  const [viewMode, setViewMode] = useState<ViewMode>('project');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const filteredTasks = useMemo(() => {
    if (viewMode === 'project') {
      return orderedTasks;
    } 
    if (viewMode === 'user' && selectedUserId) {
      return orderedTasks.filter(task => task.assignee?.userId === selectedUserId);
    }
    return [];
  }, [orderedTasks, viewMode, selectedUserId]);

  if (isLoading) {
    return <TimelineSkeleton rows={Math.min(tasks.length || 5, 10)} />;
  }

  useEffect(() => {
    if (!tasks || tasks.length === 0) return;

    const processTasks = (inputTasks: Task[]): Task[] => {
      const sortedTasks = [...inputTasks].sort((a, b) => {
        const orderDiff = a.priority_order - b.priority_order;
        if (orderDiff !== 0) return orderDiff;
        return b.priority.localeCompare(a.priority);
      });

      let lastEndDate = new Date();
      const processedTasks = sortedTasks.map(task => {
        if (task.start_date && task.due_date) {
          lastEndDate = new Date(task.due_date);
          return task;
        }

        const taskDurationDays = getTaskDurationDays(task);
        
        if (!task.start_date) {
          let nextStartDate: Date;
          if (task.due_date) {
            const deadlineDate = new Date(task.due_date);
            nextStartDate = new Date(deadlineDate);
            nextStartDate.setDate(nextStartDate.getDate() - taskDurationDays + 1);
          } else {
            nextStartDate = new Date(lastEndDate.getTime() + 24 * 60 * 60 * 1000);
          }

          const endDate = task.due_date 
            ? new Date(task.due_date)
            : new Date(nextStartDate.getTime() + (taskDurationDays - 1) * 24 * 60 * 60 * 1000);
            
          lastEndDate = endDate;

          return {
            ...task,
            start_date: nextStartDate.toISOString().split('T')[0],
          };
        }

        const endDate = new Date(task.start_date);
        endDate.setDate(endDate.getDate() + taskDurationDays - 1);
        lastEndDate = endDate;
        return task;
      });

      return processedTasks;
    };

    setOrderedTasks(processTasks(tasks));
  }, [tasks]);

  useEffect(() => {
    if (tasks.length === 0) return;

    const dates = tasks
      .flatMap(task => [
        task.start_date ? new Date(task.start_date) : null,
        task.due_date ? new Date(task.due_date) : null
      ])
      .filter((date): date is Date => date !== null);

    if (dates.length === 0) return;

    const startDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const endDate = new Date(Math.max(...dates.map(d => d.getTime())));

    startDate.setDate(startDate.getDate() - 2);
    endDate.setDate(endDate.getDate() + 2);

    setDateRange({ startDate, endDate });
  }, [tasks]);

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
  const rowHeight = 48;

  const onDragStart = useCallback(() => {
    if (window.navigator.vibrate) {
      window.navigator.vibrate(100); // Tactile feedback
    }
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const onDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = orderedTasks.findIndex((task) => task.task_id === String(active.id));
      const newIndex = orderedTasks.findIndex((task) => task.task_id === String(over.id));

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedTasks = arrayMove(orderedTasks, oldIndex, newIndex);
  
        const taskOrders = reorderedTasks.map((task, index) => ({
          taskId: task.task_id,
          priorityOrder: index + 1
        }));
  
        setOrderedTasks(reorderedTasks);
  
        if (reorderTasks && tasks[0]?.project_id) {
          reorderTasks.mutate({
            projectId: tasks[0].project_id,
            taskOrders
          });
        }
      }
    }
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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-4 h-full">
        <div className="w-80 flex-shrink-0 overflow-hidden">
          <PriorityTaskList tasks={orderedTasks} />
        </div>
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
                  <div className="flex items-center gap-4 mr-6">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setViewMode('project')}
                        className={`px-3 py-1 rounded-l ${
                          viewMode === 'project' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        Project
                      </button>
                      <button
                        onClick={() => setViewMode('user')}
                        className={`px-3 py-1 rounded-r ${
                          viewMode === 'user' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        User
                      </button>
                    </div>
                    {viewMode === 'user' && (
                      <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="px-2 py-1 border rounded text-sm"
                        aria-label="Select user to filter tasks"
                        title="Select user"
                      >
                        <option value="">Select User</option>
                        {users.map(user => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="start-date" className="text-sm text-slate-600">
                      Start:
                    </label>
                    <input
                      id="start-date"
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
                      aria-label="Start date"
                      title="Start date"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="end-date" className="text-sm text-slate-600">
                      End:
                    </label>
                    <input
                      id="end-date"
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
                      aria-label="End date"
                      title="End date"
                    />
                  </div>
                </div>
              </div>
              <div className="flex" style={{ height: '40px' }}>
                {days.map((day: Date) => (
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
            <div className="relative inset-0">
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
                {days.map((day: Date) => (
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
              {filteredTasks.map((task: Task, rowIndex: number) => {
                const dayIndex = days.findIndex(day => 
                  day.toISOString().split('T')[0] === task.start_date?.split('T')[0]
                );
                
                if (dayIndex === -1) return null;

                const taskStart = new Date(task.start_date!);
                const taskEnd = task.due_date ? new Date(task.due_date) : taskStart;
                
                let startIndex = dayIndex;
                if (taskStart < dateRange.startDate) {
                  startIndex = 0;
                }

                const taskDuration = task.effort 
                  ? Math.ceil(task.effort / 8)  // Sử dụng số ngày dựa trên effort 
                  : Math.ceil(
                      (taskEnd.getTime() - Math.max(taskStart.getTime(), dateRange.startDate.getTime())) / (24 * 60 * 60 * 1000)
                    ) + 1;

                return (
                  <div
                    key={task.task_id}
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
                      pointerEvents: 'none'
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
    </DndContext>
  );
}
