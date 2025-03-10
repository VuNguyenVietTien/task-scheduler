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

// Kiểm tra ngày có phải là ngày cuối tuần
const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

// Lấy ngày làm việc tiếp theo (bỏ qua cuối tuần)
const getNextWorkDay = (date: Date): Date => {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  
  // Bỏ qua ngày cuối tuần
  while (isWeekend(nextDay)) {
    nextDay.setDate(nextDay.getDate() + 1);
  }
  return nextDay;
};

// Tính số giờ làm việc cần thiết trong ngày
const getWorkHoursInDay = (remainingEffort: number): number => {
  return Math.min(remainingEffort, 8); // Tối đa 8h/ngày
};

// Tính thời điểm kết thúc của task dựa trên effort
const calculateTaskEndDate = (startDate: Date, effort: number): Date => {
  let remainingEffort = effort;
  const endDate = new Date(startDate);
  
  while (remainingEffort > 0) {
    if (!isWeekend(endDate)) {
      const hoursForDay = getWorkHoursInDay(remainingEffort);
      remainingEffort -= hoursForDay;
      if (remainingEffort > 0) {
        endDate.setDate(endDate.getDate() + 1);
      }
    } else {
      endDate.setDate(endDate.getDate() + 1);
    }
  }
  
  return endDate;
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
      // Sắp xếp tasks theo priority_order
      const sortedTasks = [...inputTasks].sort((a, b) => a.priority_order - b.priority_order);
      
      let lastEndTime = new Date().getTime();
      
      return sortedTasks.map(task => {
        // Nếu task đã có start_date, kiểm tra và điều chỉnh
        if (task.start_date) {
          const startDate = new Date(task.start_date);
          if (task.effort) {
            const endDate = calculateTaskEndDate(startDate, task.effort);
            lastEndTime = endDate.getTime();
            return {
              ...task,
              due_date: endDate.toISOString().split('T')[0]
            };
          }
          return task;
        }

        // Xác định start_date cho task mới
        let startDate = new Date(lastEndTime);
        
        // Nếu là task đầu tiên, bắt đầu từ ngày hiện tại
        if (lastEndTime === new Date().getTime()) {
          startDate = new Date();
        }
        
        // Bỏ qua ngày cuối tuần cho ngày bắt đầu
        while (isWeekend(startDate)) {
          startDate = getNextWorkDay(startDate);
        }

        // Tính toán end_date dựa trên effort
        const endDate = calculateTaskEndDate(startDate, task.effort || 8);
        lastEndTime = endDate.getTime();

        return {
          ...task,
          start_date: startDate.toISOString().split('T')[0],
          due_date: endDate.toISOString().split('T')[0]
        };
      });
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
      window.navigator.vibrate(100);
    }
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleTaskReorder = useCallback((taskId: string, newIndex: number) => {
    const oldIndex = orderedTasks.findIndex((task) => task.task_id === taskId);

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
  }, [orderedTasks, tasks, reorderTasks]);

  const onDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      handleTaskReorder(String(active.id), orderedTasks.findIndex(task => task.task_id === String(over.id)));
    }
  }, [orderedTasks, handleTaskReorder]);

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

  const today = new Date();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-4 h-full">
        <div className="w-80 flex-shrink-0 overflow-hidden">
          <PriorityTaskList 
            tasks={orderedTasks} 
            onTaskClick={onTaskClick} 
            onTaskReorder={handleTaskReorder}
          />
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
            <div className="sticky top-0 bg-white border-b border-slate-200 z-0">
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
                      ${isWeekend(day) ? 'bg-slate-100' : ''}
                      ${day.toISOString().split('T')[0] === today.toISOString().split('T')[0] ? 'bg-yellow-100 font-semibold' : ''}
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
                        ${isWeekend(day) ? 'bg-slate-100/70' : ''}
                        ${day.toISOString().split('T')[0] === today.toISOString().split('T')[0] ? 'bg-yellow-100/70' : ''}
                      `}
                    />
                  ))
                ))}
              </div>

              {/* Task Bars */}
              {filteredTasks.map((task: Task, rowIndex: number) => {
                if (!task.start_date) return null;

                const taskStartDate = new Date(task.start_date);
                const taskEndDate = task.due_date 
                  ? new Date(task.due_date)
                  : calculateTaskEndDate(taskStartDate, task.effort || 8);

                // Tính số ngày làm việc giữa start_date và end_date (bỏ qua cuối tuần)
                let workDays = 0;
                let currentDate = new Date(taskStartDate);
                
                while (currentDate <= taskEndDate) {
                  if (!isWeekend(currentDate)) {
                    workDays++;
                  }
                  currentDate.setDate(currentDate.getDate() + 1);
                }

                // Tìm vị trí bắt đầu trên timeline
                const dayIndex = days.findIndex(day => 
                  day.toISOString().split('T')[0] === task.start_date
                );

                if (dayIndex === -1) return null;

                return (
                  <div
                    key={task.task_id}
                    style={{
                      position: 'absolute',
                      left: `${dayIndex * dayWidth}px`,
                      top: `${rowIndex * rowHeight}px`,
                      width: `${workDays * dayWidth}px`,
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
                      width={workDays * dayWidth}
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
