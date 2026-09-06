'use client';

import { useTranslation } from 'react-i18next';
import { computeTaskAllocations, schedulingHorizon, type TaskAllocation } from '@/utils/taskAllocations';
import { PlanLifecycleBar } from '@/components/timeline/PlanLifecycleBar';
import { buildGanttTaskRows } from '@/utils/ganttRows';
import { Task, Priority, GanttFilter } from '@/types/task';
import { GanttFilterBar } from './gantt-filter-bar';
import { AssignedUser } from '@/types/user';
import { TaskBar } from './TaskBar';
import { TimelineSkeleton } from './TimelineSkeleton';
import { PriorityTaskList } from './PriorityTaskList';
import { ScheduleModeControl } from './ScheduleModeControl';
import { PhaseScheduleRow } from './PhaseScheduleRow';
import { WbsSourceHeadingRow } from './WbsSourceHeadingRow';
import { useProjectTaxonomies } from '@/hooks/useProjectTaxonomies';
import { useScheduleProjection } from '@/hooks/useScheduleProjection';
import type { ScheduleDisplayMode, WbsSourceHeading, PhaseDescriptor } from '@/types/taxonomy';
import type { PhaseRollupSummary } from '@/types/schedule-projection';
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
import { TaskDetail } from '@/components/tasks/TaskDetail';
import { useAuth } from '@/contexts/AuthContext';
import { Plan, PlanData, PlanTaskData, CreatePlanInput, CreatePlanDataInput, CreatePlanTaskDataInput } from '@/types/plan';
import { ChevronDownIcon, ChevronRightIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
  updateTaskOrder,
  updateTasksWithDates,
  initializeFromTasks,
  updateCalculatedDates,
  selectOrderedTasks,
  selectCalculatedTaskDates,
  selectIsPlanLoaded,
  updateAutoSort,
  selectAutoSort,
  updateOrderedTaskItem
} from '@/redux/features/taskOrderStore';
import { convertTaskOrderToTask, isWeekend, getNextWorkDay, findNextAvailableStartDate, calculateTaskSchedule, WorkSchedule, processTasksAndUpdateStore, processTasksBasedOnPlan, ScheduleOptions } from '@/utils/taskScheduler';
import { useProjectSchedulingConfig } from '@/hooks/useProjectSchedulingConfig';
import { useParams } from 'next/navigation';
import { ArrowUpDown } from 'lucide-react';
import { batch } from 'react-redux';
import { sortTasksByPriority } from '@/utils/taskScheduler';

interface TimelineBarsOverride {
  start: string;
  end: string;
  hoursPerDay: Record<string, number>;
}

interface TimelineProps {
  isLoading?: boolean;
  onTaskClick?: (taskId: string) => void;
  users?: AssignedUser[];
  /**
   * herdr-260906 saved-plan/draft view: when present, bars for the listed
   * task ids render from the SNAPSHOT (dates + per-day hours) instead of
   * being recomputed — viewport- and config-independent by construction.
   */
  barsOverride?: Record<string, TimelineBarsOverride> | null;
}

type ViewMode = 'project' | 'user';

/** Unified grid row: real tasks reuse the existing TaskBar; heading/phase
 * summary rows are NON-DRAGGABLE display rows with no task callbacks. */
type ScheduleGridRow =
  | { key: string; kind: 'HEADING'; heading: WbsSourceHeading }
  | { key: string; kind: 'PHASE'; group: PhaseRollupSummary }
  | { key: string; kind: 'TASK'; task: Task; depth: number };

interface DateRange {
  startDate: Date;
  endDate: Date;
}

export function Timeline({ isLoading = false, onTaskClick, users, barsOverride }: TimelineProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttContentRef = useRef<HTMLDivElement>(null);
  const ganttHeaderRef = useRef<HTMLDivElement>(null);
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
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<Task | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [ganttFilter, setGanttFilter] = useState<GanttFilter>({});
  // Requirement 1: collapsed parent rows in the gantt task-name column.
  const [collapsedRows, setCollapsedRows] = useState<Set<string>>(new Set());
  // Increment 1: presentation-only schedule mode (switching never writes).
  const [scheduleMode, setScheduleMode] = useState<ScheduleDisplayMode>('WBS_DETAIL');
  const { user } = useAuth();

  // Lấy redux store tasks
  const { tasks, loading: tasksLoading } = useAppSelector(state => state.tasks);
  const projectMembers = useAppSelector(state => state.members.members);

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

    // Thử lấy từ localStorage trước
    try {
      const savedRange = localStorage.getItem('ganttChartDateRange');
      if (savedRange) {
        const parsed = JSON.parse(savedRange);
        const startDate = new Date(parsed.startDate);
        const endDate = new Date(parsed.endDate);

        // Validate dates
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          return { startDate, endDate };
        }
      }
    } catch (error) {
      console.error('Lỗi khi đọc dateRange từ localStorage:', error);
    }

    // Default Fallback
    const startDate = getLastMonday();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 30);
    return { startDate, endDate };
  });

  // Auto-fit range when tasks change
  useEffect(() => {
    // Nếu đã Init từ LocalStorage thành công, không tự động Auto-fit nữa để tôn trọng view của user
    if (initializedFromLocalStorage.current) {
      console.log("Skipping auto-expand because dateRange was restored from localStorage.");
      // Lưu ý: Nếu muốn Auto-expand hoạt động lại sau này (khi tasks thay đổi lớn), có thể cần logic phức tạp hơn.
      // Hiện tại ưu tiên giữ nguyên view user đã chọn.

      // Reset flag để các lần update tasks tiếp theo (nếu có sự thay đổi thực sự từ action khác) có thể check lại?
      // KHÔNG: Nếu reset false, lần render sau (do bất kỳ update nào) sẽ kích hoạt lại auto-expand và override view.
      // Giữ nguyên true cho đến khi component unmount là an toàn nhất cho yêu cầu "Get từ local storage hiển thị".
      return;
    }

    if (tasks && tasks.length > 0) {
      const today = new Date();
      let minDate = new Date(today);
      let maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + 30); // Default window

      tasks.forEach(task => {
        // Determine effective start date (logic mirrors render loop)
        let effectiveStartDate: Date | null = null;
        if (task.start_date) {
          effectiveStartDate = new Date(task.start_date);
        } else if (task.status === 'DONE') {
          const doneDate = task.actual_end_date || task.updated_at || task.due_date || task.created_at;
          effectiveStartDate = doneDate ? new Date(doneDate) : new Date(today);
        } else {
          effectiveStartDate = new Date(today);
        }

        if (effectiveStartDate < minDate) minDate = new Date(effectiveStartDate);

        // Determine effective end date (logic mirrors render loop)
        const effectiveEndDate = (task.status === 'DONE')
          ? calculateTaskSchedule(effectiveStartDate, task.effort || 0).endDate
          : (task.due_date ? new Date(task.due_date) : calculateTaskSchedule(effectiveStartDate, task.effort || 0).endDate);

        if (effectiveEndDate > maxDate) maxDate = new Date(effectiveEndDate);
      });

      // Buffer
      minDate.setDate(minDate.getDate() - 7);
      maxDate.setDate(maxDate.getDate() + 7);

      // Update state if significantly different (avoid loops) to ensure visibility
      const currentStart = dateRange.startDate.getTime();
      const currentEnd = dateRange.endDate.getTime();

      // Only expand, don't shrink user selection unless it's way off? 
      // For now, let's just ensure MIN covers filtering
      if (minDate.getTime() < currentStart || maxDate.getTime() > currentEnd) {
        console.log("Auto-expanding Gantt range to fit tasks:", minDate, maxDate);
        setDateRange(prev => ({
          startDate: minDate.getTime() < prev.startDate.getTime() ? minDate : prev.startDate,
          endDate: maxDate.getTime() > prev.endDate.getTime() ? maxDate : prev.endDate
        }));
      }
    }
  }, [tasks]); // Run when tasks load/change

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


  // Đưa hàm processTasks vào useCallback để tránh tạo instance mới mỗi khi render
  const processTasks = useCallback((inputTasks: Task[], keepOrder: boolean = false): Task[] => {
    console.log('Chuyển tiếp xử lý đến processTasksAndUpdateStore:', inputTasks.length, 'keepOrder:', keepOrder);
    return processTasksAndUpdateStore(inputTasks, keepOrder, dispatch);
  }, [dispatch]); // Chỉ phụ thuộc vào dispatch


  // Lấy thông tin dự án hiện tại từ URL
  const params = useParams();
  const currentProjectId = params ? (params.id as string) : '';
  // Requirements 3/6: persisted capacity + days off + recurring commitments.
  const schedulingConfig = useProjectSchedulingConfig(currentProjectId || undefined);

  // ── Increment 1: schedule modes (WBS_DETAIL | MASTER_SCHEDULE) ──────────────
  // Read-only projection (CURRENT_TASK_FIELDS producer). Mode switching and
  // refetches perform NO mutations; phase/heading rows never receive task
  // callbacks and are never draggable.
  const { phases: projectPhases } = useProjectTaxonomies(currentProjectId || null);
  const phaseDescriptors = useMemo<PhaseDescriptor[]>(
    () =>
      projectPhases.map((p) => ({
        phase_id: p.phase_id,
        name: p.name,
        display_order: p.display_order,
      })),
    [projectPhases]
  );
  const { wbsRows: projectionWbsRows, masterRows, loading: projectionLoading } =
    useScheduleProjection(currentProjectId || null, phaseDescriptors);

  /** Fallback Task built from a projection entry when Redux has no full task. */
  const taskFromProjection = useCallback(
    (entry: { task_id: string; title: string; effort_hours?: number | null; start?: string | null; end?: string | null; progress_percent?: number | null }): Task => ({
      task_id: entry.task_id,
      id: entry.task_id,
      project_id: currentProjectId || '',
      title: entry.title,
      priority_order: 0,
      created_by: '' as string, // projection fallback: no creator known
      status: 'TODO' as const,
      priority: 'MEDIUM' as const,
      effort: typeof entry.effort_hours === 'number' ? entry.effort_hours : undefined,
      progress: typeof entry.progress_percent === 'number' ? entry.progress_percent : undefined,
      start_date: entry.start ?? undefined,
      due_date: entry.end ?? undefined,
    }),
    [currentProjectId]
  );

  /** Resolve the full Redux task for a projection entry (modal data). */
  const resolveTask = useCallback(
    (entry: { task_id: string; title: string; effort_hours?: number | null; start?: string | null; end?: string | null; progress_percent?: number | null }): Task => {
      const full = tasks.find((t) => t.task_id === entry.task_id || t.id === entry.task_id);
      return full ?? taskFromProjection(entry);
    },
    [tasks, taskFromProjection]
  );

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
        CRITICAL: 0,
        URGENT: 1,
        HIGH: 2,
        MEDIUM: 3,
        LOW: 4
      };

      result = [...result].sort((a, b) => {
        // 1. Sort by status: Active first, Done last
        const isDoneA = a.status === 'DONE';
        const isDoneB = b.status === 'DONE';
        if (isDoneA && !isDoneB) return 1;
        if (!isDoneA && isDoneB) return -1;

        // 2. Sort by priority
        const aPriority = priorityOrder[a.priority?.toUpperCase() || 'MEDIUM'] ?? 3;
        const bPriority = priorityOrder[b.priority?.toUpperCase() || 'MEDIUM'] ?? 3;
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

  // Handle task bar click: left click -> modal, ctrl/middle -> new tab
  // Use full Redux tasks (not orderedTasks) to get complete task data for the modal
  const handleTaskBarClick = useCallback((taskId: string, event?: React.MouseEvent) => {
    const fullTask = tasks.find(t => t.task_id === taskId || t.id === taskId);
    if (!fullTask) return;

    if (event?.ctrlKey || event?.metaKey || event?.button === 1) {
      event?.preventDefault();
      window.open(`/projects/${fullTask.project_id}/tasks/${taskId}`, '_blank');
      return;
    }
    setSelectedTaskForDetail(fullTask);
    setIsTaskDetailOpen(true);
    onTaskClick?.(taskId);
  }, [tasks, onTaskClick]);

  // Sync modal changes back to timeline state + taskOrderStore (for Gantt bars)
  // Note: TaskDetail already dispatches updateTaskLocally to tasksSlice
  const handleTaskDetailUpdate = useCallback((taskId: string, updates: Partial<Task>) => {
    setSelectedTaskForDetail(prev => prev ? { ...prev, ...updates } : null);
    // Update taskOrderStore directly so Gantt bars reflect changes (especially with active plan)
    const orderUpdates: Record<string, unknown> = {};
    if (updates.status) orderUpdates.status = updates.status;
    if (updates.priority) orderUpdates.priority = updates.priority;
    if (updates.effort !== undefined) orderUpdates.effort = updates.effort;
    if (updates.start_date !== undefined) orderUpdates.startDate = updates.start_date;
    if (updates.due_date !== undefined) orderUpdates.endDate = updates.due_date;
    if (updates.title !== undefined) orderUpdates.title = updates.title;
    if (Object.keys(orderUpdates).length > 0) {
      dispatch(updateOrderedTaskItem({ taskId, updates: orderUpdates }));
    }
  }, [dispatch]);

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

  // Apply gantt-specific filters on top of filteredTasks (type/tags require full task data lookup)
  const visibleTasks = useMemo(() => {
    const { searchQuery, status, priority, type, tags } = ganttFilter;
    const hasFilter = searchQuery || status || priority || type || tags?.length;
    if (!hasFilter) return filteredTasks;

    return filteredTasks.filter(task => {
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (status && task.status !== status) return false;
      if (priority && task.priority !== priority) return false;

      // type/tags are not in taskOrderStore — look up full task data
      if (type || tags?.length) {
        // Match by task_id or id to handle different ID formats
        const fullTask = tasks.find(t => t.task_id === task.task_id || t.id === task.task_id);
        if (!fullTask) return false; // exclude tasks not yet in Redux state
        if (type && fullTask.type !== type) return false;
        // Case-insensitive OR match: task must have at least one of the filter tags
        if (tags?.length) {
          const taskTags = fullTask.tags || [];
          const lowerTaskTags = taskTags.map(t => t.toLowerCase());
          if (!tags.some(tag => lowerTaskTags.includes(tag.toLowerCase()))) return false;
        }
      }

      return true;
    });
  }, [filteredTasks, ganttFilter, tasks]);

  // ── Increment 1: unified grid rows for the schedule modes ───────────────────
  // TASK rows reuse the existing TaskBar rendering below; HEADING/PHASE rows
  // are NON-DRAGGABLE display rows never passed to task callbacks.
  const scheduleGridRows = useMemo<ScheduleGridRow[]>(() => {
    // No projection data yet (loading/error): keep the existing task-bar view,
    // but render parent/child hierarchy from task.parent_task_id (requirement 1).
    if (projectionLoading || projectionWbsRows.length === 0) {
      // herdr-260906: hardened row builder — dedup by task_id, cycle guard,
      // orphan emission (shared util, unit-tested for deep/orphan/cycle/
      // duplicate inputs).
      const enriched = visibleTasks.map((task) => {
        const full = tasks.find(
          (t) => t.task_id === task.task_id || t.id === task.task_id
        );
        return { ...task, parent_task_id: full?.parent_task_id };
      });
      return buildGanttTaskRows(enriched);
    }

    if (scheduleMode === 'WBS_DETAIL') {
      return projectionWbsRows.map((row) =>
        row.kind === 'SOURCE_HEADING'
          ? { key: row.row_id, kind: 'HEADING' as const, heading: row.heading }
          : {
              key: row.row_id,
              kind: 'TASK' as const,
              task: resolveTask(row.task),
              depth: row.depth,
            }
      );
    }

    // MASTER_SCHEDULE: phase groups in exact display order, Unphased ALWAYS LAST.
    const rows: ScheduleGridRow[] = [];
    for (const group of [...masterRows.phase_groups, masterRows.unphased_group]) {
      rows.push({ key: group.phase_id ? `phase:${group.phase_id}` : 'phase:unphased', kind: 'PHASE', group });
      for (const taskId of group.task_ids) {
        const wbsTask = projectionWbsRows.find(
          (r) => r.kind === 'TASK' && r.task.task_id === taskId
        );
        const entry = wbsTask && wbsTask.kind === 'TASK' ? wbsTask.task : { task_id: taskId, title: taskId };
        rows.push({ key: `task:${taskId}`, kind: 'TASK', task: resolveTask(entry), depth: 1 });
      }
    }
    return rows;
  }, [scheduleMode, projectionWbsRows, masterRows, projectionLoading, visibleTasks, resolveTask, tasks, currentProjectId]);

  // ── Requirement 1: parent/child expand/collapse over the grid rows ────────
  // A row "has children" when any following row is deeper before an
  // equal-or-shallower row appears. Collapsed parents hide their subtree.
  const { gridRows, rowHasChildren } = useMemo(() => {
    const hasChildren = new Map<string, boolean>();
    for (let i = 0; i < scheduleGridRows.length; i++) {
      const row = scheduleGridRows[i];
      const depth =
        row.kind === 'TASK'
          ? row.depth
          : row.kind === 'HEADING'
            ? row.heading.depth
            : 0;
      let child = false;
      for (let j = i + 1; j < scheduleGridRows.length; j++) {
        const next = scheduleGridRows[j];
        const nextDepth =
          next.kind === 'TASK'
            ? next.depth
            : next.kind === 'HEADING'
              ? next.heading.depth
              : 0;
        if (nextDepth > depth) {
          child = true;
          break;
        }
        if (nextDepth <= depth) break;
      }
      hasChildren.set(row.key, child);
    }
    if (collapsedRows.size === 0) {
      return { gridRows: scheduleGridRows, rowHasChildren: hasChildren };
    }
    const visible: ScheduleGridRow[] = [];
    const openStack: { depthVal: number; collapsed: boolean }[] = [];
    for (const row of scheduleGridRows) {
      const depth =
        row.kind === 'TASK'
          ? row.depth
          : row.kind === 'HEADING'
            ? row.heading.depth
            : 0;
      while (openStack.length > 0 && openStack[openStack.length - 1].depthVal >= depth) {
        openStack.pop();
      }
      const hidden = openStack.some((a) => a.collapsed);
      if (!hidden) visible.push(row);
      if (hasChildren.get(row.key) && collapsedRows.has(row.key)) {
        openStack.push({ depthVal: depth, collapsed: true });
      } else if (hasChildren.get(row.key)) {
        openStack.push({ depthVal: depth, collapsed: false });
      }
    }
    return { gridRows: visible, rowHasChildren: hasChildren };
  }, [scheduleGridRows, collapsedRows]);

  const toggleRowCollapsed = useCallback((key: string) => {
    setCollapsedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);



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

  // Sync horizontal scroll between gantt grid and sticky date header
  useEffect(() => {
    const grid = ganttContentRef.current;
    const header = ganttHeaderRef.current;
    if (!grid || !header) return;
    const onScroll = () => { header.scrollLeft = grid.scrollLeft; };
    grid.addEventListener('scroll', onScroll);
    return () => grid.removeEventListener('scroll', onScroll);
  }, []);

  const days = getDatesBetween(dateRange.startDate, dateRange.endDate);
  const dayWidth = Math.max(80, dimensions.width / days.length);
  const rowHeight = 48;
  // ── Requirements 3/5/6: capacity-aware per-task allocation with per-day ──
  // hour splits (e.g. effort 10h → 8h + 2h). Recurring commitments are
  // reserved before finite priority tasks; zero-hour days get no hours.
  // ── Requirements 3/5/6: capacity-aware allocation with per-day hour
  // splits, computed on an EXPLICIT horizon (today → +365d, extended by long
  // viewports) — never on the visible viewport alone, so tasks that spill
  // past the view still get commitments subtracted and scrolling cannot
  // change an allocation (manager review).
  const allocationHorizon = useMemo(
    () => schedulingHorizon(today, days[0], days[days.length - 1]),
    [today, days]
  );
  const taskAllocationResult = useMemo(
    () =>
      computeTaskAllocations(
        orderedTasks.map((t) => ({
          ...t,
          assignee_user_id: (t.assignee as { userId?: string } | undefined)?.userId ?? null,
        })),
        {
          capacityFor: (key) => schedulingConfig.capacityFor(key),
          reservedFor: (key, from, to) => schedulingConfig.reservedFor(key, from, to),
          memberKeyFor: (userId) => schedulingConfig.memberKeyFor(userId),
        },
        allocationHorizon,
        today
      ),
    [orderedTasks, schedulingConfig, allocationHorizon, today]
  );
  // herdr-260906: saved-plan / draft override — snapshot bars (incl. per-day
  // hours) replace computed allocations when a lifecycle view is active.
  const taskAllocations = useMemo(() => {
    if (!barsOverride) return taskAllocationResult.allocations;
    const merged: Record<string, TaskAllocation> = { ...taskAllocationResult.allocations };
    for (const [taskId, bar] of Object.entries(barsOverride)) {
      merged[taskId] = {
        start: new Date(bar.start),
        end: new Date(bar.end),
        hoursPerDay: bar.hoursPerDay,
      };
    }
    return merged;
  }, [taskAllocationResult, barsOverride]);

  // Scheduling inputs shared with the plan lifecycle (same mapping the
  // allocation above uses, so drafts match live computation).
  const planLifecycleScheduling = useMemo(
    () => ({
      tasks: orderedTasks.map((t) => ({
        ...t,
        assignee_user_id: (t.assignee as { userId?: string } | undefined)?.userId ?? null,
      })),
      config: {
        capacityFor: (key: string) => schedulingConfig.capacityFor(key),
        reservedFor: (key: string, from: string, to: string) =>
          schedulingConfig.reservedFor(key, from, to),
        memberKeyFor: (userId?: string | null) => schedulingConfig.memberKeyFor(userId),
      },
      horizon: allocationHorizon,
      today,
    }),
    [orderedTasks, schedulingConfig, allocationHorizon, today]
  );

  // Requirement 3: reallocate tasks by priority when capacity config changes.
  const handleRecalculateSchedule = useCallback(() => {
    const tasksToRecalc = orderedTasks.map((task, index) => ({
      ...task,
      priority_order: task.priority_order ?? index + 1,
      force_recalculate: true,
    })) as Task[];
    const options: ScheduleOptions = {
      capacityFor: (assigneeId) => schedulingConfig.capacityFor(assigneeId || 'unassigned'),
      reservedFor: (assigneeId) =>
        schedulingConfig.reservedFor(assigneeId || 'unassigned', allocationHorizon.from, allocationHorizon.to),
    };
    processTasksAndUpdateStore(tasksToRecalc, true, dispatch, options);
    toast.success('Recalculated schedule from member capacity & commitments');
  }, [orderedTasks, currentProjectId, schedulingConfig, days, dispatch]);

  const gridRowCount = Math.max(gridRows.length, 6);

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
      toast.error(t('gantt.enterPlanNameRequired'));
      return;
    }

    if (!currentProjectId) {
      toast.error(t('gantt.planSelectFailed'));
      return;
    }

    // Use visibleTasks (currently displayed after filters) — exclude DONE/CLOSE
    const activeVisibleTasks = visibleTasks.filter(
      task => !['DONE', 'CLOSE'].includes(task.status?.toUpperCase() || '')
    );

    if (activeVisibleTasks.length === 0) {
      toast.error(t('gantt.noTasksToSave'));
      return;
    }

    const planTasks: CreatePlanTaskDataInput[] = activeVisibleTasks.map(task => {
      const calculatedDates = typeof calculatedTaskDates === 'object' && calculatedTaskDates !== null
        ? calculatedTaskDates[task.task_id]
        : undefined;

      const startDate = task.start_date ||
        (calculatedDates && calculatedDates.startDate) ||
        '';
      const endDate = task.due_date ||
        (calculatedDates && calculatedDates.endDate) ||
        '';

      let taskPriority = task.priority as Priority | undefined;
      if (taskPriority && !['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL'].includes(taskPriority)) {
        taskPriority = 'MEDIUM';
      }

      return {
        taskId: task.task_id,
        title: task.title,
        priorityOrder: task.priority_order,
        startDate,
        endDate,
        effort: task.effort,
        assigneeId: task.assignee?.userId,
        priority: taskPriority,
        status: task.status,
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
        toast.success(t('gantt.planSaved'));
        setShowSavePlanDialog(false);
      })
      .catch((error) => {
        console.error('Lỗi khi tạo plan:', error);
        toast.error(`Lỗi khi lưu kế hoạch: ${error.message || 'Lỗi không xác định'}`);
      });
  }, [planName, currentProjectId, visibleTasks, calculatedTaskDates, dispatch]);

  // Thêm hàm xử lý để xóa kế hoạch
  const handleDeletePlan = useCallback(() => {
    if (!activePlan) {
      toast.error(t('gantt.noActivePlan'));
      return;
    }

    // Dispatch action để xóa kế hoạch
    dispatch(deletePlan(activePlan.id))
      .unwrap()
      .then(() => {
        toast.success(t('gantt.planDeleted'));
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
    // 1. Cập nhật state local và Redux store
    setAutoSort(true);
    dispatch(updateAutoSort(true));

    // 2. Lọc bỏ task đã done/close, chỉ sắp xếp task chưa hoàn thành
    const activeTasks = tasks.filter(task => !['DONE', 'CLOSE'].includes(task.status.toUpperCase()));
    console.log(`Bắt đầu sắp xếp tự động cho ${activeTasks.length} tasks (bỏ ${tasks.length - activeTasks.length} task done/close)`);
    const sortedTasks = sortTasksByPriority(activeTasks);

    console.log('Thứ tự tasks sau khi sắp xếp theo priority:');
    sortedTasks.slice(0, 5).forEach((task, idx) => {
      console.log(`  ${idx + 1}. ${task.title} (${task.priority}), Priority Order: ${task.priority_order}`);
    });

    // 3. Chuẩn bị tasks cho tính toán ngày - reset ngày để tính toán lại theo priority
    const tasksToProcess = sortedTasks.map(task => ({
      ...task,
      force_recalculate: true,
      start_date: undefined,
      due_date: undefined
    }));

    // 4. Gọi processTasksAndUpdateStore để tính toán lại ngày và cập nhật vào store
    processTasksAndUpdateStore(tasksToProcess, true, dispatch);

    toast.success(t('gantt.sortedByPriority'));
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
        <div className="flex flex-col gap-2 mb-4 border-b pb-2">
          {/* Row 1: Plan controls - right-aligned */}
          <div className="flex justify-end gap-2 items-center flex-wrap">
            <select
              className="px-3 py-1 border rounded text-sm"
              value={activePlan?.id || ''}
              onChange={(e) => {
                const selectedPlan = plans.find((p: Plan) => p.id === e.target.value);
                if (selectedPlan) {
                  handleSelectPlan(selectedPlan);
                }
              }}
              title={t('gantt.selectPlan')}
            >
              <option value="" disabled>{t('gantt.selectPlan')}</option>
              {plans.map((plan: Plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleNewPlan}
              className="flex items-center gap-1 px-3 py-1 rounded text-sm bg-slate-100 hover:bg-slate-200 whitespace-nowrap"
              title={t('gantt.newPlan')}
            >
              <PlusIcon className="h-4 w-4" />
              New Plan
            </button>

            <button
              onClick={handleSavePlan}
              className="flex items-center gap-1 px-3 py-1 rounded text-sm bg-blue-100 hover:bg-blue-200 whitespace-nowrap"
              title={t('gantt.savePlanCount', { count: visibleTasks.filter(task => !['DONE', 'CLOSE'].includes(task.status)).length })}
            >
              <span>{t('gantt.savePlan')}</span>
            </button>

            <PlanLifecycleBar
              projectId={currentProjectId || undefined}
              scheduling={planLifecycleScheduling}
              truncatedCommitmentRules={schedulingConfig.truncatedCommitmentRules}
            />

            {activePlan && (
              <button
                onClick={() => setShowDeletePlanDialog(true)}
                className="flex items-center gap-1 px-2 py-1 rounded text-sm bg-red-100 hover:bg-red-200 whitespace-nowrap"
                title={t('gantt.deletePlan')}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            )}

            <button
              onClick={handleAutoSort}
              className="flex items-center gap-1 px-3 py-1 rounded text-sm bg-slate-100 hover:bg-slate-200 whitespace-nowrap"
              title={t('gantt.autoSortTitle')}
            >
              <ArrowUpDown className="h-4 w-4" />
              <span>{t('gantt.autoSort')}</span>
            </button>
          </div>

          {/* Row 2: View mode + date range */}
          <div className="flex gap-2 items-center flex-wrap">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('project')}
                className={`px-3 py-1 rounded-l ${viewMode === 'project'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600'
                  }`}
              >
                Project
              </button>
              <button
                onClick={() => setViewMode('user')}
                className={`px-3 py-1 rounded-r ${viewMode === 'user'
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

            {/* Increment 1: presentation-only schedule mode toggle (no writes) */}
            <ScheduleModeControl mode={scheduleMode} onModeChange={setScheduleMode} />

            {/* R3/R6: unschedulable-effort warning — NEVER silently report
                exhausted tasks as fully allocated. */}
            {taskAllocationResult.exhaustedTaskIds.length > 0 && (
              <span
                className="px-2 py-1 rounded text-xs bg-red-100 text-red-700 whitespace-nowrap"
                data-testid="schedule-exhausted-warning"
                title={taskAllocationResult.exhaustedTaskIds.join(', ')}
              >
                ⚠ {taskAllocationResult.exhaustedTaskIds.length} task(s) exceed capacity/horizon — effort left unscheduled
              </span>
            )}

            {/* Requirement 3: priority reallocation from member capacity /
                days off / recurring commitments (explicit user action). */}
            <button
              onClick={handleRecalculateSchedule}
              className="flex items-center gap-1 px-3 py-1 rounded text-sm bg-emerald-100 hover:bg-emerald-200 whitespace-nowrap"
              title="Recalculate task dates from member capacity, days off and recurring commitments"
              data-testid="recalculate-schedule-btn"
            >
              <ChevronDownIcon className="h-4 w-4" />
              <span>Recalculate</span>
            </button>

            <div className="h-6 w-px bg-slate-200 mx-2"></div>

            <div className="flex items-center gap-2">
              <label htmlFor="start-date" className="text-sm text-slate-600">
                {t('gantt.startLabel')}
              </label>
              <input
                id="start-date"
                type="date"
                value={dateRange.startDate.toISOString().split('T')[0]}
                onChange={handleStartDateChange}
                className="px-2 py-1 text-sm border rounded"
                aria-label={t('gantt.startDate')}
                title={t('gantt.startDate')}
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="end-date" className="text-sm text-slate-600">
                {t('gantt.endLabel')}
              </label>
              <input
                id="end-date"
                type="date"
                value={dateRange.endDate.toISOString().split('T')[0]}
                onChange={handleEndDateChange}
                className="px-2 py-1 text-sm border rounded"
                aria-label={t('gantt.endDate')}
                title={t('gantt.endDate')}
              />
            </div>

            <div className="h-6 w-px bg-slate-200 mx-2"></div>

            {/* Gantt task filters */}
            <GanttFilterBar filter={ganttFilter} onFilterChange={setGanttFilter} />
          </div>
        </div>

        {/* Content: Left task list + Right gantt chart - uses page scroll only */}
        <div className="flex">
          {/* Left panel - task priority list */}
          <div className="w-52 flex-shrink-0 border-r border-slate-200">
            {/* Sticky header - sticks below page header when page scrolls */}
            <div className="h-[40px] border-b border-slate-200 bg-slate-50 flex items-center px-2 sticky z-40" style={{ top: '64px' }}>
              <span className="text-xs font-medium text-slate-500">{t('gantt.taskList')}</span>
            </div>
            {viewMode === 'project' ? (
              <PriorityTaskList
                title={t('gantt.taskList')}
                tasks={visibleTasks}
                onTaskClick={onTaskClick}
                onTaskReorder={(taskId, newIndex) => {
                  // Xử lý sắp xếp lại task dựa trên kéo thả
                  handleTaskReorder(taskId, newIndex);
                }}
                activePlanId={activePlan?.id || null}
                autoSort={autoSort}
              />
            ) : (
              <>
                {selectedUserId ? (
                  <PriorityTaskList
                    title={t('gantt.taskList')}
                    tasks={visibleTasks}
                    onTaskClick={onTaskClick}
                    onTaskReorder={(taskId, newIndex) => {
                      // Xử lý sắp xếp lại task dựa trên kéo thả
                      handleTaskReorder(taskId, newIndex);
                    }}
                    activePlanId={activePlan?.id || null}
                    autoSort={autoSort}
                  />
                ) : (
                  <div className="p-3 text-slate-500 text-sm">
                    Vui lòng chọn một người dùng để xem danh sách task
                  </div>
                )}
              </>
            )}
          </div>

          {/* Gantt Chart */}
          <div className="flex-1 min-w-0 flex" ref={containerRef}>
            {/* Requirement 1: task-name column on the right side of the
                priority list — parent/child hierarchy with indent and
                expand/collapse, vertically aligned with the bar grid. */}
            <div className="w-60 flex-shrink-0 border-r border-slate-200 bg-white" data-testid="gantt-name-column">
              <div className="h-[40px] border-b border-slate-200 bg-slate-50 flex items-center px-2 sticky z-40" style={{ top: '64px' }}>
                <span className="text-xs font-medium text-slate-500">Task</span>
              </div>
              <div className="relative" style={{ height: `${gridRowCount * rowHeight}px`, minHeight: `${6 * rowHeight}px` }}>
                {gridRows.map((row, rowIndex) => {
                  const depth =
                    row.kind === 'TASK'
                      ? row.depth
                      : row.kind === 'HEADING'
                        ? row.heading.depth
                        : 0;
                  const hasChildren = rowHasChildren.get(row.key) ?? false;
                  const collapsed = collapsedRows.has(row.key);
                  const title =
                    row.kind === 'TASK'
                      ? row.task.title
                      : row.kind === 'HEADING'
                        ? row.heading.title
                        : row.group.name;
                  const isTaskRow = row.kind === 'TASK';
                  return (
                    <div
                      key={row.key}
                      className="absolute left-0 right-0 flex items-center gap-1 px-2 border-b border-slate-100"
                      style={{ top: `${rowIndex * rowHeight}px`, height: `${rowHeight}px` }}
                      data-testid="gantt-name-row"
                      data-depth={depth}
                    >
                      {hasChildren ? (
                        <button
                          type="button"
                          aria-label={collapsed ? 'Expand' : 'Collapse'}
                          aria-expanded={!collapsed}
                          data-testid="gantt-row-toggle"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRowCollapsed(row.key);
                          }}
                          className="p-0.5 rounded hover:bg-slate-200 text-slate-600"
                        >
                          {collapsed ? <ChevronRightIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
                        </button>
                      ) : (
                        <span className="w-[22px]" />
                      )}
                      <span
                        className={`truncate text-xs ${isTaskRow ? 'text-slate-700' : 'font-semibold text-slate-800'}`}
                        style={{ paddingLeft: `${depth * 14}px` }}
                        title={title}
                        onClick={isTaskRow ? () => handleTaskBarClick(row.task.task_id) : undefined}
                      >
                        {title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex-1 min-w-0">
            {/* Date header - sticky, synced horizontal scroll with grid below */}
            <div
              className="sticky z-40 bg-white border-b border-slate-200 overflow-hidden"
              style={{ top: '64px' }}
              ref={ganttHeaderRef}
            >
              <div className="flex date-headers" style={{
                width: `${days.length * dayWidth}px`,
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
                          {day.toLocaleDateString(undefined, {
                            day: '2-digit',
                            month: '2-digit'
                          })}
                        </div>
                        <div className="text-[0.6rem] text-slate-500 text-center">
                          {day.toLocaleDateString(undefined, { weekday: 'short' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Grid and task bars - horizontally scrollable */}
            <div className="overflow-x-auto" ref={ganttContentRef}>
              <div style={{ width: `${days.length * dayWidth}px`, minWidth: '100%' }}>

                {/* Phần grid và task bars */}
                <div
                  style={{
                    height: `${gridRowCount * rowHeight}px`,
                    minHeight: `${6 * rowHeight}px`
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
                          gridTemplateRows: `repeat(${gridRowCount}, ${rowHeight}px)`,
                          gridAutoFlow: 'row',
                          height: '100%',
                          zIndex: 10
                        }}
                      >
                        {Array.from({ length: days.length * gridRowCount }).map((_, index) => (
                          <div
                            key={`grid-cell-${index}`}
                            className="border-r border-b border-slate-200 relative"
                          />
                        ))}
                      </div>

                      {/* Task Bars + schedule rows (Increment 1) */}
                      {/* TASK rows reuse the existing TaskBar; HEADING/PHASE rows
                          are non-draggable display rows with NO task callbacks. */}
                      {gridRows.map((row, rowIndex) => {
                        if (row.kind !== 'TASK') {
                          return (
                            <div
                              key={row.key}
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: `${rowIndex * rowHeight}px`,
                                width: '100%',
                                height: `${rowHeight}px`,
                                zIndex: 14,
                                pointerEvents: 'none'
                              }}
                            >
                              {row.kind === 'HEADING' ? (
                                <WbsSourceHeadingRow heading={row.heading} />
                              ) : (
                                <PhaseScheduleRow group={row.group} />
                              )}
                            </div>
                          );
                        }

                        const task = row.task;
                        // Requirements 3/5/6: capacity-aware allocation with
                        // per-day hour splits when available.
                        const allocation = taskAllocations[task.task_id];
                        // herdr-260906: saved snapshot bar (or unsaved draft)
                        // wins over live computation — config/viewport cannot
                        // move it while a plan view is active.
                        const planBar = barsOverride?.[task.task_id];
                        let taskStartDate: Date;

                        if (planBar) {
                          taskStartDate = new Date(planBar.start);
                          taskStartDate.setHours(0, 0, 0, 0);
                        } else if (task.start_date) {
                          // Plan start date set → use as-is (even if in the past)
                          taskStartDate = new Date(task.start_date);
                          taskStartDate.setHours(0, 0, 0, 0);
                        } else {
                          // No plan start date → today, but skip weekends to next Monday
                          const todayDate = new Date(today);
                          todayDate.setHours(0, 0, 0, 0);
                          const dayOfWeek = todayDate.getDay(); // 0=Sun, 6=Sat
                          if (dayOfWeek === 6) todayDate.setDate(todayDate.getDate() + 2); // Sat → Mon
                          else if (dayOfWeek === 0) todayDate.setDate(todayDate.getDate() + 1); // Sun → Mon
                          taskStartDate = todayDate;
                        }

                        // Tính end_date:
                        // Nếu có effort → tính theo effort (calculateTaskSchedule)
                        // Nếu không có effort nhưng có due_date → dùng due_date
                        // Còn lại → same day as start
                        let taskEndDate: Date;
                        if (planBar) {
                          taskEndDate = new Date(planBar.end);
                          taskEndDate.setHours(0, 0, 0, 0);
                        } else if (task.effort != null && task.effort > 0) {
                          taskEndDate = calculateTaskSchedule(taskStartDate, task.effort).endDate;
                        } else if (task.due_date) {
                          taskEndDate = new Date(task.due_date);
                          taskEndDate.setHours(0, 0, 0, 0);
                        } else {
                          taskEndDate = new Date(taskStartDate);
                        }

                        // Nếu start > end (do default start=today mà end=quá khứ), swap hoặc skip
                        // Ở đây ta skip render bar nếu data không hợp lệ thay vì vẽ full
                        if (taskStartDate > taskEndDate) {
                          if (task.status === 'DONE') console.warn(`Skipping Done Task ${task.title}: Start ${taskStartDate} > End ${taskEndDate}`);
                          return null;
                        }

                        // Tính tổng số ngày (kể cả ngày nghỉ) giữa start_date và end_date
                        const startDayIndex = days.findIndex(day => isSameDay(day, taskStartDate));
                        let endDayIndex = days.findIndex(day => isSameDay(day, taskEndDate));

                        let renderStartDayIndex = startDayIndex;
                        const totalDaysSpan = Math.ceil((taskEndDate.getTime() - taskStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                        // Nếu không tìm thấy ngày Start trong view này
                        if (startDayIndex === -1) {
                          const viewStart = days[0];
                          const viewEnd = days[days.length - 1];

                          // Nếu không overlap thì return null
                          if (taskEndDate < viewStart || (taskStartDate && taskStartDate > viewEnd)) {
                            // Silent skip for out of view
                            return null;
                          }

                          // Nếu overlap (start < viewStart <= end), vẽ từ đầu view
                          // Tính offset ngày bị cắt
                          renderStartDayIndex = 0;
                        }

                        // Tính số ngày hiển thị
                        // Nếu endDayIndex = -1 (không tìm thấy trong view)
                        // Tính số ngày hiển thị
                        // Nếu endDayIndex = -1 (không tìm thấy trong view)
                        let totalDays;
                        if (endDayIndex === -1) {
                          const viewEnd = days[days.length - 1];
                          if (taskEndDate > viewEnd) {
                            // Task kết thúc sau view (hoặc start đã bị clip thành 0) -> vẽ đến hết view từ renderStartDayIndex
                            // Nếu start gốc < viewStart, renderStartDayIndex = 0
                            // Nếu start gốc trong view, renderStartDayIndex = startDayIndex
                            totalDays = days.length - renderStartDayIndex;
                          } else {
                            // Task kết thúc trước view -> Đã filter ở trên
                            totalDays = 0;
                          }
                        } else {
                          // Task end trong view
                          totalDays = endDayIndex - renderStartDayIndex + 1;
                        }

                        // Đảm bảo task luôn có ít nhất 1 ngày hiển thị
                        const displayDays = Math.max(1, totalDays);

                        // Requirement 5: render per-day hour segments
                        // (effort 10h → “8h” + “2h” cells; zero days blank).
                        if (allocation) {
                          const segments = Object.entries(allocation.hoursPerDay)
                            .filter(([, hours]) => hours > 0)
                            .map(([dateKey, hours]) => {
                              const idx = days.findIndex((d) => formatDateVN(d) === dateKey);
                              if (idx === -1) return null;
                              return (
                                <div
                                  key={`${task.task_id}-seg-${dateKey}`}
                                  title={`${task.title} — ${dateKey}: ${hours}h`}
                                  onClick={(e) => handleTaskBarClick(task.task_id, e)}
                                  className="rounded-sm text-gray-800 text-[0.65rem] font-medium cursor-pointer shadow hover:brightness-95 transition-all flex items-center justify-center border border-blue-200 bg-blue-100"
                                  style={{
                                    position: 'absolute',
                                    left: `${idx * dayWidth + 4}px`,
                                    top: '6px',
                                    width: `${dayWidth - 8}px`,
                                    height: '36px',
                                  }}
                                  data-testid="task-day-segment"
                                  data-task-id={task.task_id}
                                  data-date={dateKey}
                                  data-hours={hours}
                                >
                                  {Math.round(hours * 10) / 10}h
                                </div>
                              );
                            });
                          return (
                            <div
                              key={task.task_id}
                              data-testid={`task-bar-${task.task_id}`}
                              onClick={(e) => handleTaskBarClick(task.task_id, e)}
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: `${rowIndex * rowHeight}px`,
                                width: '100%',
                                height: `${rowHeight}px`,
                                zIndex: 15,
                              }}
                            >
                              {segments}
                            </div>
                          );
                        }

                        return (
                          <div
                            key={task.task_id}
                            style={{
                              position: 'absolute',
                              left: `${renderStartDayIndex * dayWidth}px`,
                              top: `${rowIndex * rowHeight}px`,
                              width: `${displayDays * dayWidth}px`,
                              height: `${rowHeight}px`,
                              zIndex: 15,
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
                              onClick={handleTaskBarClick}
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
        </div>

        {/* Dialog Tạo/Lưu Plan */}
        {showSavePlanDialog && (
          <Dialog
            open={showSavePlanDialog}
            onClose={() => setShowSavePlanDialog(false)}
            title={t('gantt.newPlan')}
            className="w-96"
          >
            <div className="mt-4">
              <label htmlFor="planName" className="block text-sm font-medium text-gray-700 mb-1">
                {t('gantt.selectPlan')}
              </label>
              <input
                id="planName"
                type="text"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder={t('gantt.enterPlanName')}
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
                {t('gantt.savePlan')}
              </button>
            </div>
          </Dialog>
        )}

        {/* Dialog Xóa Plan */}
        {showDeletePlanDialog && (
          <Dialog
            open={showDeletePlanDialog}
            onClose={() => setShowDeletePlanDialog(false)}
            title={t('gantt.deleteConfirm')}
            className="w-96"
          >
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                {activePlan?.name}
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowDeletePlanDialog(false)}
                className="px-4 py-2 border rounded-md text-sm"
              >
                {t('tasks.actions.cancel')}
              </button>
              <button
                onClick={handleDeletePlan}
                className="px-4 py-2 bg-red-500 text-white rounded-md text-sm"
              >
                {t('gantt.deletePlan')}
              </button>
            </div>
          </Dialog>
        )}

        {/* Task detail modal */}
        {selectedTaskForDetail && (
          <TaskDetail
            task={selectedTaskForDetail}
            isOpen={isTaskDetailOpen}
            onClose={() => setIsTaskDetailOpen(false)}
            onTaskUpdate={handleTaskDetailUpdate}
            currentUser={user || undefined}
            projectMembers={projectMembers}
          />
        )}
      </div>
    </div>
  );
}
