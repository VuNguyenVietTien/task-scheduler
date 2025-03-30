'use client';

import { Task, Priority } from '@/types/task';
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
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { updateTaskPriority } from '@/redux/features/tasksSlice';
import { 
  fetchProjectPlans, 
  fetchLatestProjectPlan, 
  createPlan,
  updatePlan,
  deletePlan,
  setPlanActive,
  setActivePlan,
  selectPlans,
  selectActivePlan,
  selectPlansLoading
} from '@/redux/features/plansSlice';
import { 
  updateTaskOrder, 
  updateTasksWithDates, 
  resetTaskOrder, 
  initializeFromTasks, 
  selectOrderedTasks, 
  selectSourceTaskIds, 
  selectIsPlanLoaded,
  TaskOrderItem
} from '@/redux/features/taskOrderStore';
import { Dialog } from '@/components/ui/Dialog';
import { Plan, PlanData, PlanTaskData, CreatePlanInput, CreatePlanDataInput, CreatePlanTaskDataInput } from '@/types/plan';
import { ChevronDownIcon, PlusIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

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
    
    // Tính toán số giờ làm việc trong ngày này (tối đa 8h/ngày)
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
  const ganttContentRef = useRef<HTMLDivElement>(null);
  const dateHeadersRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [planName, setPlanName] = useState<string>('');
  const [showSavePlanDialog, setShowSavePlanDialog] = useState(false);
  const [showDeletePlanDialog, setShowDeletePlanDialog] = useState(false);
  const dispatch = useAppDispatch();
  const [viewMode, setViewMode] = useState<ViewMode>('project');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const prevTasksRef = useRef<string>('');

  // Lấy data từ Redux store
  const plans = useAppSelector(selectPlans);
  const activePlan = useAppSelector(selectActivePlan);
  const plansLoading = useAppSelector(selectPlansLoading);
  
  // Lấy thông tin từ taskOrderStore
  const orderedTasks = useAppSelector(selectOrderedTasks);
  const sourceTaskIds = useAppSelector(selectSourceTaskIds);
  const isPlanLoaded = useAppSelector(selectIsPlanLoaded);

  // Lấy projectId từ tasks
  const currentProjectId = useMemo(() => {
    if (tasks && tasks.length > 0 && tasks[0].projectId) {
      return tasks[0].projectId;
    }
    return '';
  }, [tasks]);
  
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

  // Hàm chuyển đổi từ Task[] sang TaskOrderItem[]
  const mapTasksToTaskOrderItems = useCallback((tasks: Task[]): TaskOrderItem[] => {
    return tasks.map((task, index) => ({
      taskId: task.task_id,
      title: task.title,
      priorityOrder: task.priority_order || index,
      startDate: task.start_date,
      endDate: task.due_date,
      fromPlan: false
    }));
  }, []);

  // Lấy danh sách assignees từ các task của dự án
  const taskAssignees = useMemo(() => {
    // Lấy thông tin assignee từ tất cả các task
    const assignees = tasks
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
    
    return uniqueAssignees;
  }, [tasks]);

  // Map users prop thành projectMembers format
  const projectMembers = useMemo(() => {
    if (users && users.length > 0) {
      return users.map(user => ({
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role
      }));
    }
    return [];
  }, [users]);

  // Gộp cả projectMembers và taskAssignees để hiển thị đầy đủ
  const allMembers = useMemo(() => {
    // Tạo Map để lưu trữ members và loại bỏ trùng lặp
    const memberMap = new Map();
    
    // Thêm users từ props 
    if (users && users.length > 0) {
      users.forEach(user => {
        memberMap.set(user.id, {
          id: user.id,
          name: user.name,
          avatarUrl: user.avatarUrl,
          role: user.role
        });
      });
    }
    
    // Thêm assignees từ tasks nếu chưa có
    tasks
      .filter(task => task.assignee && task.assignee.userId)
      .forEach(task => {
        const assignee = task.assignee!;
        if (!memberMap.has(assignee.userId)) {
          memberMap.set(assignee.userId, {
            id: assignee.userId,
            name: assignee.username || 'Không có tên',
            avatarUrl: assignee.avatarUrl,
            role: 'member'
          });
        }
      });
    
    // Chuyển map thành array và sắp xếp theo tên
    return Array.from(memberMap.values())
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [tasks, users]);

  // Filter tasks theo view mode (project hoặc user) từ orderedTasks trong store
  const filteredTasks = useMemo(() => {
    // Chuyển đổi từ TaskOrderItems sang Task[] để có thể sử dụng
    const tasksWithOrder = orderedTasks.map(orderItem => {
      // Tìm task gốc
      const originalTask = tasks.find(task => task.task_id === orderItem.taskId);
      if (!originalTask) return null;
      
      // Kết hợp thông tin từ orderItem và originalTask
      return {
        ...originalTask,
        priority_order: orderItem.priorityOrder,
        start_date: orderItem.startDate || originalTask.start_date,
        due_date: orderItem.endDate || originalTask.due_date
      };
    }).filter(task => task !== null) as Task[];
    
    // Áp dụng bộ lọc theo viewMode
    if (viewMode === 'project') {
      return tasksWithOrder;
    } 
    if (viewMode === 'user' && selectedUserId) {
      return tasksWithOrder.filter(task => task.assignee?.userId === selectedUserId);
    }
    return [];
  }, [orderedTasks, tasks, viewMode, selectedUserId]);

  // Đưa hàm processTasks vào useCallback để tránh tạo instance mới mỗi khi render
  const processTasks = useCallback((inputTasks: Task[], keepOrder: boolean = false): Task[] => {
    // Kiểm tra có những thay đổi thực sự không 
    const tasksJSON = JSON.stringify(inputTasks.map(t => t.task_id));
    if (tasksJSON === prevTasksRef.current) {
      console.log('Bỏ qua processTasks do tasks không thay đổi');
      return inputTasks;
    }
    
    // Lưu lại trạng thái tasks hiện tại để so sánh lần sau
    prevTasksRef.current = tasksJSON;
    
    console.log('Xử lý các task:', inputTasks);
    let completedTasks: Task[] = [];
    let activeTasks: Task[] = [];

    // Lọc các task đã hoàn thành và chưa hoàn thành
    inputTasks.forEach(task => {
      if (task.status === 'done') {
        completedTasks.push(task);
      } else {
        activeTasks.push(task);
      }
    });

    let sortedTasks: Task[] = [];

    // Nếu keepOrder=true, giữ nguyên thứ tự do người dùng kéo thả 
    if (keepOrder) {
      sortedTasks = [...activeTasks];
      console.log('Giữ nguyên thứ tự kéo thả của người dùng');
    } else if (activePlan) {
      // Nếu có active plan, sắp xếp theo priority_order
      sortedTasks = [...activeTasks].sort((a, b) => a.priority_order - b.priority_order);
    } else {
      // Sắp xếp các task chưa hoàn thành theo priority
      sortedTasks = [...activeTasks].sort((a, b) => {
        // Sắp xếp theo priority
        const priorityOrder: Record<string, number> = {
          urgent: 1,  // Ưu tiên cao nhất
          high: 2,
          medium: 3,
          low: 4
        };

        const aPriority = priorityOrder[a.priority?.toLowerCase() || 'medium'] || 3;
        const bPriority = priorityOrder[b.priority?.toLowerCase() || 'medium'] || 3;

        return aPriority - bPriority;
      });
    }
      
    // Hàm mới để áp dụng thứ tự từ taskOrderStore
    const applyTaskOrder = (tasks: Task[]): Task[] => {
      if (sourceTaskIds.length === 0) return tasks;
      
      // Tạo map giữa taskId và index trong sourceTaskIds
      const taskOrderMap = new Map<string, number>();
      sourceTaskIds.forEach((taskId, index) => {
        taskOrderMap.set(taskId, index);
      });
      
      // Sắp xếp tasks theo thứ tự trong sourceTaskIds
      return [...tasks].sort((a, b) => {
        const aOrder = taskOrderMap.get(a.task_id) ?? 999;
        const bOrder = taskOrderMap.get(b.task_id) ?? 999;
        return aOrder - bOrder;
      });
    };

    // Nếu keepOrder=true hoặc có thứ tự từ store, áp dụng thứ tự đó
    if (keepOrder || sourceTaskIds.length > 0) {
      sortedTasks = applyTaskOrder(sortedTasks);
    }
      
    const currentDate = getCurrentDateVN();
    console.log('Ngày hiện tại (VN):', formatDateVN(currentDate), currentDate);
    
    // Map để lưu trữ thông tin về start_date từ database (chỉ dùng khi cần)
    const originalStartDates = new Map<string, string | undefined>();
    
    // Lưu lại start_date gốc từ database của mỗi task nếu cần
    sortedTasks.forEach(task => {
      // Chỉ lưu start_date từ database nếu được đánh dấu
      if (task.db_start_date) {
        originalStartDates.set(task.task_id, task.db_start_date);
      }
    });
      
    // Theo dõi thời gian làm việc còn lại cho mỗi ngày và mỗi người dùng
    const scheduleByUser: Record<string, WorkSchedule> = {};
      
    // Theo dõi thời gian kết thúc mới nhất cho mỗi người được gán
    const lastTaskEndTimeByUser: Record<string, Date> = {};
      
    // Process tasks sequentially to handle dependencies correctly
    const result = [];
      
    for (let i = 0; i < sortedTasks.length; i++) {
      const task = sortedTasks[i];
      
      // Nếu task đến từ plan (from_plan=true) và có đầy đủ ngày bắt đầu, kết thúc
      // thì KHÔNG tính toán lại, giữ nguyên dữ liệu từ plan
      if ((task as any).from_plan && task.start_date && task.due_date) {
        console.log(`Task ${task.title} giữ nguyên dữ liệu từ plan - start_date: ${task.start_date}, due_date: ${task.due_date}`);
        const updatedTask = { 
          ...task,
          priority_order: i + 1, // Vẫn cập nhật priority_order theo thứ tự hiện tại
        };
        result.push(updatedTask);
        continue; // Bỏ qua phần tính toán bên dưới
      }
      
      const assigneeId = task.assignee?.userId || 'unassigned';
      let updatedTask = { ...task };
      
      // Khởi tạo lịch làm việc cho người dùng nếu chưa có
      if (!scheduleByUser[assigneeId]) {
        scheduleByUser[assigneeId] = {};
      }
      
      // Cập nhật priority_order bắt đầu từ 1 (thay vì 0)
      updatedTask.priority_order = i + 1;
      
      // Tìm thời gian bắt đầu khả dụng cho task này
      let startDate: Date;
      
      // Kiểm tra nếu task có start_date cố định từ database VÀ không cần tính toán lại
      if (task.db_start_date && !task.force_recalculate) {
        console.log(`Task ${task.title} giữ nguyên start_date cố định từ DB: ${task.db_start_date}`);
        startDate = new Date(task.db_start_date);
        
        // Ghi nhớ đây là start_date từ DB
        updatedTask.db_start_date = task.db_start_date;
      } else {
        // Mọi trường hợp khác đều tính toán lại start_date dựa trên thứ tự ưu tiên
        console.log(`Task ${task.title} tính toán lại start_date dựa trên thứ tự ưu tiên`);
        
        // Sử dụng hàm findNextAvailableStartDate để tìm thời gian bắt đầu phù hợp
        startDate = findNextAvailableStartDate(
          assigneeId,
          lastTaskEndTimeByUser,
          currentDate
        );
          
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
      
      // Cập nhật thời gian kết thúc mới nhất cho người được gán
      lastTaskEndTimeByUser[assigneeId] = new Date(endDate);
    
      // Lưu lịch trình của task - đảm bảo taskId không bao giờ là undefined
      const taskId = task.task_id || task.id || `task-${i}`;
      
      console.log(`Task ${task.title} (${taskEffort}h):`, {
        startDate: formatDateVN(startDate),
        endDate: formatDateVN(endDate),
        hoursPerDay: Object.entries(hoursPerDay).map(([date, hours]) => `${date}: ${hours}h`).join(', ')
      });
      
      updatedTask.start_date = formatDateVN(startDate);
      updatedTask.due_date = formatDateVN(endDate);
    
      // Đảm bảo xóa flag force_recalculate sau khi đã tính toán lại
      if (updatedTask.force_recalculate) {
        updatedTask.force_recalculate = false;
      }
      
      result.push(updatedTask);
    }

    return result.concat(completedTasks);
  }, [getCurrentDateVN, activePlan, sourceTaskIds]);

  // Thêm biến để kiểm soát việc cập nhật tasks trong useEffect
  const initialProcessingDone = useRef(false);
  
  // Thêm ref để theo dõi đã xử lý activePlan chưa
  const hasProcessedActivePlan = useRef(false);
  
  // Load plans từ Redux khi component mount
  useEffect(() => {
    if (currentProjectId) {
      // Fetch danh sách plan
      dispatch(fetchProjectPlans(currentProjectId));
      // Fetch plan mới nhất để ưu tiên hiển thị
      dispatch(fetchLatestProjectPlan(currentProjectId));
    }
  }, [dispatch, currentProjectId]);

  // Thêm useEffect chạy khi component mount - Chỉ chạy một lần
  useEffect(() => {
    if (tasks.length > 0 && !initialProcessingDone.current) {
      // Khởi tạo taskOrderStore với tasks ban đầu
      dispatch(initializeFromTasks(tasks));
      // Xử lý tasks ban đầu khi component mount
      const processedTasks = processTasks(tasks);
      // Cập nhật vào taskOrderStore
      dispatch(updateTasksWithDates(mapTasksToTaskOrderItems(processedTasks)));
      // Đánh dấu đã xử lý ban đầu
      initialProcessingDone.current = true;
    }
  }, [dispatch, tasks, processTasks, mapTasksToTaskOrderItems]);

  // Điều chỉnh onDragStart để đánh dấu bắt đầu kéo thả
  const onDragStart = useCallback(() => {
    setIsDragging(true);
    if (window.navigator.vibrate) {
      window.navigator.vibrate(100);
    }
  }, []);

  // Điều chỉnh onDragEnd để sử dụng taskOrderStore
  const onDragEnd = useCallback(async (event: DragEndEvent) => {
    // Đánh dấu kết thúc kéo thả
    setIsDragging(false);
    
    const { active, over } = event;
    
    if (!over) return;
    
    const activeTaskId = active.id as string;
    const overTaskId = over.id as string;
    
    if (activeTaskId === overTaskId) return;
    
    // Map taskOrderItems để dễ dàng truy xuất bằng ID
    const taskMap = new Map<string, TaskOrderItem>();
    orderedTasks.forEach(item => taskMap.set(item.taskId, item));
    
    // Tìm vị trí mới trong danh sách
    const taskListIds = orderedTasks.map(task => task.taskId);
    const oldIndex = taskListIds.indexOf(activeTaskId);
    const newIndex = taskListIds.indexOf(overTaskId);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    // Tạo mảng mới theo thứ tự ưu tiên
    const newTasksOrder = arrayMove(orderedTasks, oldIndex, newIndex);
    
    // Cập nhật chỉ số priorityOrder
    const updatedTasksOrder = newTasksOrder.map((task, index) => ({
      ...task,
      priorityOrder: index
    }));
    
    // Đánh dấu nếu cần tính toán lại ngày tháng
    const tasksToRecalculate = tasks.map(task => {
      // Tìm task tương ứng trong newTasksOrder
      const orderItem = taskMap.get(task.task_id);
      const newIndex = updatedTasksOrder.findIndex(item => item.taskId === task.task_id);
      
      if (orderItem && newIndex !== -1) {
        return {
          ...task,
          priority_order: newIndex,
          // Sau khi reorder, bỏ qua start_date cũ để tính toán lại từ đầu
          start_date: undefined,
          due_date: undefined,
          // Đánh dấu TẤT CẢ các task đều cần tính toán lại
          force_recalculate: true
        };
      }
      return task;
    });
    
    console.log('Thứ tự task mới sau khi kéo thả:', updatedTasksOrder.map((task, idx) => 
      `${task.title} - index: ${idx}`
    ));
    
    // Cập nhật vào Redux store
    dispatch(updateTaskOrder(updatedTasksOrder));
    
    // Tính toán lại task schedule dựa trên thứ tự mới
    // Sử dụng keepOrder=true để giữ nguyên thứ tự kéo thả, nhưng tính lại tất cả các ngày
    const processedTasks = processTasks(tasksToRecalculate, true);
    
    // Cập nhật thông tin mới nhất vào TaskOrderStore
    dispatch(updateTasksWithDates(mapTasksToTaskOrderItems(processedTasks)));
  }, [orderedTasks, processTasks, dispatch, tasks, mapTasksToTaskOrderItems]);

  // Hàm riêng cho PriorityTaskList để xử lý kéo thả
  const handleTaskReorder = useCallback((taskId: string, newIndex: number) => {
    // Map taskOrderItems để dễ dàng truy xuất bằng ID
    const taskMap = new Map<string, TaskOrderItem>();
    orderedTasks.forEach(item => taskMap.set(item.taskId, item));
    
    const oldIndex = orderedTasks.findIndex((task) => task.taskId === taskId);

    if (oldIndex !== -1 && newIndex !== -1) {
      // Tạo mảng tasks mới sau khi kéo thả
      const reorderedTaskItems = arrayMove(orderedTasks, oldIndex, newIndex);
      
      // Cập nhật chỉ số priorityOrder
      const updatedTaskItems = reorderedTaskItems.map((task, index) => ({
        ...task,
        priorityOrder: index
      }));
      
      // Cập nhật thứ tự tasks trong Redux store
      dispatch(updateTaskOrder(updatedTaskItems));
      
      // Đánh dấu nếu cần tính toán lại ngày tháng
      const tasksToRecalculate = tasks.map(task => {
        // Tìm task tương ứng trong newTasksOrder
        const orderItem = taskMap.get(task.task_id);
        const newTaskIndex = updatedTaskItems.findIndex(item => item.taskId === task.task_id);
        
        if (orderItem && newTaskIndex !== -1) {
          return {
            ...task,
            priority_order: newTaskIndex,
            // Sau khi reorder, bỏ qua start_date cũ để tính toán lại từ đầu
            start_date: undefined,
            due_date: undefined,
            // Đánh dấu TẤT CẢ các task đều cần tính toán lại
            force_recalculate: true
          };
        }
        return task;
      });
      
      // Tính toán lại task schedule dựa trên thứ tự mới
      // Sử dụng keepOrder=true để giữ nguyên thứ tự kéo thả, nhưng tính lại tất cả các ngày
      const processedTasks = processTasks(tasksToRecalculate, true);
      
      // Cập nhật thông tin mới nhất vào TaskOrderStore 
      dispatch(updateTasksWithDates(mapTasksToTaskOrderItems(processedTasks)));
    }
  }, [orderedTasks, processTasks, dispatch, tasks, mapTasksToTaskOrderItems]);

  // Tách logic activePlan thành một useEffect riêng để tránh vòng lặp
  useEffect(() => {
    // Chỉ xử lý khi có thay đổi activePlan và có tasks
    if (!activePlan || tasks.length === 0 || hasProcessedActivePlan.current) {
      return;
    }

    // Đánh dấu đã xử lý activePlan này
    hasProcessedActivePlan.current = true;
    console.log('Đang xử lý activePlan:', activePlan.name);

    try {
      // Xử lý planData có thể là chuỗi JSON hoặc đã là đối tượng
      let planData = activePlan.planData;
      if (typeof planData === 'string') {
        planData = JSON.parse(planData);
      }
      
      // Kiểm tra nếu có thông tin tasks trong planData
      if (planData && planData.tasks && planData.tasks.length > 0) {
        console.log('Plan Data từ database:', planData.tasks.map((t: any) => 
          `Task ${t.title || 'Không có title'} (ID: ${t.taskId}) - Priority: ${t.priorityOrder}`
        ));
        
        // Tạo Map để lưu thông tin priority và ngày từ plan
        const taskDataMap = new Map<string, {
          priorityOrder: number,
          startDate?: string,
          endDate?: string,
          title?: string
        }>();
        
        // Xử lý dữ liệu task từ plan
        planData.tasks.forEach((planTask: any) => {
          taskDataMap.set(planTask.taskId, {
            priorityOrder: planTask.priorityOrder,
            startDate: planTask.startDate,
            endDate: planTask.endDate,
            title: planTask.title
          });
        });
        
        // Tạo danh sách task mới dựa trên dữ liệu từ plan
        // CÓ ĐẢM BẢO: Không tính toán lại start_date và end_date
        const updatedOrderedTasks = [...tasks]
          // Sắp xếp theo priority trong plan
          .sort((a, b) => {
            const aData = taskDataMap.get(a.task_id);
            const bData = taskDataMap.get(b.task_id);
            
            const aPriority = aData?.priorityOrder ?? a.priority_order ?? 999;
            const bPriority = bData?.priorityOrder ?? b.priority_order ?? 999;
            
            return aPriority - bPriority;
          })
          // Áp dụng ngày từ plan
          .map(task => {
            const taskData = taskDataMap.get(task.task_id);
            if (!taskData) return task;
            
            return {
              ...task,
              // Đánh dấu là dữ liệu từ plan, không tính lại
              from_plan: true as any,
              // Cập nhật priority_order và ngày từ plan
              priority_order: taskData.priorityOrder,
              start_date: taskData.startDate || task.start_date,
              due_date: taskData.endDate || task.due_date
            };
          });
        
        // Sử dụng TaskOrderStore thay vì local state
        const taskOrderItems = mapTasksToTaskOrderItems(updatedOrderedTasks);
        dispatch(updateTasksWithDates(taskOrderItems));
        
        console.log('Đã áp dụng thứ tự và ngày từ plan:', activePlan.name);
      } else {
        // Nếu không có thông tin tasks trong planData, sử dụng priority_order mặc định
        const defaultOrderedTasks = [...tasks].sort((a, b) => 
          (a.priority_order || 0) - (b.priority_order || 0)
        );
        
        // Cập nhật vào store
        dispatch(updateTasksWithDates(mapTasksToTaskOrderItems(defaultOrderedTasks)));
      }
    } catch (error) {
      console.error('Lỗi khi xử lý dữ liệu planData:', error);
      // Fallback khi có lỗi
      const defaultOrderedTasks = [...tasks].sort((a, b) => 
        (a.priority_order || 0) - (b.priority_order || 0)
      );
      
      // Cập nhật vào store
      dispatch(updateTasksWithDates(mapTasksToTaskOrderItems(defaultOrderedTasks)));
    }
  }, [activePlan, tasks]); // Chỉ phụ thuộc vào activePlan và tasks

  if (isLoading) {
    return <TimelineSkeleton rows={Math.min(tasks.length || 5, 10)} />;
  }

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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  // Hàm xử lý tạo mới plan
  const handleCreatePlan = () => {
      setShowSavePlanDialog(true);
    setPlanName('');
  };

  // Hàm lưu plan - Sử dụng dữ liệu từ taskOrderStore
  const handleSavePlan = () => {
    if (!planName.trim()) {
      toast.error('Tên plan không được để trống');
      return;
    }

    try {
      // Chỉ lấy các task chưa hoàn thành từ taskOrderStore
      const tasksFromStore = orderedTasks.filter(task => {
        // Tìm task tương ứng để kiểm tra status
        const originalTask = tasks.find(t => t.task_id === task.taskId);
        return !originalTask?.status || originalTask.status.toLowerCase() !== 'done';
      });
      
      // Convert tasks to plan data format
      const planTasks = tasksFromStore.map((task, index) => ({
        taskId: task.taskId,
        priorityOrder: index,
        // Bỏ hoàn toàn trường originalPriority vì server không hỗ trợ
        startDate: task.startDate,
        endDate: task.endDate,
        title: task.title
      }));

      console.log('Đang lưu plan với dữ liệu:', planTasks);

      // Create input data - chỉ gửi mảng tasks mà không dùng metadata
      const planInput = {
        projectId: currentProjectId,
        name: planName,
        description: `Plan created on ${new Date().toLocaleDateString()}`,
        planData: {
          tasks: planTasks
          // Không thêm metadata vì không được hỗ trợ trong schema GraphQL
        }
      };

      // Dispatch redux action
      dispatch(createPlan(planInput))
        .unwrap()
        .then((result) => {
          toast.success(`Plan "${planName}" đã được lưu thành công`);
          setShowSavePlanDialog(false);
          setPlanName('');
          // Set created plan as active
          dispatch(setActivePlan(result));
        })
        .catch((error) => {
          console.error('Error details:', error);
          toast.error(`Lỗi khi lưu plan: ${error}`);
        });
    } catch (error) {
      console.error('Error saving plan:', error);
      toast.error('Đã xảy ra lỗi khi lưu plan');
    }
  };

  // Hàm active plan
  const handleSelectPlan = (plan: Plan) => {
    // Reset flag xử lý activePlan để cho phép xử lý plan mới
    hasProcessedActivePlan.current = false;
    
    dispatch(setPlanActive(plan.id))
      .unwrap()
      .then(() => {
        toast.success(`Đã kích hoạt kế hoạch "${plan.name}"`);
      })
      .catch(error => {
        toast.error(`Lỗi khi kích hoạt kế hoạch: ${error}`);
      });
  };

  // Hàm xóa plan
  const handleDeletePlan = () => {
    if (!activePlan) {
      toast.error('Không có kế hoạch nào được chọn');
      return;
    }
    
    dispatch(deletePlan(activePlan.id))
      .unwrap()
      .then(() => {
        toast.success('Đã xóa kế hoạch thành công');
        setShowDeletePlanDialog(false);
      })
      .catch(error => {
        toast.error(`Lỗi khi xóa kế hoạch: ${error}`);
      });
  };

  // Hàm tạo mới plan (không reset thứ tự, chỉ tạo plan mới với thứ tự hiện tại)
  const handleNewPlan = () => {
    // Chỉ mở dialog đặt tên plan
    setPlanName('');
    setShowSavePlanDialog(true);
  };

  // Hàm reset plan - tính toán lại từ đầu
  const handleResetPlan = () => {
    // Reset về sắp xếp mặc định theo priority trước khi tạo plan mới
    if (tasks.length > 0) {
      // Đặt activePlan về null để bật chế độ tính toán lại
      dispatch(setActivePlan(null));
      
      // Reset taskOrderStore
      dispatch(resetTaskOrder());
      
      // Reset flag xử lý activePlan
      hasProcessedActivePlan.current = false;

      // Đánh dấu tất cả các task cần tính toán lại ngày
      const tasksNeedRecalculation = tasks.map(task => {
        const updatedTask = {
          ...task,
          // Đánh dấu tất cả task cần tính toán lại
          force_recalculate: true,
          // Xóa ngày cũ để tính toán lại hoàn toàn
          start_date: undefined,
          due_date: undefined,
        } as any;
        // Bỏ from_plan flag (nếu có) 
        updatedTask.from_plan = false;
        return updatedTask;
      });
      
      // Sắp xếp và tính toán lại tất cả các task
      const newTasks = processTasks(tasksNeedRecalculation);
      
      // Cập nhật vào store
      dispatch(updateTasksWithDates(mapTasksToTaskOrderItems(newTasks)));
      
      toast.success('Đã tính toán lại tất cả task và reset về mặc định');
      console.log('Đã tính toán lại tất cả task và reset về mặc định');
    }
  };

  // useEffect để đồng bộ scroll ngang giữa grid và header ngày
  useEffect(() => {
    const ganttContent = ganttContentRef.current;
    const dateHeaders = dateHeadersRef.current;
    
    if (!ganttContent || !dateHeaders) return;
    
    const syncScrollFromGridToHeader = () => {
      if (dateHeaders) {
        dateHeaders.scrollLeft = ganttContent.scrollLeft;
      }
    };
    
    ganttContent.addEventListener('scroll', syncScrollFromGridToHeader);
    
    // Gọi hàm này một lần ngay sau khi component mount để đồng bộ ban đầu
    syncScrollFromGridToHeader();
    
    return () => {
      ganttContent.removeEventListener('scroll', syncScrollFromGridToHeader);
    };
  }, []);

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
    <div className="bg-white rounded-lg p-2">
      {isLoading ? (
        <TimelineSkeleton />
      ) : (
        <div className="flex flex-col">
          <div className="grid grid-cols-12 gap-4 p-2">
            {/* Controls row */}
            <div className="col-span-12 flex flex-col md:flex-row items-start md:items-center justify-between space-y-2 md:space-y-0 mb-4">
              {/* Left controls */}
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <div className="flex space-x-2">
                  <button 
                    className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                      viewMode === 'project' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    onClick={() => setViewMode('project')}
                  >
                    Tất cả
                  </button>
                  <button 
                    className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                      viewMode === 'user' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    onClick={() => {
                      setViewMode('user');
                      // Nếu chưa chọn user, chọn user đầu tiên
                      if (!selectedUserId && allMembers.length > 0) {
                        setSelectedUserId(allMembers[0].id);
                      }
                    }}
                  >
                    Theo người
                  </button>
                </div>
                
                {/* Dropdown chọn user khi ở chế độ xem theo người */}
                {viewMode === 'user' && (
                  <div className="relative inline-block">
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="block w-full pl-3 pr-10 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-md"
                      aria-label="Chọn người dùng"
                      title="Chọn người dùng để lọc các công việc"
                    >
                      {allMembers.map(member => (
                        <option key={member.id} value={member.id}>{member.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              
              {/* Right controls */}
              <div className="flex space-x-2">
                {/* Date range controls */}
                <div className="flex items-center space-x-2">
                  <input
                    type="date"
                    value={dateRange.startDate.toISOString().split('T')[0]}
                    onChange={handleStartDateChange}
                    className="block w-36 px-3 py-1.5 text-sm border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label="Ngày bắt đầu"
                    title="Chọn ngày bắt đầu để hiển thị"
                  />
                  <span className="text-gray-500">-</span>
                  <input
                    type="date"
                    value={dateRange.endDate.toISOString().split('T')[0]}
                    onChange={handleEndDateChange}
                    className="block w-36 px-3 py-1.5 text-sm border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label="Ngày kết thúc"
                    title="Chọn ngày kết thúc để hiển thị"
                  />
                </div>
              </div>
            </div>
            
            {/* Plans controls row */}
            <div className="col-span-12 flex flex-wrap items-center justify-between space-y-2 mb-4">
              <div className="flex flex-1 flex-wrap items-center space-x-2">
                <span className="text-sm font-medium text-gray-700">Kế hoạch:</span>
                
                {/* Plan dropdown */}
                <div className="relative inline-block min-w-48">
                  <div className="flex items-center space-x-2">
                    <select
                      value={activePlan?.id || ''}
                      onChange={(e) => {
                        const selectedPlanId = e.target.value;
                        if (selectedPlanId) {
                          const selectedPlan = plans.find(p => p.id === selectedPlanId);
                          if (selectedPlan) {
                            handleSelectPlan(selectedPlan);
                          }
                        } else {
                          // Nếu chọn option đầu tiên (không có plan)
                          dispatch(setActivePlan(null));
                        }
                      }}
                      className="block w-full pl-3 pr-10 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-md"
                      aria-label="Chọn kế hoạch"
                      title="Chọn kế hoạch để hiển thị"
                    >
                      <option value="">-- Chọn kế hoạch --</option>
                      {plans.map(plan => (
                        <option key={plan.id} value={plan.id}>{plan.name}</option>
                      ))}
                    </select>
                    {plansLoading && (
                      <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                    )}
                  </div>
                </div>
                
                {/* Buttons for plan actions */}
                <div className="flex space-x-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNewPlan}
                    className="whitespace-nowrap"
                  >
                    <PlusIcon className="h-4 w-4 mr-1" />
                    <span>Mới</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetPlan}
                    className="whitespace-nowrap"
                  >
                    <ArrowPathIcon className="h-4 w-4 mr-1" />
                    <span>Reset</span>
                  </Button>
                  
                  {activePlan && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeletePlanDialog(true)}
                      className="text-red-500 hover:text-red-700 whitespace-nowrap"
                    >
                      <TrashIcon className="h-4 w-4 mr-1" />
                      <span>Xóa</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Priority Task List */}
            <div className="col-span-12 md:col-span-3 border border-slate-200 rounded-lg">
              <PriorityTaskList 
                tasks={tasks} 
                onTaskClick={onTaskClick}
                onTaskReorder={handleTaskReorder}
              />
            </div>
            
            {/* Task Gantt Chart */}
            <div className="col-span-12 md:col-span-9 h-[70vh] border border-slate-200 rounded-lg overflow-hidden">
              <div ref={containerRef} className="h-full flex flex-col">
                {/* Date Headers */}
                <div 
                  ref={dateHeadersRef}
                  className="flex-none overflow-x-hidden"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${days.length}, ${dayWidth}px)`,
                    position: 'relative'
                  }}
                >
                  {/* Month headers */}
                  <div className="col-span-full grid" style={{ gridTemplateColumns: `repeat(${days.length}, ${dayWidth}px)` }}>
                    {days.map((day, index) => {
                      // Show month only on the first day of month or first day in range
                      const showMonth = index === 0 || day.getDate() === 1;
                      
                      if (showMonth) {
                        const monthName = day.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
                        // Count how many days until next month or end
                        let daysInMonth = 0;
                        for (let i = index; i < days.length; i++) {
                          const nextDay = days[i];
                          if (i > index && nextDay.getDate() === 1) break;
                          daysInMonth++;
                        }
                        
                        return (
                          <div 
                            key={`month-${index}`}
                            className="h-8 flex items-center justify-center font-medium text-slate-600 text-sm border-b border-slate-200"
                            style={{ 
                              gridColumn: `span ${daysInMonth}`,
                              borderRight: '1px solid #e2e8f0'
                            }}
                          >
                            {monthName}
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>

                  {/* Day headers */}
                  {days.map((day, index) => {
                    const isToday = isSameDay(day, today);
                    const isWeekendDay = isWeekend(day);
                    
                    return (
                      <div 
                        key={`day-${index}`}
                        className={`h-8 flex flex-col items-center justify-center text-sm border-r border-slate-200 
                          ${isToday ? 'bg-blue-50 text-blue-600' : ''}
                          ${isWeekendDay ? 'bg-slate-50 text-slate-400' : 'text-slate-600'}
                        `}
                      >
                        <span className="text-xs">
                          {day.toLocaleDateString('vi-VN', { weekday: 'short' })}
                        </span>
                        <span className={`font-medium ${isToday ? 'text-blue-700' : ''}`}>
                          {day.getDate()}
                        </span>
                      </div>
                    );
                  })}
                </div>
                
                {/* Gantt Content */}
                <div 
                  ref={ganttContentRef}
                  className="flex-1 overflow-auto"
                >
                  <div className="relative" style={{ height: rowHeight * Math.max(10, orderedTasks.length) }}>
                    {/* Today indicator */}
                    {days.findIndex(day => isSameDay(day, today)) !== -1 && (
                      <div 
                        className="absolute top-0 bottom-0 w-px bg-blue-500 z-20"
                        style={{ 
                          left: `${days.findIndex(day => isSameDay(day, today)) * dayWidth + dayWidth / 2}px`,
                          height: '100%'
                        }}
                      />
                    )}
                    
                    {/* Background */}
                    <div 
                      className="absolute inset-0 z-0"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${days.length}, ${dayWidth}px)`,
                        gridAutoRows: rowHeight
                      }}
                    >
                      {days.map((day, dayIndex) => (
                        <div 
                          key={`bg-${dayIndex}`}
                          className={`
                            ${isWeekend(day) ? 'bg-slate-50' : ''}
                            ${isSameDay(day, today) ? 'bg-blue-50' : ''}
                            border-r border-slate-200
                          `}
                        />
                      ))}
                    </div>
                    
                    {/* Grid lines on top of the background */}
                    <div 
                      className="grid relative"
                      style={{
                        gridTemplateColumns: `repeat(${days.length}, ${dayWidth}px)`,
                        gridTemplateRows: `repeat(${Math.max(10, orderedTasks.length)}, ${rowHeight}px)`,
                        gridAutoFlow: 'row',
                        height: '100%',
                        zIndex: 10
                      }}
                    >
                      {Array.from({ length: days.length * Math.max(10, orderedTasks.length) }).map((_, index) => (
                        <div
                          key={`grid-cell-${index}`}
                          className="border-r border-b border-slate-200 relative"
                        />
                      ))}
                  </div>

                  {/* Task Bars */}
                  {filteredTasks
                    .map((task: Task, rowIndex: number) => {
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

                    // Vị trí theo thứ tự trong filteredTasks, giữ nguyên theo thứ tự row
                    const taskPosition = filteredTasks.findIndex(t => t.task_id === task.task_id);

                    return (
                      <div
                        key={task.task_id}
                        style={{
                          position: 'absolute',
                          left: `${startDayIndex * dayWidth}px`,
                          top: `${taskPosition * rowHeight}px`,
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
          </div>
          
          {/* Dialog Tạo/Lưu Plan */}
          {showSavePlanDialog && (
            <Dialog
              open={showSavePlanDialog}
              onClose={() => setShowSavePlanDialog(false)}
              title="Lưu kế hoạch mới"
              className="w-96"
            >
              <div className="mt-4">
                <label htmlFor="planName" className="block text-sm font-medium text-gray-700 mb-1">
                  Tên kế hoạch
                </label>
                <input
                  id="planName"
                  type="text"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="Nhập tên kế hoạch"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setShowSavePlanDialog(false)}
                  className="px-4 py-2 border rounded-md text-sm"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSavePlan}
                  disabled={!planName.trim()}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm disabled:opacity-50"
                >
                  Lưu kế hoạch
                </button>
              </div>
            </Dialog>
          )}
          
          {/* Dialog Xóa Plan */}
          {showDeletePlanDialog && (
            <Dialog
              open={showDeletePlanDialog}
              onClose={() => setShowDeletePlanDialog(false)}
              title="Xóa kế hoạch"
              className="w-96"
            >
              <div className="mt-4">
                <p className="text-sm text-gray-600">
                  Bạn có chắc chắn muốn xóa kế hoạch "{activePlan?.name}" không?
                </p>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setShowDeletePlanDialog(false)}
                  className="px-4 py-2 border rounded-md text-sm"
                >
                  Hủy
                </button>
                <button
                  onClick={handleDeletePlan}
                  className="px-4 py-2 bg-red-500 text-white rounded-md text-sm"
                >
                  Xóa kế hoạch
                </button>
              </div>
            </Dialog>
          )}
        </div>
      )}
    </div>
  );
}
