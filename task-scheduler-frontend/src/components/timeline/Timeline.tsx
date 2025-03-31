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
  createPlan,
  updatePlan,
  deletePlan,
  setActivePlan,
  selectPlans,
  selectActivePlan,
  selectPlansLoading,
  setPlanActive
} from '@/redux/features/plansSlice';
import { Dialog } from '@/components/ui/Dialog';
import { Plan, PlanData, PlanTaskData, CreatePlanInput, CreatePlanDataInput, CreatePlanTaskDataInput } from '@/types/plan';
import { ChevronDownIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { 
  updateTaskOrder, 
  updateTasksWithDates,
  initializeFromTasks,
  updateCalculatedDates,
  selectOrderedTasks,
  selectCalculatedTaskDates,
  selectIsPlanLoaded,
  updateAutoSort,
  selectAutoSort
} from '@/redux/features/taskOrderStore';
import { convertTaskOrderToTask, isWeekend, getNextWorkDay, findNextAvailableStartDate, calculateTaskSchedule, WorkSchedule, processTasksAndUpdateStore, processTasksBasedOnPlan } from '@/utils/taskScheduler';
import { useParams } from 'next/navigation';
import { ArrowUpDown } from 'lucide-react';
import { batch } from 'react-redux';

interface TimelineProps {
  isLoading?: boolean;
  onTaskClick?: (taskId: string) => void;
  users?: AssignedUser[];
}

type ViewMode = 'project' | 'user';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

export function Timeline({ isLoading = false, onTaskClick, users }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttContentRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [planName, setPlanName] = useState<string>('');
  const [showSavePlanDialog, setShowSavePlanDialog] = useState(false);
  const [showDeletePlanDialog, setShowDeletePlanDialog] = useState(false);
  const dispatch = useAppDispatch();
  
  // Thêm useRef để theo dõi thứ tự task trước đó
  const prevTasksRef = useRef<string>('');
  
  // Tạo một state để theo dõi xem có đang trong quá trình drag & drop hay không
  const [isDragging, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('project');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  
  // Lấy redux store tasks
  const { tasks, loading: tasksLoading } = useAppSelector(state => state.tasks);
  
  // Lấy data từ Redux store (KHÔNG gọi API lại)
  const plans = useAppSelector(selectPlans);
  const activePlan = useAppSelector(selectActivePlan);
  const plansLoading = useAppSelector(selectPlansLoading);

  // Lấy thông tin từ taskOrderStore
  const orderedTaskItems = useAppSelector(selectOrderedTasks);
  const calculatedTaskDates = useAppSelector(selectCalculatedTaskDates);
  console.log('🔄 Timeline re-render, calculatedTaskDates changed');
  const isPlanLoaded = useAppSelector(selectIsPlanLoaded);

  // Tạo ref để theo dõi trạng thái đã khởi tạo từ localStorage và tasks
  const initializedFromLocalStorage = useRef(false);
  const tasksInitialized = useRef(false);

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

  const reorderTasks = useReorderTasks();

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

  // Đưa hàm processTasks vào useCallback để tránh tạo instance mới mỗi khi render
  const processTasks = useCallback((inputTasks: Task[], keepOrder: boolean = false): Task[] => {
    console.log('Chuyển tiếp xử lý đến processTasksAndUpdateStore:', inputTasks.length, 'keepOrder:', keepOrder);
    return processTasksAndUpdateStore(inputTasks, keepOrder, dispatch);
  }, [dispatch]); // Chỉ phụ thuộc vào dispatch

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

  // Lấy thông tin dự án hiện tại từ URL
  const params = useParams();
  const currentProjectId = params ? (params.id as string) : '';
  
  // Lấy thông tin các thành viên từ tasks và users (props)
  const allMembers = useMemo(() => {
    // Lấy unique assignees từ tasks
    const assigneesMap = new Map();
    
    tasks.filter(task => task.assignee && task.assignee.userId)
      .forEach(task => {
        const assignee = task.assignee!;
        if (!assigneesMap.has(assignee.userId)) {
          assigneesMap.set(assignee.userId, {
            id: assignee.userId,
            name: assignee.username || 'Không có tên',
            avatarUrl: assignee.avatarUrl,
            role: 'member'
          });
        }
      });
    
    // Nếu có users từ props, thêm vào danh sách
    if (users && users.length > 0) {
      users.forEach(user => {
        if (!assigneesMap.has(user.id)) {
          assigneesMap.set(user.id, {
            id: user.id,
            name: user.name,
            avatarUrl: user.avatarUrl,
            role: user.role
          });
        }
      });
    }
    
    return Array.from(assigneesMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, users]);

  // useEffect để xử lý fetch và process tasks
  useEffect(() => {
    console.log('Bắt đầu xử lý dữ liệu tasks và plans');
    
    const hasTasks = tasks && tasks.length > 0;
    const hasPlans = plans && plans.length > 0;
    const hasActivePlan = activePlan !== undefined;
    
    console.log('Trạng thái dữ liệu:', { hasTasks, hasPlans, hasActivePlan });
    
    if (hasTasks) {
      // Xem xét tạo chuỗi JSON của tasks để kiểm tra thay đổi thực sự
      const tasksJson = JSON.stringify(tasks.map(task => task.task_id));
      const prevTasksJson = prevTasksRef.current;
      
      // Nếu danh sách tasks không thay đổi, không làm gì cả
      if (prevTasksJson === tasksJson) {
        console.log('Danh sách tasks không thay đổi, bỏ qua xử lý');
        return;
      }
      
      // Cập nhật prevTasksRef.current để tránh xử lý lặp
      console.log('Cập nhật prevTasksRef.current để tránh xử lý lặp');
      prevTasksRef.current = tasksJson;
      
      if (hasActivePlan) {
        console.log('Xử lý', tasks.length, 'tasks dựa trên plan: Có active plan');
        console.log('Đã có active plan, dữ liệu sẽ được tự động cập nhật thông qua reducer');
        
        // QUAN TRỌNG: Khi có active plan, KHÔNG gọi initializeFromTasks hay processTasksAndUpdateStore
        // vì dữ liệu đã được cập nhật thông qua extraReducers
        // Và để tránh duplicate tasks
      } else {
        console.log('Xử lý', tasks.length, 'tasks không có plan');
        // Chỉ gọi processTasksAndUpdateStore khi không có active plan
        processTasksAndUpdateStore(tasks, false, dispatch);
      }
    }
  }, [tasks, dispatch, activePlan, plans]);

  // Sửa useEffect theo dõi thay đổi của tasks
  useEffect(() => {
    // Chỉ log khi cần thiết, tránh log quá nhiều
    if (viewMode === 'project' && orderedTaskItems.length > 0) {
      // Không log gì ở đây để tránh render quá nhiều
    }
  }, [orderedTaskItems, viewMode]); // Giữ nguyên dependency để cập nhật khi cần
  
  // Sửa lại useEffect theo dõi tasks thay đổi để tránh reset thứ tự khi đang kéo thả
  // Cũng cần tối ưu để tránh render quá nhiều
  useEffect(() => {
    // Kiểm tra nhanh để tránh xử lý không cần thiết
    if (!tasks || tasks.length === 0) return;
    if (isDragging) return; // Không xử lý khi đang kéo thả
    if (tasksInitialized.current) return; // Không xử lý nếu đã initialize từ useEffect đầu tiên
    
    // Thêm điều kiện để tránh xử lý quá nhiều lần - chỉ so sánh ID, status và title
    const tasksJson = JSON.stringify(tasks.map(t => ({ 
      id: t.task_id, 
      status: t.status
    })));
    
    // Nếu tasks chưa thay đổi, không cần xử lý lại
    if (prevTasksRef.current === tasksJson) return;
    
    console.log('Cập nhật prevTasksRef.current để tránh xử lý lặp');
    prevTasksRef.current = tasksJson;
    
    // Đặt một timeout để tránh xử lý quá nhanh và gây ra render lặp
    // Chỉ xử lý sau 100ms kể từ lần thay đổi cuối cùng
    const timerId = setTimeout(() => {
      console.log('Xử lý tasks do nguồn dữ liệu thay đổi');
      
      // Nếu có active plan, không xử lý ở đây, để cho useEffect dưới xử lý
      if (activePlan) {
        console.log('Có active plan, bỏ qua xử lý tasks trong useEffect này');
        return;
      }
      
      // Kiểm tra nếu đã có tasks được sắp xếp trước đó
      if (orderedTaskItems.length > 0) {
        // Xây dựng map từ task ID đến index để duy trì thứ tự
        const tasksFromStore = orderedTaskItems.map(item => ({
          task_id: item.taskId,
          priority_order: item.priorityOrder
        }));
        
        const existingTaskIds = new Set(tasksFromStore.map(task => task.task_id));
        const taskOrderMap = new Map(
          tasksFromStore.map((task, index) => [task.task_id, index])
        );
        
        // Tách tasks thành 2 nhóm: tasks hiện tại và tasks mới
        const existingTasks = tasks.filter(task => existingTaskIds.has(task.task_id));
        const newTasks = tasks.filter(task => !existingTaskIds.has(task.task_id));
        
        // Áp dụng thứ tự cũ lên tasks hiện tại
        const sortedExistingTasks = [...existingTasks].sort((a, b) => {
          const aOrder = taskOrderMap.get(a.task_id) || 999;
          const bOrder = taskOrderMap.get(b.task_id) || 999;
          return aOrder - bOrder;
        });
        
        // Xử lý tasks mới (nếu có) và thêm vào cuối
        const allTasks = [...sortedExistingTasks, ...newTasks];
        
        // Sử dụng processTasksAndUpdateStore thay vì processTasks
        processTasksAndUpdateStore(allTasks, true, dispatch);
      } else {
        // Nếu chưa có tasks được sắp xếp, xử lý bình thường
        processTasksAndUpdateStore(tasks, false, dispatch);
      }
      
      // Đánh dấu đã khởi tạo
      tasksInitialized.current = true;
    }, 100);
    
    // Cleanup timer khi component unmount hoặc dependency thay đổi
    return () => clearTimeout(timerId);
  }, [tasks, orderedTaskItems, isDragging, dispatch, activePlan]);

  // Cập nhật orderedTasks khi activePlan thay đổi
  useEffect(() => {
    // Chỉ xử lý khi có activePlan và có tasks
    if (!activePlan || tasks.length === 0) return;
    
    console.log('Active plan changed, KHÔNG cần gọi processTasksAndUpdateStore vì đã được extraReducers xử lý');
    
    // Đánh dấu đã khởi tạo để useEffect khác không xử lý lại
    tasksInitialized.current = true;
    
    // QUAN TRỌNG: KHÔNG gọi processTasksAndUpdateStore ở đây vì extraReducers đã tự xử lý rồi
    // Gọi thêm lần nữa sẽ gây duplicate tasks!
  }, [activePlan?.id, tasks, dispatch]);

  // Thêm useEffect để debug re-render
  useEffect(() => {
    console.log('📊 orderedTaskItems changed:', orderedTaskItems.length);
    if (orderedTaskItems.length > 0) {
      console.log('Thứ tự hiện tại của tasks:');
      orderedTaskItems.slice(0, 5).forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.title} (${item.priority}), priorityOrder: ${item.priorityOrder}`);
      });
      if (orderedTaskItems.length > 5) {
        console.log(`  ... và ${orderedTaskItems.length - 5} items khác`);
      }
    }
  }, [orderedTaskItems]);

  // Sử dụng trạng thái autoSort từ Redux
  const isAutoSortFromRedux = useAppSelector(selectAutoSort);
  const [autoSort, setAutoSort] = useState(isAutoSortFromRedux);
  
  // Luôn cập nhật autoSort từ Redux khi nó thay đổi
  useEffect(() => {
    setAutoSort(isAutoSortFromRedux);
  }, [isAutoSortFromRedux]);

  // Tối ưu lại orderedTasks với memo chi tiết hơn
  const orderedTasks = useMemo(() => {
    console.log('🔄 Recalculating orderedTasks');
    let result = orderedTaskItems.map(item => convertTaskOrderToTask(item, currentProjectId || ''));

    // Có plan: luôn ưu tiên giữ nguyên thứ tự từ orderedTaskItems (từ plan)
    if (activePlan) {
      console.log('Có active plan, giữ nguyên thứ tự tasks từ plan');
      console.log('Task order from plan:', result.map(t => 
        `${t.title} (${t.priority}) - Order: ${t.priority_order}`
      ));
      return result;
    }
    
    // Không có plan: sort theo priority nếu autoSort = true
    if (autoSort) {
      console.log('Sắp xếp tasks theo priority vì autoSort=true và không có plan');
      const priorityOrder: Record<string, number> = {
        urgent: 1,
        high: 2,
        medium: 3,
        low: 4
      };
      
      result = [...result].sort((a, b) => {
        const aPriority = priorityOrder[a.priority?.toLowerCase() || 'medium'] || 3;
        const bPriority = priorityOrder[b.priority?.toLowerCase() || 'medium'] || 3;
        return aPriority - bPriority;
      });
      
      console.log('Task order after priority sort:', result.map(t => 
        `${t.title} (${t.priority}) - Order: ${t.priority_order}`
      ));
    } else {
      // autoSort=false: giữ nguyên thứ tự từ Redux store
      console.log('GIỮ NGUYÊN thứ tự tasks từ Redux store vì autoSort=false');
      console.log('Task order from store:', result.map(t => 
        `${t.title} (${t.priority}) - Order: ${t.priority_order}`
      ));
    }

    return result;
  }, [orderedTaskItems, currentProjectId, autoSort, activePlan]);

  // Tối ưu lại filteredTasks để chỉ thực hiện lọc theo user/project
  const filteredTasks = useMemo(() => {
    console.log('🔄 Recalculating filteredTasks');
    
    // Nếu không có tasks, return empty array
    if (!orderedTasks.length) return [];
    
    // Bắt đầu với orderedTasks đã được sắp xếp
    let result = orderedTasks;
    
    // Chỉ filter theo user nếu cần
    if (viewMode === 'user' && selectedUserId) {
      result = result.filter(task => task.assignee?.userId === selectedUserId);
      console.log('Filtered tasks by user:', result.map(t => 
        `${t.title} (${t.priority}) - Order: ${t.priority_order}`
      ));
    }
    
    return result;
  }, [
    orderedTasks,   // Chỉ recalculate khi orderedTasks thay đổi
    viewMode,       // Hoặc khi view mode thay đổi
    selectedUserId  // Hoặc khi user được chọn thay đổi
  ]);

  // Điều chỉnh onDragStart để đánh dấu bắt đầu kéo thả
  const onDragStart = useCallback(() => {
    setIsDragging(true);
    if (window.navigator.vibrate) {
      window.navigator.vibrate(100);
    }
  }, []);
  
  // Điều chỉnh onDragEnd để đánh dấu user đã thực hiện kéo thả
  const onDragEnd = useCallback(async (event: DragEndEvent) => {
    // Đánh dấu kết thúc kéo thả
    setIsDragging(false);
    
    const { active, over } = event;
    
    if (!over) return;
    
    const activeTaskId = active.id as string;
    const overTaskId = over.id as string;
    
    if (activeTaskId === overTaskId) return;
    
    // Tìm vị trí mới trong danh sách
    const taskListIds = orderedTaskItems.map(task => task.taskId);
    const oldIndex = taskListIds.indexOf(activeTaskId);
    const newIndex = taskListIds.indexOf(overTaskId);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    // Log thứ tự trước khi thay đổi
    console.log('📋 Thứ tự task trước khi kéo thả:');
    orderedTaskItems.forEach((item, idx) => {
      console.log(`  ${idx + 1}. Task ${item.taskId}: ${item.title} (${item.priority}), Priority Order: ${item.priorityOrder}`);
    });
    
    // Tạo mảng mới theo thứ tự ưu tiên
    const newTasksOrder = arrayMove(orderedTaskItems, oldIndex, newIndex);
    
    // QUAN TRỌNG: Không tách riêng urgent task nữa, giữ nguyên thứ tự kéo thả của user
    // Cập nhật priorityOrder mới CHÍNH XÁC theo vị trí
    const updatedDragItems = newTasksOrder.map((item, index) => ({
      ...item,
      priorityOrder: index + 1
    }));
    
    // Log thứ tự sau khi thay đổi
    console.log('📋 Thứ tự task SAU khi kéo thả (trước khi tính toán lại ngày):');
    updatedDragItems.forEach((item, idx) => {
      console.log(`  ${idx + 1}. Task ${item.taskId}: ${item.title} (${item.priority}), Priority Order: ${item.priorityOrder}`);
    });
    
    // Chuyển đổi thành Task[] với force_recalculate để tính toán lại ngày
    const tasksToRecalculate = updatedDragItems.map(item => {
      return {
        ...convertTaskOrderToTask(item, currentProjectId || ''),
        priority_order: item.priorityOrder,
        force_recalculate: true,
        start_date: undefined,
        due_date: undefined
      } as Task;
    });
    
    // QUAN TRỌNG: Chỉ sử dụng processTasksAndUpdateStore, không cần dispatch updateTaskOrder riêng
    // vì processTasksAndUpdateStore sẽ tự đảm bảo cập nhật cả thứ tự và ngày tháng
    console.log('🔄 Timeline - onDragEnd: Gọi processTasksAndUpdateStore để cập nhật thứ tự và ngày:', 
      tasksToRecalculate.length, 'tasks');
    processTasksAndUpdateStore(tasksToRecalculate, true, dispatch);
    
    // Tắt chế độ tự động sắp xếp
    setAutoSort(false);
    // Cập nhật vào Redux store
    dispatch(updateAutoSort(false));
    
  }, [orderedTaskItems, dispatch, currentProjectId]);

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
        endDate.setDate(startDate.getDate() + 30);
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

  // Thêm useEffect chỉ kiểm tra dữ liệu và processing tasks
  useEffect(() => {
    // Kiểm tra nếu cả hai điều kiện đồng thời thỏa mãn: có tasks và chưa được khởi tạo
    if (tasks.length > 0 && !tasksInitialized.current) {
      console.log('Kiểm tra dữ liệu trong Timeline:', {
        tasksCount: tasks.length,
        orderedItemsCount: orderedTaskItems.length,
        plansLoading,
        hasActivePlan: !!activePlan
      });
      
      // Sử dụng hàm mới để xử lý tasks dựa trên việc có plan hay không
      processTasksBasedOnPlan(tasks, !!activePlan, dispatch);
      
      tasksInitialized.current = true;
    }
  }, [tasks, orderedTaskItems.length, activePlan, plansLoading, dispatch]);

  // Thêm hàm xử lý để tạo kế hoạch mới
  const handleNewPlan = useCallback(() => {
    // Reset và hiển thị dialog tạo kế hoạch mới
    setPlanName('');
    setShowSavePlanDialog(true);
  }, []);

  // Thêm hàm xử lý để chọn kế hoạch
  const handleSelectPlan = useCallback((plan: Plan) => {
    // Gọi API để đặt plan này là active trên server trước
    dispatch(setPlanActive(plan.id))
      .unwrap()
      .then((updatedPlan) => {
        // Dispatch action để đặt kế hoạch đã chọn làm active
        dispatch(setActivePlan(updatedPlan));
        
        // Tắt chế độ tự động sắp xếp vì plan đã có thứ tự riêng
        setAutoSort(false);
        
        toast.success(`Đã chọn kế hoạch: ${updatedPlan.name}`);
      })
      .catch((error) => {
        toast.error(`Lỗi khi chọn kế hoạch: ${error.message || 'Lỗi không xác định'}`);
      });
  }, [dispatch]);

  // Thêm hàm xử lý để lưu kế hoạch
  const handleSavePlan = useCallback(() => {
    if (!planName.trim()) {
      toast.error('Vui lòng nhập tên kế hoạch');
      return;
    }
    
    if (!currentProjectId) {
      toast.error('Không tìm thấy thông tin project');
      return;
    }
    
    // Tạo dữ liệu cho kế hoạch mới với định dạng đúng theo API và lưu đầy đủ thông tin
    const planTasks: CreatePlanTaskDataInput[] = orderedTaskItems.map((item, index) => {
      // Kiểm tra nếu calculatedTaskDates là object và có thuộc tính cho taskId này
      const calculatedDates = typeof calculatedTaskDates === 'object' && calculatedTaskDates !== null 
        ? calculatedTaskDates[item.taskId] 
        : undefined;
      
      // Lấy ngày bắt đầu/kết thúc từ nhiều nguồn theo thứ tự ưu tiên
      const startDate = item.startDate || 
                         (calculatedDates && calculatedDates.startDate) || 
                         '';
      const endDate = item.endDate || 
                       (calculatedDates && calculatedDates.endDate) || 
                       '';
      
      // Chuyển đổi priority thành đúng kiểu Priority nếu cần
      let taskPriority = item.priority as Priority | undefined;
      // Đảm bảo priority hợp lệ (low, medium, high, urgent, critical)
      if (taskPriority && !['low', 'medium', 'high', 'urgent', 'critical'].includes(taskPriority)) {
        taskPriority = 'medium'; // Giá trị mặc định nếu không hợp lệ
      }
      
      // Tạo dữ liệu theo kiểu yêu cầu của API (CreatePlanTaskDataInput)
      return {
        taskId: item.taskId,
        title: item.title || 'Không có tiêu đề',
        priorityOrder: index + 1,
        startDate: startDate,
        endDate: endDate,
        effort: item.effort,
        assigneeId: item.assigneeId,
        assigneeName: item.assigneeName,
        priority: taskPriority,
        status: item.status
      };
    });

    console.log('Dữ liệu plan tasks đã chuẩn bị:', planTasks);

    // Tạo input cho mutation với định dạng phù hợp
    const input: CreatePlanInput = {
      projectId: currentProjectId,
      name: planName,
      planData: {
        tasks: planTasks
      }
    };
    
    console.log('Đang tạo plan mới với input:', input);
    
    // Dispatch action để tạo kế hoạch mới
    dispatch(createPlan(input))
      .unwrap()
      .then((result) => {
        console.log('Kết quả tạo plan:', result);
        toast.success('Đã lưu kế hoạch thành công');
        setShowSavePlanDialog(false);
      })
      .catch((error) => {
        console.error('Lỗi khi tạo plan:', error);
        toast.error(`Lỗi khi lưu kế hoạch: ${error.message || 'Lỗi không xác định'}`);
      });
  }, [planName, currentProjectId, orderedTaskItems, calculatedTaskDates, dispatch]);

  // Thêm hàm xử lý để xóa kế hoạch
  const handleDeletePlan = useCallback(() => {
    if (!activePlan) {
      toast.error('Không có kế hoạch nào được chọn');
      return;
    }
    
    // Dispatch action để xóa kế hoạch
    dispatch(deletePlan(activePlan.id))
      .unwrap()
      .then(() => {
        toast.success('Đã xóa kế hoạch thành công');
        setShowDeletePlanDialog(false);
      })
      .catch((error) => {
        toast.error(`Lỗi khi xóa kế hoạch: ${error.message || 'Lỗi không xác định'}`);
      });
  }, [activePlan, dispatch]);

  // Thêm hàm xử lý để sắp xếp lại thứ tự task
  const handleTaskReorder = useCallback((taskId: string, newIndex: number) => {
    // Tìm vị trí hiện tại của task
    const currentIndex = orderedTaskItems.findIndex(item => item.taskId === taskId);
    if (currentIndex === -1) return;
    
    // Tắt chế độ tự động sắp xếp vì user đã thủ công sắp xếp
    setAutoSort(false);
    // Cập nhật vào Redux store
    dispatch(updateAutoSort(false));
    
    // Log thứ tự trước khi thay đổi
    console.log('📋 Thứ tự task trước khi kéo thả:');
    orderedTaskItems.forEach((item, idx) => {
      console.log(`  ${idx + 1}. Task ${item.taskId}: ${item.title} (${item.priority}), Priority Order: ${item.priorityOrder}`);
    });
    
    // Tạo bản sao của mảng để tránh thay đổi trực tiếp
    const newOrderedItems = [...orderedTaskItems];
    
    // Di chuyển task đến vị trí mới
    const [movedItem] = newOrderedItems.splice(currentIndex, 1);
    newOrderedItems.splice(newIndex, 0, movedItem);
    
    // QUAN TRỌNG: Không tách riêng urgent task nữa, giữ nguyên thứ tự kéo thả của user
    // Cập nhật priorityOrder mới CHÍNH XÁC theo vị trí
    const updatedReorderedItems = newOrderedItems.map((item, index) => ({
      ...item,
      priorityOrder: index + 1
    }));
    
    // Log thứ tự sau khi thay đổi
    console.log('📋 Thứ tự task SAU khi kéo thả (trước khi tính toán lại ngày):');
    updatedReorderedItems.forEach((item, idx) => {
      console.log(`  ${idx + 1}. Task ${item.taskId}: ${item.title} (${item.priority}), Priority Order: ${item.priorityOrder}`);
    });
    
    // Chuyển đổi thành Task[] với force_recalculate để tính toán lại ngày
    const tasksToRecalculate = updatedReorderedItems.map(item => {
      return {
        ...convertTaskOrderToTask(item, currentProjectId || ''),
        priority_order: item.priorityOrder, // Giữ nguyên priorityOrder đã cập nhật
        force_recalculate: true,  // Đánh dấu để tính toán lại ngày
        // Xóa start_date và due_date để buộc tính toán lại từ đầu
        start_date: undefined,
        due_date: undefined
      } as Task;
    });
    
    console.log('📊 Danh sách task để tính toán lại ngày:', tasksToRecalculate.length);
    tasksToRecalculate.forEach((task, idx) => {
      console.log(`  ${idx + 1}. ${task.title} (${task.priority}) - Priority Order: ${task.priority_order}`);
    });
    
    // QUAN TRỌNG: Chỉ gọi processTasksAndUpdateStore, KHÔNG cần dispatch updateTaskOrder riêng
    // vì processTasksAndUpdateStore sẽ tự động dispatch updateTaskOrderAndDates
    console.log('🔄 Timeline - handleTaskReorder: Gọi processTasksAndUpdateStore để cập nhật thứ tự và ngày:', 
      tasksToRecalculate.length, 'tasks');
    processTasksAndUpdateStore(tasksToRecalculate, true, dispatch);
  }, [orderedTaskItems, dispatch, currentProjectId]);

  // Thêm hàm để kích hoạt sắp xếp tự động
  const handleAutoSort = useCallback(() => {
    // Cập nhật state local
    setAutoSort(true);
    
    // Cập nhật vào Redux store
    dispatch(updateAutoSort(true));
    
    // Chuyển đổi thành Task[] với force_recalculate để tính toán lại ngày
    const tasksToRecalculate = tasks.map(task => ({
      ...task,
      force_recalculate: true,
      // Xóa start_date và due_date để buộc tính toán lại từ đầu
      start_date: undefined,
      due_date: undefined
    }));
    
    // Gọi processTasksAndUpdateStore với keepOrder=false để sắp xếp lại theo priority
    processTasksAndUpdateStore(tasksToRecalculate, false, dispatch);
  }, [tasks, dispatch]);

  // Debug re-render
  console.log('🔄 Timeline render', {
    tasksLength: tasks?.length || 0,
    orderedTaskItemsLength: orderedTaskItems?.length || 0,
    isPlanLoaded,
    isTasksInitialized: tasksInitialized.current,
    viewMode,
    autoSort
  });

  // Sửa phần return để hiển thị loading khi đang load tasks
  if (isLoading || tasksLoading) {
    return <TimelineSkeleton />;
  }

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
        <div className="flex flex-col">
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

              {/* Button sắp xếp tự động */}
              <button
                onClick={handleAutoSort}
                className="flex items-center gap-1 px-3 py-1 rounded text-sm bg-slate-100 hover:bg-slate-200"
                title="Sắp xếp task tự động theo priority"
              >
                <ArrowUpDown className="h-4 w-4" />
                <span>Sắp xếp tự động</span>
              </button>
          </div>
        </div>

        {/* Nội dung - Phần này sẽ được mở rộng theo nội dung thay vì bị giới hạn chiều cao */}
        <div className="flex gap-4">
          {/* Sidebar - tasks - xóa giới hạn chiều cao và scroll */}
          <div className="w-80 flex-shrink-0 border-r border-slate-200">
            {viewMode === 'project' ? (
              <PriorityTaskList 
                tasks={orderedTasks} 
                onTaskClick={onTaskClick} 
                onTaskReorder={(taskId, newIndex) => {
                  // Xử lý sắp xếp lại task dựa trên kéo thả
                  handleTaskReorder(taskId, newIndex);
                }}
              />
            ) : (
              <>
                {selectedUserId ? (
                  <PriorityTaskList 
                    tasks={filteredTasks} 
                    onTaskClick={onTaskClick} 
                    onTaskReorder={(taskId, newIndex) => {
                      // Xử lý sắp xếp lại task dựa trên kéo thả
                      handleTaskReorder(taskId, newIndex);
                    }}
                  />
                ) : (
                  <div className="p-3 text-slate-500 text-sm">
                    Vui lòng chọn một người dùng để xem danh sách task
                  </div>
                )}
              </>
            )}
          </div>

          {/* Gantt Chart - Cấu trúc mới với sticky headers */}
          <div className="flex-1 flex flex-col overflow-hidden" ref={containerRef}>
          {/* Container chứa cả headers và grid - Sửa lại cấu trúc để header và nội dung scroll đồng bộ */}
          <div className="relative flex-1 overflow-x-auto" ref={ganttContentRef}>
            <div style={{ width: `${days.length * dayWidth}px`, minWidth: '100%' }}>
              {/* Header phía trên */}
              <div className="sticky top-0 z-20 bg-white border-b border-slate-200">
                <div className="flex date-headers" style={{ 
                    height: '40px',
                  }}>
                    {days.map((day: Date, index: number) => {
                      const isToday = isSameDay(day, today);
                      const isWeekendDay = isWeekend(day);
                      
                      return (
                        <div
                          key={day.toISOString()}
                          style={{ width: `${dayWidth}px`, minWidth: `${dayWidth}px` }}
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

              {/* Phần grid và task bars */}
              <div 
                style={{ 
                  height: `${Math.max(10, orderedTaskItems.length) * rowHeight}px`, 
                  minHeight: '480px'
                }}
              >
                <div
                  style={{ 
                    width: `${days.length * dayWidth}px`,
                    height: '100%'
                  }}
                  className="relative bg-white"
                >
                  {/* Grid Container */}
                  <div className="relative h-full">
                    {/* Columns for days - highlight background first */}
                    <div 
                      className="absolute inset-0 grid"
                      style={{
                        gridTemplateColumns: `repeat(${days.length}, ${dayWidth}px)`,
                        height: '100%',
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
                        gridTemplateRows: `repeat(${Math.max(10, orderedTaskItems.length)}, ${rowHeight}px)`,
                        gridAutoFlow: 'row',
                        height: '100%',
                        zIndex: 10
                      }}
                    >
                      {Array.from({ length: days.length * Math.max(10, orderedTaskItems.length) }).map((_, index) => (
                        <div
                          key={`grid-cell-${index}`}
                          className="border-r border-b border-slate-200 relative"
                        />
                      ))}
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
      </div>
  );
}
