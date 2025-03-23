'use client';

import { Task } from '@/types/task';
import { AssignedUser } from '@/types/user';
import { TaskBar } from './TaskBar';
import { TimelineSkeleton } from './TimelineSkeleton';
import { PriorityTaskList } from './PriorityTaskList';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { getDatesBetween, formatDateVN, debugDate, isSameDay } from '@/lib/utils';
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
import { useProject } from '@/hooks/useProject';

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

// Struct để theo dõi thời gian làm việc còn lại của mỗi ngày
interface WorkSchedule {
  // Key: yyyy-MM-dd, Value: Số giờ còn lại trong ngày (8 - đã sử dụng)
  [date: string]: number;
}

// Tính thời điểm kết thúc của task dựa trên effort và thời gian làm việc còn lại
const calculateTaskSchedule = (
  startDate: Date, 
  effort: number,
  workSchedule: WorkSchedule = {}
): { endDate: Date, updatedSchedule: WorkSchedule, hoursPerDay: Record<string, number> } => {
  // Nếu effort là 0, task không chiếm thời gian làm việc nào
  if (effort <= 0) {
    return { 
      endDate: new Date(startDate), // Kết thúc cùng ngày bắt đầu
      updatedSchedule: { ...workSchedule },
      hoursPerDay: { [formatDateVN(startDate)]: 0 } // Không có giờ làm việc
    };
  }

  let remainingEffort = effort;
  const currentDate = new Date(startDate);
  const updatedSchedule = { ...workSchedule };
  const hoursPerDay: Record<string, number> = {}; // Số giờ task chiếm trong mỗi ngày
  let lastWorkDate = new Date(startDate); // Theo dõi ngày làm việc cuối cùng
  
  // Đặt thời gian về 00:00:00 để so sánh chính xác
  currentDate.setHours(0, 0, 0, 0);
  
  while (remainingEffort > 0) {
    if (isWeekend(currentDate)) {
      // Bỏ qua việc tính giờ làm cho ngày cuối tuần, nhưng vẫn tăng ngày
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }
    
    const dateStr = formatDateVN(currentDate);
    lastWorkDate = new Date(currentDate); // Cập nhật ngày làm việc cuối cùng
    
    // Số giờ còn lại trong ngày này (mặc định 8h nếu chưa có ai dùng)
    const remainingHoursInDay = updatedSchedule[dateStr] !== undefined 
      ? updatedSchedule[dateStr] 
      : 8;
    
    if (remainingHoursInDay <= 0) {
      // Ngày đã hết giờ làm việc, chuyển sang ngày tiếp theo
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }
    
    // Tính số giờ có thể làm trong ngày này
    const hoursForThisDay = Math.min(remainingEffort, remainingHoursInDay);
    
    // Lưu số giờ task chiếm trong ngày
    hoursPerDay[dateStr] = hoursForThisDay;
    
    // Cập nhật số giờ còn lại trong ngày
    updatedSchedule[dateStr] = remainingHoursInDay - hoursForThisDay;
    
    // Cập nhật effort còn lại
    remainingEffort -= hoursForThisDay;
    
    // Nếu còn effort, chuyển sang ngày tiếp theo
    if (remainingEffort > 0) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }
  
  // Trả về ngày làm việc cuối cùng làm ngày kết thúc
  return { 
    endDate: lastWorkDate, 
    updatedSchedule,
    hoursPerDay
  };
};

// Hàm tìm thời gian bắt đầu khả dụng cho task tiếp theo (dựa trên người được gán)
const findNextAvailableStartDate = (
  assigneeId: string | undefined, 
  lastTaskEndTime: Record<string, Date>,
  currentTime: Date
): Date => {
  if (!assigneeId || !lastTaskEndTime[assigneeId]) {
    return currentTime;
  }
  
  const userLastEndTime = lastTaskEndTime[assigneeId];
  return userLastEndTime > currentTime ? userLastEndTime : currentTime;
};

export function Timeline({ tasks, isLoading = false, onTaskClick, users }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const getCurrentDateVN = useCallback(() => {
    // Sử dụng timeZone string
    const now = new Date();
    const vnTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    
    // Reset thời gian về 00:00:00 để so sánh chính xác
    vnTime.setHours(0, 0, 0, 0);
    
    console.log('Current date VN:', debugDate(vnTime), vnTime);
    return vnTime;
  }, []);

  const today = getCurrentDateVN();

  // Hàm lấy ngày thứ 2 (Monday) của tuần trước đó
  const getLastMonday = useCallback(() => {
    const date = new Date(getCurrentDateVN());
    const day = date.getDay(); // 0 = Chủ nhật, 1 = Thứ 2, ..., 6 = Thứ 7
    
    // Nếu hôm nay là chủ nhật (0), lùi về 6 ngày để có thứ 2 tuần trước
    // Nếu hôm nay là thứ 2 (1), lùi về 7 ngày để có thứ 2 tuần trước
    // Nếu hôm nay là thứ 3-7 (2-6), lùi về (day + 6) ngày để có thứ 2 tuần trước
    const daysToSubtract = day === 0 ? 6 : (day === 1 ? 7 : day + 6);
    date.setDate(date.getDate() - daysToSubtract);
    
    console.log(`Tính ngày thứ 2 trước: Hôm nay là ${['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][day]}, lùi ${daysToSubtract} ngày = ${formatDateVN(date)}`);
    return date;
  }, [getCurrentDateVN]);

  // Tạo ref để theo dõi trạng thái đã khởi tạo từ localStorage
  const initializedFromLocalStorage = useRef(false);

  // Khởi tạo dateRange từ localStorage hoặc sử dụng giá trị mặc định
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    try {
      // Kiểm tra xem có dữ liệu trong localStorage không
      const savedRange = localStorage.getItem('ganttChartDateRange');
      
      if (savedRange) {
        const { startDate, endDate } = JSON.parse(savedRange);
        console.log('Đã tìm thấy dateRange trong localStorage:', { startDate, endDate });
        initializedFromLocalStorage.current = true;
        return {
          startDate: new Date(startDate),
          endDate: new Date(endDate)
        };
      }
    } catch (error) {
      console.error('Lỗi khi đọc dateRange từ localStorage:', error);
    }
    
    // Nếu không có dữ liệu hoặc có lỗi, sử dụng giá trị mặc định
    const startDate = getLastMonday();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 30); // Thêm 30 ngày = 1 tháng
    console.log('Sử dụng dateRange mặc định:', { 
      startDate: formatDateVN(startDate), 
      endDate: formatDateVN(endDate) 
    });
    
    return { startDate, endDate };
  });

  // Lưu dateRange vào localStorage khi có thay đổi
  useEffect(() => {
    try {
      const rangeToSave = {
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString()
      };
      localStorage.setItem('ganttChartDateRange', JSON.stringify(rangeToSave));
      console.log('Đã lưu dateRange vào localStorage:', rangeToSave);
    } catch (error) {
      console.error('Lỗi khi lưu dateRange vào localStorage:', error);
    }
  }, [dateRange]);

  const [orderedTasks, setOrderedTasks] = useState<Task[]>(tasks);
  const reorderTasks = useReorderTasks();
  const [viewMode, setViewMode] = useState<ViewMode>('project');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Lấy projectId từ task đầu tiên (nếu có)
  const projectId = useMemo(() => {
    if (tasks.length > 0 && tasks[0].project_id) {
      return tasks[0].project_id;
    }
    return '';
  }, [tasks]);

  // Sử dụng useProject hook để lấy thông tin chi tiết của project
  const { data: projectData } = useProject(projectId);

  // Lấy danh sách project members từ useProject hook
  const projectMembers = useMemo(() => {
    // Nếu có dữ liệu từ API, sử dụng nó
    if (projectData?.project?.members) {
      return projectData.project.members.map(member => ({
        id: member.user.userId,
        name: member.user.username || member.user.fullName || member.user.email,
        avatarUrl: member.user.avatarUrl,
        role: member.role
      }));
    }
    // Nếu không có dữ liệu từ API, sử dụng users từ props
    if (users && users.length > 0) {
      return users.map(user => ({
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role
      }));
    }
    return [];
  }, [projectData, users]);

  // Lấy danh sách assignees từ các task của dự án
  const taskAssignees = useMemo(() => {
    // Lấy thông tin assignee từ tất cả các task
    const assignees = orderedTasks
      .filter(task => task.assignee && task.assignee.userId) // Chỉ lấy task có assignee
      .map(task => ({
        id: task.assignee!.userId,
        name: task.assignee!.username || 'Không có tên',
        avatarUrl: task.assignee?.avatarUrl
      }));
    
    // Loại bỏ các assignee trùng lặp bằng cách chuyển sang Set và lại thành Array
    const uniqueAssignees = Array.from(
      new Map(assignees.map(item => [item.id, item])).values()
    );
    
    // Sắp xếp theo tên
    return uniqueAssignees.sort((a, b) => a.name.localeCompare(b.name));
  }, [orderedTasks]);

  // Gộp cả projectMembers và taskAssignees để hiển thị đầy đủ
  const allMembers = useMemo(() => {
    const memberMap = new Map();
    
    // Thêm project members vào map
    projectMembers.forEach(member => {
      memberMap.set(member.id, member);
    });
    
    // Thêm task assignees vào map (sẽ ghi đè nếu đã tồn tại)
    taskAssignees.forEach(assignee => {
      memberMap.set(assignee.id, assignee);
    });
    
    // Chuyển map thành array và sắp xếp theo tên
    return Array.from(memberMap.values())
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [projectMembers, taskAssignees]);

  // Filter tasks theo view mode (project hoặc user)
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
      // Lọc bỏ tasks đã hoàn thành (status = done)
      const activeTasks = inputTasks.filter(task => task.status !== 'done');
      
      // Sắp xếp tasks theo priority_order
      const sortedTasks = [...activeTasks].sort((a, b) => a.priority_order - b.priority_order);
      
      const currentDate = getCurrentDateVN();
      console.log('Ngày hiện tại (VN):', formatDateVN(currentDate), currentDate);
      
      // Theo dõi thời gian làm việc còn lại cho mỗi ngày và mỗi người dùng
      const scheduleByUser: Record<string, WorkSchedule> = {};
      
      // Theo dõi thời gian kết thúc cho mỗi task
      const taskSchedules: Record<string, { 
        start: Date, 
        end: Date, 
        hoursPerDay: Record<string, number> 
      }> = {};
      
      // Process tasks sequentially to handle dependencies correctly
      const result = [];
      
      for (let i = 0; i < sortedTasks.length; i++) {
        const task = sortedTasks[i];
        const assigneeId = task.assignee?.userId || 'unassigned';
        let updatedTask = { ...task };
        
        // Khởi tạo lịch làm việc cho người dùng nếu chưa có
        if (!scheduleByUser[assigneeId]) {
          scheduleByUser[assigneeId] = {};
        }
        
        // Cập nhật priority_order bắt đầu từ 1 (thay vì 0)
        updatedTask.priority_order = i + 1;
        
        // Nếu task đã có start_date, tính lại dựa trên effort và thời gian đã sử dụng
        let startDate: Date;
        
        if (task.start_date) {
          console.log(`Task ${task.title} có start_date: ${task.start_date}`);
          startDate = new Date(task.start_date);
        } else {
          console.log(`Task ${task.title} không có start_date, đặt từ ngày hiện tại hoặc theo task trước`);
          // Mặc định bắt đầu từ ngày hiện tại
          startDate = new Date(currentDate);
          
          // Kiểm tra các task trước của cùng assignee
          for (let j = 0; j < i; j++) {
            const prevTask = sortedTasks[j];
            if (prevTask.assignee?.userId === assigneeId && taskSchedules[prevTask.task_id]) {
              const prevSchedule = taskSchedules[prevTask.task_id];
              if (prevSchedule.end > startDate) {
                startDate = new Date(prevSchedule.end);
                console.log(`- Dựa trên task trước (${prevTask.title}), bắt đầu từ: ${formatDateVN(startDate)}`);
              }
            }
          }
          
          // Bỏ qua ngày cuối tuần nếu cần
          while (isWeekend(startDate)) {
            startDate = getNextWorkDay(startDate);
            console.log(`- Bỏ qua cuối tuần, bắt đầu từ: ${formatDateVN(startDate)}`);
          }
        }
        
        // Lấy effort thực tế, mặc định là 0 nếu không có
        const taskEffort = task.effort !== undefined ? task.effort : 0;
        
        // Tính toán lịch trình làm việc
        const { endDate, updatedSchedule, hoursPerDay } = calculateTaskSchedule(
          startDate,
          taskEffort,
          scheduleByUser[assigneeId]
        );
        
        // Cập nhật lịch làm việc cho người dùng
        scheduleByUser[assigneeId] = updatedSchedule;
        
        // Lưu lịch trình của task
        taskSchedules[task.task_id] = {
          start: startDate,
          end: endDate,
          hoursPerDay
        };
        
        console.log(`Task ${task.title} (${taskEffort}h):`, {
          startDate: formatDateVN(startDate),
          endDate: formatDateVN(endDate),
          hoursPerDay: Object.entries(hoursPerDay).map(([date, hours]) => `${date}: ${hours}h`).join(', ')
        });
        
        updatedTask.start_date = formatDateVN(startDate);
        updatedTask.due_date = formatDateVN(endDate);
        
        result.push(updatedTask);
      }

      return result;
    };

    setOrderedTasks(processTasks(tasks));
  }, [tasks, getCurrentDateVN]);

  useEffect(() => {
    if (tasks.length === 0) return;

    // Chỉ tính toán dateRange nếu chưa khởi tạo từ localStorage
    if (!initializedFromLocalStorage.current) {
      // Đảm bảo rằng dateRange bao gồm ngày hiện tại
      const currentDate = getCurrentDateVN();
      const taskDates = tasks
        .flatMap(task => [
          task.start_date ? new Date(task.start_date) : null,
          task.due_date ? new Date(task.due_date) : null
        ])
        .filter((date): date is Date => date !== null);

      if (taskDates.length === 0) {
        // Nếu không có task nào có ngày, sử dụng ngày hiện tại
        const startDate = getLastMonday();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 30);
        setDateRange({ startDate, endDate });
        return;
      }

      // Tìm ngày sớm nhất và muộn nhất trong danh sách task
      const earliestTaskDate = new Date(Math.min(...taskDates.map(d => d.getTime())));
      const latestTaskDate = new Date(Math.max(...taskDates.map(d => d.getTime())));

      // Đảm bảo rằng ngày bắt đầu không muộn hơn ngày hiện tại
      const startDate = currentDate < earliestTaskDate ? currentDate : earliestTaskDate;
      
      // Đảm bảo rằng ngày kết thúc ít nhất là 14 ngày sau ngày bắt đầu
      const endDate = new Date(latestTaskDate);
      if (endDate < startDate) {
        endDate.setDate(startDate.getDate() + 30);
      } else {
        endDate.setDate(endDate.getDate() + 2); // Thêm 2 ngày buffer
      }

      console.log('Date Range Calculation:', {
        today: formatDateVN(currentDate),
        earliestTaskDate: formatDateVN(earliestTaskDate),
        latestTaskDate: formatDateVN(latestTaskDate),
        startDate: formatDateVN(startDate),
        endDate: formatDateVN(endDate)
      });

      setDateRange({ startDate, endDate });
    }
    // Sau khi đã xử lý một lần, đánh dấu là đã khởi tạo để không ghi đè lại
    initializedFromLocalStorage.current = true;
  }, [tasks, getCurrentDateVN, getLastMonday, initializedFromLocalStorage]);

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
      
      // Đảm bảo tất cả task đều được tính toán lại ngày bắt đầu dựa trên thứ tự mới
      const tasksToRecalculate = reorderedTasks.map((task, index) => ({
        ...task,
        priority_order: index + 1,
        // Chỉ giữ start_date cho task đầu tiên hoặc task cố định
        start_date: index === 0 && task.start_date ? task.start_date : undefined
      }));
  
      const taskOrders = tasksToRecalculate.map((task, index) => ({
        taskId: task.task_id,
        priorityOrder: index + 1
      }));
      
      // Theo dõi thời gian làm việc còn lại cho mỗi ngày và mỗi người dùng
      const scheduleByUser: Record<string, WorkSchedule> = {};
      const currentDate = getCurrentDateVN();
      const taskSchedules: Record<string, { start: Date, end: Date, hoursPerDay: Record<string, number> }> = {};
      
      // Tính toán lại task schedule dựa trên thứ tự mới
      const processedTasks = tasksToRecalculate.map((task, index) => {
        const assigneeId = task.assignee?.userId || 'unassigned';
        
        // Khởi tạo lịch làm việc cho người dùng nếu chưa có
        if (!scheduleByUser[assigneeId]) {
          scheduleByUser[assigneeId] = {};
        }
        
        // Xác định ngày bắt đầu
        let startDate: Date;
        
        if (index === 0 && task.start_date) {
          // Giữ nguyên ngày bắt đầu cho task đầu tiên (nếu có)
          startDate = new Date(task.start_date);
        } else {
          // Bắt đầu từ ngày hiện tại
          startDate = new Date(currentDate);
          
          // Kiểm tra các task trước của cùng assignee
          for (let j = 0; j < index; j++) {
            const prevTask = tasksToRecalculate[j];
            if (prevTask.assignee?.userId === assigneeId && taskSchedules[prevTask.task_id]) {
              const prevSchedule = taskSchedules[prevTask.task_id];
              if (prevSchedule.end > startDate) {
                startDate = new Date(prevSchedule.end);
              }
            }
          }
          
          // Bỏ qua ngày cuối tuần nếu cần
          while (isWeekend(startDate)) {
            startDate = getNextWorkDay(startDate);
          }
        }
        
        // Lấy effort thực tế, mặc định là 0 nếu không có
        const taskEffort = task.effort !== undefined ? task.effort : 0;
        
        // Tính toán lịch trình
        const { endDate, updatedSchedule, hoursPerDay } = calculateTaskSchedule(
          startDate,
          taskEffort,
          scheduleByUser[assigneeId]
        );
        
        // Cập nhật lịch làm việc cho người dùng
        scheduleByUser[assigneeId] = updatedSchedule;
        
        // Lưu lịch trình của task
        taskSchedules[task.task_id] = {
          start: startDate,
          end: endDate,
          hoursPerDay
        };
        
        console.log(`[Reordered] Task ${task.title} (${taskEffort}h):`, {
          startDate: formatDateVN(startDate),
          endDate: formatDateVN(endDate),
          hoursPerDay: Object.entries(hoursPerDay).map(([date, hours]) => `${date}: ${hours}h`).join(', ')
        });
        
        return {
          ...task,
          start_date: formatDateVN(startDate),
          due_date: formatDateVN(endDate)
        };
      });
      
      setOrderedTasks(processedTasks as Task[]);
  
      if (reorderTasks && tasks[0]?.project_id) {
        reorderTasks.mutate({
          projectId: tasks[0].project_id,
          taskOrders
        });
      }
    }
  }, [orderedTasks, tasks, reorderTasks, getCurrentDateVN]);

  const onDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      handleTaskReorder(String(active.id), orderedTasks.findIndex(task => task.task_id === String(over.id)));
    }
  }, [orderedTasks, handleTaskReorder]);

  // Xử lý khi thay đổi ngày bắt đầu
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    console.log('Thay đổi ngày bắt đầu:', formatDateVN(newDate));
    setDateRange(prev => ({
      ...prev,
      startDate: newDate
    }));
  };

  // Xử lý khi thay đổi ngày kết thúc
  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    console.log('Thay đổi ngày kết thúc:', formatDateVN(newDate));
    setDateRange(prev => ({
      ...prev,
      endDate: newDate
    }));
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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-4 h-full">
        <div className="w-80 flex-shrink-0 overflow-y-auto max-h-[calc(100vh-200px)] border-r border-slate-200">
          {viewMode === 'project' ? (
            <PriorityTaskList 
              tasks={orderedTasks} 
              onTaskClick={onTaskClick} 
              onTaskReorder={handleTaskReorder}
            />
          ) : (
            <>
              <div className="p-3 border-b">
                <h3 className="font-medium text-slate-700">
                  Tasks của {allMembers.find(u => u.id === selectedUserId)?.name || 'Người dùng'}
                </h3>
              </div>
              {selectedUserId ? (
                <PriorityTaskList 
                  tasks={filteredTasks} 
                  onTaskClick={onTaskClick} 
                  onTaskReorder={handleTaskReorder}
                />
              ) : (
                <div className="p-3 text-slate-500 text-sm">
                  Vui lòng chọn một người dùng để xem danh sách task
                </div>
              )}
            </>
          )}
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
            <div className="sticky top-0 bg-white border-b border-slate-200 z-10">
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
                        aria-label="Chọn người dùng để lọc task"
                        title="Chọn người dùng"
                      >
                        <option value="">Chọn người dùng</option>
                        {allMembers.map(member => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="start-date" className="text-sm text-slate-600">
                      Bắt đầu:
                    </label>
                    <input
                      id="start-date"
                      type="date"
                      value={dateRange.startDate.toISOString().split('T')[0]}
                      onChange={handleStartDateChange}
                      className="px-2 py-1 text-sm border rounded"
                      aria-label="Ngày bắt đầu"
                      title="Ngày bắt đầu hiển thị"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="end-date" className="text-sm text-slate-600">
                      Kết thúc:
                    </label>
                    <input
                      id="end-date"
                      type="date"
                      value={dateRange.endDate.toISOString().split('T')[0]}
                      onChange={handleEndDateChange}
                      className="px-2 py-1 text-sm border rounded"
                      aria-label="Ngày kết thúc"
                      title="Ngày kết thúc hiển thị"
                    />
                  </div>
                </div>
              </div>
              <div className="flex" style={{ height: '40px' }}>
                {days.map((day: Date, index: number) => {
                  const isToday = isSameDay(day, today);
                  const isWeekendDay = isWeekend(day);
                  
                  return (
                    <div
                      key={day.toISOString()}
                      style={{ width: `${dayWidth}px` }}
                      className={`
                        flex-shrink-0 border-r border-slate-200 p-2
                        ${isWeekendDay ? 'bg-slate-100/80' : ''}
                        ${isToday ? 'bg-yellow-100/80 font-semibold' : ''}
                      `}
                    >
                      <div className="flex flex-col justify-center h-full">
                        <div className="text-xs text-slate-700 font-medium">
                          {day.toLocaleDateString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit'
                          })}
                        </div>
                        <div className="text-[0.6rem] text-slate-500">
                          {day.toLocaleDateString('vi-VN', { weekday: 'short' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Grid Container */}
            <div className="relative inset-0">
              {/* Grid Background */}
              <div className="relative">
                {/* Columns for days - highlight background first */}
                <div 
                  className="absolute inset-0 grid"
                  style={{
                    gridTemplateColumns: `repeat(${days.length}, ${dayWidth}px)`,
                    height: `${orderedTasks.length * rowHeight}px`,
                    minHeight: rowHeight,
                    zIndex: 5
                  }}
                >
                  {days.map((day: Date, index: number) => {
                    const isToday = isSameDay(day, today);
                    const isWeekendDay = isWeekend(day);
                    
                    return (
                      <div
                        key={`column-${day.toISOString()}`}
                        className={`
                          ${isWeekendDay ? 'bg-slate-100' : ''}
                          ${isToday ? 'bg-yellow-100' : ''}
                        `}
                      />
                    );
                  })}
                </div>
                
                {/* Grid lines on top of the background */}
                <div 
                  className="grid relative"
                  style={{
                    gridTemplateColumns: `repeat(${days.length}, ${dayWidth}px)`,
                    gridTemplateRows: `repeat(${orderedTasks.length}, ${rowHeight}px)`,
                    gridAutoFlow: 'row',
                    height: `${orderedTasks.length * rowHeight}px`,
                    minHeight: rowHeight,
                    zIndex: 10
                  }}
                >
                  {Array.from({ length: days.length * orderedTasks.length }).map((_, index) => (
                    <div
                      key={`grid-cell-${index}`}
                      className="border-r border-b border-slate-200 relative"
                    />
                  ))}
                </div>
              </div>

              {/* Task Bars */}
              {filteredTasks.map((task: Task, rowIndex: number) => {
                if (!task.start_date) {
                  return null;
                }

                const taskStartDate = new Date(task.start_date);
                const taskEndDate = task.due_date 
                  ? new Date(task.due_date)
                  : calculateTaskSchedule(taskStartDate, task.effort || 0).endDate;

                // Tính tổng số ngày (kể cả ngày nghỉ) giữa start_date và end_date
                const startDayIndex = days.findIndex(day => isSameDay(day, taskStartDate));
                const endDayIndex = days.findIndex(day => isSameDay(day, taskEndDate));
                
                // Nếu không tìm thấy ngày trong timeline, bỏ qua task này
                if (startDayIndex === -1) return null;
                
                // Tính số ngày hiển thị (bao gồm cả ngày cuối tuần)
                // Nếu không tìm thấy ngày kết thúc trong timeline, hiển thị đến hết ngày cuối cùng của timeline
                const totalDays = endDayIndex === -1
                  ? days.length - startDayIndex
                  : endDayIndex - startDayIndex + 1;
                
                // Đảm bảo task luôn có ít nhất 1 ngày hiển thị
                const displayDays = Math.max(1, totalDays);
                
                console.log(`Task ${task.title}: start=${formatDateVN(taskStartDate)}, end=${formatDateVN(taskEndDate)}, days=${displayDays}`);

                return (
                  <div
                    key={task.task_id}
                    style={{
                      position: 'absolute',
                      left: `${startDayIndex * dayWidth}px`,
                      top: `${rowIndex * rowHeight}px`,
                      width: `${displayDays * dayWidth}px`,
                      height: `${rowHeight}px`,
                      zIndex: 30,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      padding: '0 4px'
                    }}
                  >
                    <TaskBar
                      task={task}
                      width={displayDays * dayWidth - 8}
                      x={0}
                      y={0}
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
