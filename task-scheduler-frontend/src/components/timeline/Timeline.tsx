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
import { useProject } from '@/hooks/useProject';
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
import { Dialog } from '@/components/ui/Dialog';
import { Plan, PlanData, PlanTaskData, CreatePlanInput, CreatePlanDataInput, CreatePlanTaskDataInput } from '@/types/plan';
import { ChevronDownIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

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
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [planName, setPlanName] = useState<string>('');
  const [showSavePlanDialog, setShowSavePlanDialog] = useState(false);
  const [showDeletePlanDialog, setShowDeletePlanDialog] = useState(false);
  const dispatch = useAppDispatch();
  
  // Lấy data từ Redux store
  const plans = useAppSelector(selectPlans);
  const activePlan = useAppSelector(selectActivePlan);
  const plansLoading = useAppSelector(selectPlansLoading);

  // Có thể sử dụng Redux store để lấy danh sách tasks và users
  // const { tasks: reduxTasks } = useAppSelector(state => state.tasks);
  // const { users: reduxUsers } = useAppSelector(state => state.users);
  
  // Sử dụng tasks từ props vì có thể đã được lọc hoặc xử lý trước đó
  
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

  // Lấy projectId từ tasks
  const currentProjectId = useMemo(() => {
    if (tasks && tasks.length > 0 && tasks[0].projectId) {
      return tasks[0].projectId;
    }
    return '';
  }, [tasks]);

  // Sử dụng useProject hook để lấy thông tin chi tiết của project
  const { data: projectData } = useProject(currentProjectId);

  // Lấy danh sách project members từ useProject hook
  const projectMembers = useMemo(() => {
    console.log("Project data từ useProject:", projectData);
    
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

  // Log để debug
  useEffect(() => {
    console.log("ProjectID:", currentProjectId);
    console.log("Project Members:", projectMembers);
  }, [currentProjectId, projectMembers]);

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

  // Gộp cả projectMembers và taskAssignees để hiển thị đầy đủ
  const allMembers = useMemo(() => {
    // Tạo Map để lưu trữ members và loại bỏ trùng lặp
    const memberMap = new Map();
    
    // Nếu có thông tin members từ useProject, ưu tiên sử dụng
    if (projectMembers.length > 0) {
      projectMembers.forEach(member => {
        memberMap.set(member.id, member);
      });
    }
    
    // Nếu không, kiểm tra từ tasks
    else if (tasks.length > 0) {
      // Lấy unique assignees từ tasks
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
    }
    
    // Sử dụng users từ props khi không có dữ liệu khác
    if (memberMap.size === 0 && users && users.length > 0) {
      users.forEach(user => {
        memberMap.set(user.id, {
          id: user.id,
          name: user.name,
          avatarUrl: user.avatarUrl,
          role: user.role
        });
      });
    }
    
    // Chuyển map thành array và sắp xếp theo tên
    return Array.from(memberMap.values())
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [projectMembers, tasks, users]);

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

  // Đưa hàm processTasks vào useCallback để tránh tạo instance mới mỗi khi render
  const processTasks = useCallback((inputTasks: Task[], keepOrder: boolean = false): Task[] => {
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
  }, [getCurrentDateVN, activePlan]); // Thêm các dependencies thực sự cần thiết

  // Thêm useEffect chạy khi component mount - Chỉ chạy một lần
  useEffect(() => {
    if (tasks.length > 0) {
      // Xử lý tasks ban đầu khi component mount
      setOrderedTasks(processTasks(tasks));
    }
  }, [processTasks, tasks]); // Thêm processTasks vào dependency để useEffect biết khi nào cần chạy lại

  // Sửa useEffect theo dõi thay đổi của orderedTasks
  useEffect(() => {
    // Chỉ log khi cần thiết, tránh log quá nhiều
    if (viewMode === 'project' && orderedTasks.length > 0) {
      // Bỏ log này để tránh spam console - đây có thể là nguyên nhân chính gây loop
      // console.log('Cập nhật thứ tự hiển thị task bars sau khi drag & drop:', 
      //  orderedTasks.filter(task => task.status !== 'done')
      //    .map(t => `${t.task_id}: ${t.title} (${t.priority})`));
    }
  }, [orderedTasks, viewMode]);

  // Thêm useRef để theo dõi thứ tự task trước đó
  const prevTasksRef = useRef<string>('');
  
  // Tạo một state để theo dõi xem có đang trong quá trình drag & drop hay không
  const [isDragging, setIsDragging] = useState(false);

  // Điều chỉnh onDragStart để đánh dấu bắt đầu kéo thả
  const onDragStart = useCallback(() => {
    setIsDragging(true);
    if (window.navigator.vibrate) {
      window.navigator.vibrate(100);
    }
  }, []);

  // Điều chỉnh onDragEnd để đánh dấu kết thúc kéo thả và không gọi API updateTaskPriority không cần thiết
  const onDragEnd = useCallback(async (event: DragEndEvent) => {
    // Đánh dấu kết thúc kéo thả
    setIsDragging(false);
    
    const { active, over } = event;
    
    if (!over) return;
    
    const activeTaskId = active.id as string;
    const overTaskId = over.id as string;
    
    if (activeTaskId === overTaskId) return;
    
    // Tìm vị trí mới trong danh sách
    const taskListIds = orderedTasks.map(task => task.task_id);
    const oldIndex = taskListIds.indexOf(activeTaskId);
    const newIndex = taskListIds.indexOf(overTaskId);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    // Tạo mảng mới theo thứ tự ưu tiên
    const newTasksOrder = arrayMove(orderedTasks, oldIndex, newIndex);
    
    // Đánh dấu TẤT CẢ các task đều cần tính toán lại sau khi thay đổi thứ tự
    const tasksToRecalculate = newTasksOrder.map((task, index) => {
      return {
        ...task,
        priority_order: index + 1,
        // Sau khi reorder, bỏ qua start_date cũ để tính toán lại từ đầu
        start_date: undefined,
        due_date: undefined,
        // Đánh dấu TẤT CẢ các task đều cần tính toán lại
        force_recalculate: true
      };
    });
    
    console.log('Thứ tự task mới sau khi kéo thả:', tasksToRecalculate.map((task, idx) => 
      `${task.title} (${task.priority}) - index: ${idx + 1}`
    ));
    
    // Tính toán lại task schedule dựa trên thứ tự mới
    // Sử dụng keepOrder=true để giữ nguyên thứ tự kéo thả, nhưng tính lại tất cả các ngày
    const processedTasks = processTasks(tasksToRecalculate, true);
    
    // Cập nhật UI ngay lập tức (optimistic update)
    setOrderedTasks(processedTasks);
    
    // Không cần gọi API updateTaskPriority sau mỗi lần kéo thả
  }, [orderedTasks, processTasks]);

  // Hàm riêng cho PriorityTaskList để xử lý kéo thả
  const handleTaskReorder = useCallback((taskId: string, newIndex: number) => {
    const oldIndex = orderedTasks.findIndex((task) => task.task_id === taskId);

    if (oldIndex !== -1 && newIndex !== -1) {
      // Tạo mảng tasks mới sau khi kéo thả
      const reorderedTasks = arrayMove(orderedTasks, oldIndex, newIndex);
      
      // Đánh dấu TẤT CẢ các task đều cần tính toán lại sau khi thay đổi thứ tự
      const tasksToRecalculate = reorderedTasks.map((task, index) => {
        return {
          ...task,
          priority_order: index + 1,
          // Sau khi reorder, bỏ qua start_date cũ để tính toán lại từ đầu
          start_date: undefined,
          due_date: undefined,
          // Đánh dấu TẤT CẢ các task đều cần tính toán lại
          force_recalculate: true
        };
      });
      
      // Ghi lại các task order mới cho debug
      console.log('Thứ tự task mới sau khi kéo thả:', tasksToRecalculate.map((task, idx) => 
        `${task.title} (${task.priority}) - index: ${idx + 1}`
      ));
      
      // Tính toán lại task schedule dựa trên thứ tự mới
      // Sử dụng keepOrder=true để giữ nguyên thứ tự kéo thả, nhưng tính lại tất cả các ngày
      const processedTasks = processTasks(tasksToRecalculate, true);
      
      // Cập nhật UI ngay lập tức với các task đã được tính toán lại
      setOrderedTasks(processedTasks);
      
      // Không cần gọi API updateTaskPriority sau mỗi lần kéo thả
    }
  }, [orderedTasks, processTasks]);
  
  // Sửa lại useEffect theo dõi tasks thay đổi để tránh reset thứ tự khi đang kéo thả
  useEffect(() => {
    if (!tasks || tasks.length === 0) return;
    
    // Nếu đang trong quá trình kéo thả, không xử lý tasks mới
    if (isDragging) return;
    
    // Thêm điều kiện để tránh xử lý quá nhiều lần - chỉ so sánh ID, status và title
    const tasksJson = JSON.stringify(tasks.map(t => ({ 
      id: t.task_id, 
      status: t.status
    })));
    
    // Nếu tasks chưa thay đổi, không cần xử lý lại
    if (prevTasksRef.current === tasksJson) return;
    
    console.log('Xử lý tasks do nguồn dữ liệu thay đổi');
    
    // Kiểm tra nếu đã có tasks được sắp xếp trước đó
    if (orderedTasks.length > 0) {
      // Xây dựng map từ task ID đến index để duy trì thứ tự
      const existingTaskIds = new Set(orderedTasks.map(task => task.task_id));
      const taskOrderMap = new Map(
        orderedTasks.map((task, index) => [task.task_id, index])
      );
      
      // Tách tasks thành 2 nhóm: tasks hiện tại và tasks mới
      const existingTasks = tasks.filter(task => existingTaskIds.has(task.task_id));
      const newTasks = tasks.filter(task => !existingTaskIds.has(task.task_id));
      
      // Áp dụng thứ tự cũ lên tasks hiện tại
      const sortedExistingTasks = [...existingTasks].sort((a, b) => {
        const aOrder = taskOrderMap.get(a.task_id) ?? 999;
        const bOrder = taskOrderMap.get(b.task_id) ?? 999;
        return aOrder - bOrder;
      });
      
      // Xử lý tasks mới (nếu có) và thêm vào cuối
      const allTasks = [...sortedExistingTasks, ...newTasks];
      
      // Luôn sử dụng keepOrder=true để duy trì thứ tự hiện tại
      setOrderedTasks(processTasks(allTasks, true));
    } else {
      // Nếu chưa có tasks được sắp xếp, xử lý bình thường
      setOrderedTasks(processTasks(tasks));
    }
    
    // Cập nhật giá trị tham chiếu
    prevTasksRef.current = tasksJson;
  }, [tasks, processTasks, orderedTasks, isDragging]);

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

  // Load plans khi component mount và projectId thay đổi
  useEffect(() => {
    if (currentProjectId) {
      dispatch(fetchProjectPlans(currentProjectId));
      dispatch(fetchLatestProjectPlan(currentProjectId));
    }
  }, [dispatch, currentProjectId]);

  // Cập nhật orderedTasks khi activePlan thay đổi
  useEffect(() => {
    if (tasks.length > 0 && activePlan) {
      // Nếu có activePlan, sử dụng keepOrder=false để sắp xếp theo priority_order trong plan
      const processed = processTasks(tasks, false);
      setOrderedTasks(processed);
      console.log("Đã sắp xếp tasks theo activePlan.");
    }
  }, [activePlan, tasks, processTasks]);

  // Hàm xử lý tạo mới plan
  const handleCreatePlan = () => {
      setShowSavePlanDialog(true);
    setPlanName('');
  };

  // Hàm lưu plan
  const handleSavePlan = () => {
    if (!planName.trim()) {
      toast.error('Vui lòng nhập tên cho kế hoạch');
      return;
    }
    
    if (!currentProjectId) {
      toast.error('Không tìm thấy project ID');
      return;
    }
    
    // Tạo dữ liệu cho plan từ orderedTasks hiện tại
    const planTasks: CreatePlanTaskDataInput[] = orderedTasks
      .filter(task => task.id || task.task_id) // Lọc bỏ các task không có id
      .map((task, index) => ({
        task_id: task.id || task.task_id,
        priority_order: index,
        original_priority: task.priority,
        start_date: task.start_date,
        end_date: task.due_date
      }));
    
    const planData: CreatePlanDataInput = {
      tasks: planTasks,
      metadata: {
        last_sorted_date: new Date().toISOString(),
        sort_criteria: 'priority_and_custom'
      }
    };
    
    const input: CreatePlanInput = {
      project_id: currentProjectId,
      name: planName,
      description: `Plan created at ${new Date().toLocaleString()}`,
      plan_data: planData
    };
    
    dispatch(createPlan(input))
      .unwrap()
      .then(() => {
        toast.success('Đã lưu kế hoạch thành công');
        setShowSavePlanDialog(false);
      })
      .catch(error => {
        toast.error(`Lỗi khi lưu kế hoạch: ${error}`);
      });
  };

  // Hàm active plan
  const handleSelectPlan = (plan: Plan) => {
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

  // Hàm tạo mới plan (reset về mặc định)
  const handleNewPlan = () => {
    // Reset về sắp xếp mặc định theo priority trước khi tạo plan mới
    if (tasks.length > 0) {
      // Đặt activePlan về null tạm thời để process tasks sắp xếp theo priority
      dispatch(setActivePlan(null));
      // Các task sẽ được sắp xếp lại theo priority trong useEffect
    }
    
    setPlanName('');
    setShowSavePlanDialog(true);
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
    <div className="bg-white rounded-lg h-full p-2">
      {isLoading ? (
        <TimelineSkeleton />
      ) : (
        <div className="flex flex-col h-full">
          {/* Toolbar */}
          <div className="flex justify-between mb-4 border-b pb-2">
            <div className="flex gap-2 items-center">
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
            
            <div className="h-6 w-px bg-slate-200 mx-2"></div>
            
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
          
          {/* Phần quản lý Plan */}
            <div className="flex gap-2 items-center">
              {/* Dropdown chọn Plan - Sử dụng select thay cho DropdownMenu */}
              <select 
                className="px-3 py-1 border rounded text-sm"
                value={activePlan?.id || ''}
                onChange={(e) => {
                  const selectedPlan = plans.find((p: Plan) => p.id === e.target.value);
                  if (selectedPlan) {
                    handleSelectPlan(selectedPlan);
                  }
                }}
                title="Chọn kế hoạch"
              >
                <option value="" disabled>Chọn kế hoạch</option>
                {plans.map((plan: Plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
              
              {/* Button tạo Plan mới */}
            <button
                onClick={handleNewPlan} 
                className="flex items-center gap-1 px-3 py-1 rounded text-sm bg-slate-100 hover:bg-slate-200"
              title="Tạo kế hoạch mới"
            >
                <PlusIcon className="h-4 w-4" />
              New Plan
            </button>
              
              {/* Button lưu Plan */}
            <button
                onClick={handleSavePlan}
                className="flex items-center gap-1 px-3 py-1 rounded text-sm bg-blue-100 hover:bg-blue-200"
              title="Lưu kế hoạch hiện tại"
            >
                <span>Lưu kế hoạch</span>
            </button>
              
              {/* Button xóa Plan */}
            {activePlan && (
              <button
                  onClick={() => setShowDeletePlanDialog(true)} 
                  className="flex items-center gap-1 px-2 py-1 rounded text-sm bg-red-100 hover:bg-red-200"
                title="Xóa kế hoạch hiện tại"
              >
                  <TrashIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Nội dung - Phần này sẽ có các phần scroll riêng biệt */}
        <div className="flex gap-4 h-full overflow-hidden">
          {/* Sidebar - tasks */}
          <div className="w-80 flex-shrink-0 overflow-y-auto max-h-[calc(100vh-200px)] border-r border-slate-200">
            {viewMode === 'project' ? (
              <PriorityTaskList 
                tasks={orderedTasks} 
                onTaskClick={onTaskClick} 
                onTaskReorder={handleTaskReorder}
              />
            ) : (
              <>
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

          {/* Gantt Chart - Chỉ scroll phần này */}
          <div className="flex-1 overflow-hidden" ref={containerRef}>
            {/* Phần có thể scroll */}
            <div 
              className="overflow-auto"
              ref={ganttContentRef}
              style={{ 
                height: `calc(100vh - 260px)`,
                width: '100%'
              }}
            >
              {/* Date Headers - Sẽ scroll theo khi scroll ngang */}
              <div className="bg-white border-b border-slate-200 z-10">
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
                        <div className="flex flex-col justify-center items-center h-full">
                          <div className="text-xs text-slate-700 font-medium text-center">
                            {day.toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit'
                            })}
                          </div>
                          <div className="text-[0.6rem] text-slate-500 text-center">
                            {day.toLocaleDateString('vi-VN', { weekday: 'short' })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                style={{ 
                  width: `${days.length * dayWidth}px`,
                    minHeight: `${Math.max(10, orderedTasks.length) * rowHeight + 40}px`
                }}
                className="relative bg-white"
              >
                {/* Grid Container */}
                <div className="relative inset-0">
                  {/* Grid Background */}
                  <div className="relative">
                    {/* Columns for days - highlight background first */}
                    <div 
                      className="absolute inset-0 grid"
                      style={{
                        gridTemplateColumns: `repeat(${days.length}, ${dayWidth}px)`,
                          height: `${Math.max(10, orderedTasks.length) * rowHeight}px`,
                          minHeight: `${10 * rowHeight}px`,
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
                          gridTemplateRows: `repeat(${Math.max(10, orderedTasks.length)}, ${rowHeight}px)`,
                        gridAutoFlow: 'row',
                          height: `${Math.max(10, orderedTasks.length) * rowHeight}px`,
                          minHeight: `${10 * rowHeight}px`,
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
