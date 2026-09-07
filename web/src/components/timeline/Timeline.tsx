'use client';

import { useTranslation } from 'react-i18next';
import { buildMasterPhaseRows, type MasterPhaseAllocation } from '@/lib/scheduling/build-master-rows';
import { useProjectCatalogs } from '@/hooks/useProjectCatalogs';
import { computeTaskAllocations, positiveWorkBounds, schedulingHorizon, type TaskAllocation } from '@/utils/taskAllocations';
import { PlanLifecycleBar } from '@/components/timeline/PlanLifecycleBar';
import { MemberDailyEffortMatrix } from '@/components/timeline/MemberDailyEffortMatrix';
import { usePlanLifecycle } from '@/hooks/usePlanLifecycle';
import {
  buildGanttTaskRows,
  reorderGanttSiblingTaskIds,
  sortGanttSiblingTaskIds,
} from '@/utils/ganttRows';
import type { DisplayedTaskEffort } from '@/utils/member-daily-effort';
import { Task, Priority, GanttFilter } from '@/types/task';
import { GanttFilterBar } from './gantt-filter-bar';
import { AssignedUser } from '@/types/user';
import { TimelineSkeleton } from './TimelineSkeleton';
import { ScheduleModeControl } from './ScheduleModeControl';
import { PhaseScheduleRow } from './PhaseScheduleRow';
import { WbsSourceHeadingRow } from './WbsSourceHeadingRow';
import { useProjectTaxonomies } from '@/hooks/useProjectTaxonomies';
import { useScheduleProjection } from '@/hooks/useScheduleProjection';
import type { ScheduleDisplayMode, WbsSourceHeading, PhaseDescriptor } from '@/types/taxonomy';
import type { MasterPhaseRow } from '@/types/schedule-projection';
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
  sortableKeyboardCoordinates,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useReorderTasks } from '@/hooks/useTasks';
import { useProject } from '@/hooks/useProject';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchProjectTasks, updateTaskLocally, updateTaskPriority } from '@/redux/features/tasksSlice';
import {
  createPlan,
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
  | { key: string; kind: 'PHASE'; group: MasterPhaseRow }
  | { key: string; kind: 'TASK'; task: Task; depth: number };

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface SortableGanttTaskRowProps {
  row: Extract<ScheduleGridRow, { kind: 'TASK' }>;
  rowIndex: number;
  rowHeight: number;
  hasChildren: boolean;
  collapsed: boolean;
  startLabel: string;
  endLabel: string;
  onToggle: (key: string) => void;
  onTaskClick: (taskId: string) => void;
  draggable: boolean;
}

function SortableGanttTaskRow({
  row,
  rowIndex,
  rowHeight,
  hasChildren,
  collapsed,
  startLabel,
  endLabel,
  onToggle,
  onTaskClick,
  draggable,
}: SortableGanttTaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.task.task_id,
    disabled: !draggable,
  });

  return (
    <div
      ref={setNodeRef}
      className={`absolute left-0 right-0 grid grid-cols-[22px_18px_minmax(0,1fr)_76px_76px] items-center gap-1 px-2 border-b border-slate-100 ${isDragging ? 'z-20 bg-slate-50 shadow' : ''}`}
      style={{
        top: `${rowIndex * rowHeight}px`,
        height: `${rowHeight}px`,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      data-testid="gantt-name-row"
      data-depth={row.depth}
    >
      {hasChildren ? (
        <button
          type="button"
          aria-label={collapsed ? 'Expand' : 'Collapse'}
          aria-expanded={!collapsed}
          data-testid="gantt-row-toggle"
          onClick={(event) => {
            event.stopPropagation();
            onToggle(row.key);
          }}
          className="p-0.5 rounded hover:bg-slate-200 text-slate-600"
        >
          {collapsed ? <ChevronRightIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
        </button>
      ) : <span />}
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={(event) => event.stopPropagation()}
        className={`text-slate-400 ${draggable ? 'cursor-grab hover:text-slate-600' : 'cursor-not-allowed opacity-40'}`}
        aria-label={`Reorder ${row.task.title}`}
        disabled={!draggable}
      >
        <ArrowUpDown className="h-3 w-3" />
      </button>
      <button
        type="button"
        className="truncate text-left text-xs text-slate-700"
        style={{ paddingLeft: `${row.depth * 14}px` }}
        title={row.task.title}
        onClick={() => onTaskClick(row.task.task_id)}
      >
        {row.task.title}
      </button>
      <span className="truncate text-[0.65rem] text-slate-500" data-testid="gantt-row-start">{startLabel}</span>
      <span className="truncate text-[0.65rem] text-slate-500" data-testid="gantt-row-end">{endLabel}</span>
    </div>
  );
}

export function Timeline({ isLoading = false, onTaskClick, users, barsOverride }: TimelineProps) {
  const { t, i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttContentRef = useRef<HTMLDivElement>(null);
  const ganttHeaderRef = useRef<HTMLDivElement>(null);
  const matrixScrollRef = useRef<HTMLDivElement>(null);
  const scrollLeftRef = useRef(0);
  const syncDateScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const left = event.currentTarget.scrollLeft;
    scrollLeftRef.current = left;
    for (const element of [ganttContentRef.current, ganttHeaderRef.current, matrixScrollRef.current]) {
      if (element && element.scrollLeft !== left) element.scrollLeft = left;
    }
  }, []);
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
  const { tasks: taskTree, loading: tasksLoading } = useAppSelector(state => state.tasks);
  const tasks = useMemo(() => {
    const byId = new Map<string, Task>();
    const pending = [...taskTree];
    while (pending.length) {
      const task = pending.pop()!;
      if (byId.has(task.task_id)) continue;
      byId.set(task.task_id, task);
      pending.push(...(task.child_tasks ?? []));
    }
    // Match the backend expected_order contract, not its DFS presentation order.
    return Array.from(byId.values()).sort((a, b) =>
      (a.priority_order ?? Number.MAX_SAFE_INTEGER) - (b.priority_order ?? Number.MAX_SAFE_INTEGER) || a.task_id.localeCompare(b.task_id));
  }, [taskTree]);
  const [liveOrder, setLiveOrder] = useState<{ projectId: string; source: Task[]; ids: string[] } | null>(null);
  const reorderIntent = useRef(0);
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
  const { wbsRows: projectionWbsRows } =
    useScheduleProjection(currentProjectId || null, phaseDescriptors);
  const progressCatalog = useProjectCatalogs(
    scheduleMode === 'MASTER_SCHEDULE' ? currentProjectId || undefined : undefined,
    'PROGRESS_TYPE'
  );

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

  // The same canonical project members as the matrix, including unlinked
  // and zero-allocation rows. Account assignees are not a member directory.
  const allMembers = useMemo(() => schedulingConfig.resourceMembers
    .map(member => ({ id: member.resource_member_id, name: member.display_name }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
  [schedulingConfig.resourceMembers]);
  useEffect(() => setSelectedUserId(''), [currentProjectId]);

  const matchesSelectedMember = useCallback((resourceId?: string | null, userId?: string | null) => {
    // A concrete resource identity wins, even when removed. Legacy user-only
    // assignments map through the canonical relation, never a display name.
    return typeof resourceId === 'string'
      ? resourceId === selectedUserId
      : Boolean(userId && schedulingConfig.resourceMembers.some(member =>
        member.resource_member_id === selectedUserId && member.user_id === userId));
  }, [schedulingConfig.resourceMembers, selectedUserId]);

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
    const currentTasks = tasks.filter(task => task.project_id === currentProjectId);
    if (liveOrder?.projectId !== currentProjectId || liveOrder.source !== taskTree) return currentTasks;
    const byId = new Map(currentTasks.map(task => [task.task_id, task]));
    return liveOrder.ids.filter(id => byId.has(id)).map((id, index) => ({ ...byId.get(id)!, priority_order: index + 1 }));
  }, [currentProjectId, liveOrder, taskTree, tasks]);

  const matchesTaskFilter = useCallback((task: Task) => {
    if (viewMode === 'user' && selectedUserId && !matchesSelectedMember(task.assignee_resource_member_id, task.assignee?.userId)) return false;
    const { searchQuery, status, priority, type, tags } = ganttFilter;
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (status && task.status !== status || priority && task.priority !== priority || type && task.type !== type) return false;
    return !tags?.length || tags.some(tag => (task.tags ?? []).some(value => value.toLowerCase() === tag.toLowerCase()));
  }, [ganttFilter, matchesSelectedMember, selectedUserId, viewMode]);
  const calculationsUnavailable = schedulingConfig.loading ? 'Loading member capacity data' : schedulingConfig.error;

  const lifecycleDays = getDatesBetween(dateRange.startDate, dateRange.endDate);
  const allocationHorizon = useMemo(
    () => schedulingHorizon(today, lifecycleDays[0], lifecycleDays[lifecycleDays.length - 1]),
    [today, lifecycleDays]
  );
  const planLifecycleScheduling = useMemo(
    () => ({
      tasks: orderedTasks.map((task) => {
        const live = tasks.find((candidate) => candidate.task_id === task.task_id);
        return {
          ...task,
          parent_task_id: live?.parent_task_id ?? task.parent_task_id,
          assignee_resource_member_id: live?.assignee_resource_member_id ?? task.assignee_resource_member_id,
          assignee_user_id: task.assignee?.userId ?? null,
        };
      }),
      selectedTaskIds: new Set(orderedTasks.filter(matchesTaskFilter).map(task => task.task_id)),
      unavailableReason: calculationsUnavailable,
      config: {
        capacityFor: (key: string) => schedulingConfig.capacityFor(key),
        reservedFor: (key: string, from: string, to: string) => schedulingConfig.reservedFor(key, from, to),
        memberKeyFor: (userId?: string | null) => schedulingConfig.memberKeyFor(userId),
      },
      horizon: allocationHorizon,
      today,
    }),
    [allocationHorizon, orderedTasks, schedulingConfig, tasks, today, matchesTaskFilter, calculationsUnavailable]
  );
  const planLifecycle = usePlanLifecycle(currentProjectId || undefined, planLifecycleScheduling);
  const displayedBarsOverride = planLifecycle.overrideBars ?? barsOverride;
  const selectedSnapshot = planLifecycle.mode === 'draft' ? planLifecycle.draft?.snapshot : planLifecycle.mode === 'saved' ? planLifecycle.loadedSnapshot : null;
  const contextTaskIds = useMemo(() => new Set(selectedSnapshot?.meta.contextTasks?.map(task => task.taskId) ?? []), [selectedSnapshot]);
  const selectedPlanTasks = useMemo(() => {
    const snapshot = planLifecycle.mode === 'draft'
      ? planLifecycle.draft?.snapshot
      : planLifecycle.mode === 'saved'
        ? planLifecycle.loadedSnapshot
        : null;
    const liveById = new Map(tasks.map((task) => [task.task_id, task]));
    if (!snapshot) {
      return orderedTasks.map((task) => ({
        ...task,
        parent_task_id: liveById.get(task.task_id)?.parent_task_id,
        assignee_resource_member_id: liveById.get(task.task_id)?.assignee_resource_member_id,
      }));
    }

    return [...snapshot.tasks, ...(snapshot.meta.contextTasks ?? [])].sort((a, b) => a.priorityOrder - b.priorityOrder).map((snapshotTask) => {
      const assignment = snapshot.tasks.find(task => task.taskId === snapshotTask.taskId);
      const live = liveById.get(snapshotTask.taskId);
      const hasParent = Object.prototype.hasOwnProperty.call(snapshotTask, 'parentTaskId');
      const hasResourceAssignment = Object.prototype.hasOwnProperty.call(snapshotTask, 'assigneeResourceMemberId');
      const hasUserAssignment = Object.prototype.hasOwnProperty.call(snapshotTask, 'assigneeUserId');
      const historical = !live;
      return {
        ...(live ?? {
          task_id: snapshotTask.taskId,
          id: snapshotTask.taskId,
          project_id: currentProjectId || '',
          title: `Historical task ${snapshotTask.taskId.slice(0, 8)}`,
          status: 'TODO' as const,
          priority: 'MEDIUM' as const,
          priority_order: snapshotTask.priorityOrder,
          created_by: '',
        }),
        task_id: snapshotTask.taskId,
        id: snapshotTask.taskId,
        project_id: currentProjectId || live?.project_id || '',
        title: snapshotTask.title ?? live?.title ?? `Historical task ${snapshotTask.taskId.slice(0, 8)}`,
        parent_task_id: hasParent ? snapshotTask.parentTaskId ?? undefined : live?.parent_task_id,
        status: assignment?.status ?? live?.status ?? 'TODO',
        priority_order: snapshotTask.priorityOrder,
        assignee_resource_member_id: hasResourceAssignment || hasUserAssignment
          ? assignment?.assigneeResourceMemberId ?? null
          : live?.assignee_resource_member_id ?? null,
        assignee: hasUserAssignment || hasResourceAssignment
          ? assignment?.assigneeUserId
            ? { userId: assignment.assigneeUserId, username: live?.assignee?.userId === assignment.assigneeUserId ? live.assignee.username : 'Historical member' }
            : undefined
          : live?.assignee,
        ...(historical ? { description: 'Historical saved-plan task; current task metadata is unavailable.' } : {}),
      } as Task;
    });
  }, [currentProjectId, orderedTasks, planLifecycle.draft, planLifecycle.loadedSnapshot, planLifecycle.mode, tasks]);

  // Live allocations are explicit and viewport-independent. Draft/saved views
  // use only their stored selected-plan vectors; they never merge live rows.
  const taskAllocationResult = useMemo(
    () => calculationsUnavailable ? { allocations: {}, exhaustedTaskIds: [] } :
      computeTaskAllocations(
        planLifecycleScheduling.tasks,
        {
          capacityFor: (key) => schedulingConfig.capacityFor(key),
          reservedFor: (key, from, to) => schedulingConfig.reservedFor(key, from, to),
          memberKeyFor: (userId) => schedulingConfig.memberKeyFor(userId),
        },
        allocationHorizon,
        today
      ),
    [calculationsUnavailable, planLifecycleScheduling.tasks, schedulingConfig, allocationHorizon, today]
  );
  const taskAllocations = useMemo(() => {
    if (!displayedBarsOverride) return taskAllocationResult.allocations;
    return Object.fromEntries(Object.entries(displayedBarsOverride).map(([taskId, bar]) => [
      taskId,
      { start: new Date(bar.start), end: new Date(bar.end), hoursPerDay: bar.hoursPerDay },
    ])) as Record<string, TaskAllocation>;
  }, [displayedBarsOverride, taskAllocationResult.allocations]);

  // Master consumes direct selected-plan task allocations only. In particular,
  // snapshot contextTasks remain WBS display metadata and never enter this sum.
  const masterAllocationInputs = useMemo<MasterPhaseAllocation[]>(() => {
    if (selectedSnapshot) {
      const allocationKnown = selectedSnapshot.meta.legacyHoursMissing !== true;
      return selectedSnapshot.tasks.map((task) => ({
        taskId: task.taskId,
        progressCatalogItemId: task.progressCatalogItemId,
        hoursPerDay: taskAllocations[task.taskId]?.hoursPerDay ?? task.hoursPerDay,
        allocationKnown,
      }));
    }
    return planLifecycleScheduling.tasks.map((task) => ({
      taskId: task.task_id || task.id || '',
      progressCatalogItemId: (task as { progressCatalogItemId?: string | null }).progressCatalogItemId,
      hoursPerDay: taskAllocations[task.task_id || task.id || '']?.hoursPerDay ?? {},
    }));
  }, [planLifecycleScheduling.tasks, selectedSnapshot, taskAllocations]);
  const masterRows = useMemo(
    () => progressCatalog.loading || progressCatalog.error
      ? []
      : buildMasterPhaseRows(masterAllocationInputs, progressCatalog.items, i18n.resolvedLanguage ?? i18n.language ?? 'en'),
    [i18n.language, i18n.resolvedLanguage, masterAllocationInputs, progressCatalog.error, progressCatalog.items, progressCatalog.loading]
  );

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

    // Selected live/draft/saved plan owns the displayed task collection.
    if (!selectedPlanTasks.length) return [];
    let result = selectedPlanTasks;

    // Chỉ filter theo user nếu cần
    if (viewMode === 'user' && selectedUserId) {
      result = result.filter(task => {
        if (selectedSnapshot) {
          // Absent/null historical assignment must not inherit today's task.
          const saved = selectedSnapshot.tasks.find(row => row.taskId === task.task_id);
          return Boolean(saved && matchesSelectedMember(saved.assigneeResourceMemberId, saved.assigneeUserId));
        }
        return matchesSelectedMember(task.assignee_resource_member_id, task.assignee?.userId);
      });
      console.log('Filtered tasks by user:', result.map(t =>
        `${t.title} (${t.priority}) - Order: ${t.priority_order}`
      ));
    }

    return result;
  }, [
    selectedPlanTasks,
    selectedSnapshot,
    matchesSelectedMember,
    viewMode,
    selectedUserId
  ]);

  // Apply filters while retaining every matching task's ancestor chain. This
  // keeps a filtered child in its real hierarchy instead of promoting it root.
  const visibleTasks = useMemo(() => {
    const { searchQuery, status, priority, type, tags } = ganttFilter;
    const hasGanttFilter = Boolean(searchQuery || status || priority || type || tags?.length);
    const hasUserFilter = viewMode === 'user' && Boolean(selectedUserId);
    if (!hasGanttFilter && !hasUserFilter) return filteredTasks;

    const matching = filteredTasks.filter(task => {
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (status && task.status !== status) return false;
      if (priority && task.priority !== priority) return false;
      if (!type && !tags?.length) return true;
      const fullTask = tasks.find(t => t.task_id === task.task_id || t.id === task.task_id);
      if (!fullTask || (type && fullTask.type !== type)) return false;
      const lowerTaskTags = (fullTask.tags || []).map(tag => tag.toLowerCase());
      return !tags?.length || tags.some(tag => lowerTaskTags.includes(tag.toLowerCase()));
    });

    const fullTaskById = new Map([
      ...tasks.map(task => [task.task_id, task] as const),
      ...selectedPlanTasks.map(task => [task.task_id, task] as const),
    ]);
    const visibleIds = new Set(matching.map(task => task.task_id));
    for (const task of matching) {
      let parentId = fullTaskById.get(task.task_id)?.parent_task_id;
      const visited = new Set<string>();
      while (parentId && !visited.has(parentId)) {
        visited.add(parentId);
        visibleIds.add(parentId);
        parentId = fullTaskById.get(parentId)?.parent_task_id;
      }
    }
    return selectedPlanTasks.filter(task => visibleIds.has(task.task_id));
  }, [filteredTasks, ganttFilter, selectedPlanTasks, selectedUserId, tasks, viewMode]);

  const visibleTaskIds = useMemo(
    () => new Set(visibleTasks.map((task) => task.task_id)),
    [visibleTasks]
  );
  // Ancestors kept only to explain a filtered match are context, not drop
  // targets. DnD therefore cannot turn filtering into a reparenting path.
  const draggableTaskIds = useMemo(() => {
    const { searchQuery, status, priority, type, tags } = ganttFilter;
    const hasGanttFilter = Boolean(searchQuery || status || priority || type || tags?.length);
    const hasUserFilter = viewMode === 'user' && Boolean(selectedUserId);
    if (!hasGanttFilter && !hasUserFilter) return new Set(Array.from(visibleTaskIds).filter(id => !contextTaskIds.has(id)));
    return new Set(filteredTasks.filter(task => !contextTaskIds.has(task.task_id)).filter((task) => {
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (status && task.status !== status) return false;
      if (priority && task.priority !== priority) return false;
      if (!type && !tags?.length) return true;
      const fullTask = tasks.find((candidate) => candidate.task_id === task.task_id || candidate.id === task.task_id);
      if (!fullTask || (type && fullTask.type !== type)) return false;
      const lowerTaskTags = (fullTask.tags || []).map((tag) => tag.toLowerCase());
      return !tags?.length || tags.some((tag) => lowerTaskTags.includes(tag.toLowerCase()));
    }).map((task) => task.task_id));
  }, [contextTaskIds, filteredTasks, ganttFilter, selectedUserId, tasks, viewMode, visibleTaskIds]);

  // ── Increment 1: unified grid rows for the schedule modes ───────────────────
  // TASK rows reuse the existing TaskBar rendering below; HEADING/PHASE rows
  // are NON-DRAGGABLE display rows never passed to task callbacks.
  const scheduleGridRows = useMemo<ScheduleGridRow[]>(() => {
    const taskRows = buildGanttTaskRows(visibleTasks);
    if (scheduleMode === 'WBS_DETAIL') {
      // Source headings own sections; authoritative roots carry their entire
      // subtree into that section, irrespective of projection task depth/order.
      const sections: ScheduleGridRow[][] = [[]];
      const sectionByTask = new Map<string, number>();
      for (const row of projectionWbsRows) {
        if (row.kind === 'SOURCE_HEADING') {
          sections.push([{ key: row.row_id, kind: 'HEADING', heading: row.heading }]);
        } else {
          sectionByTask.set(row.task.task_id, sections.length - 1);
        }
      }
      let section = 0;
      for (const row of taskRows) {
        if (row.depth === 0) section = sectionByTask.get(row.task.task_id) ?? 0;
        sections[section].push(row);
      }
      return sections.flat();
    }
    // Master is phase-only. It deliberately does not reuse WBS task rows or
    // the current-field Rust projection's phase totals.
    return masterRows.map((group) => ({
      key: group.phase_id ? `phase:${group.phase_id}` : 'phase:unclassified',
      kind: 'PHASE' as const,
      group,
    }));
  }, [scheduleMode, projectionWbsRows, masterRows, visibleTasks]);

  // ── Requirement 1: parent/child expand/collapse over the grid rows ────────
  // Task depths are relative to their task tree, not source-heading depths.
  // A heading always closes the preceding task tree, but can still belong to
  // an enclosing heading. Both grids and toggles use this same ancestry.
  const { gridRows, rowHasChildren } = useMemo(() => {
    const hasChildren = new Map<string, boolean>();
    const visible: ScheduleGridRow[] = [];
    const ancestors: { row: ScheduleGridRow; hidden: boolean }[] = [];
    for (const row of scheduleGridRows) {
      while (ancestors.length) {
        const parent = ancestors[ancestors.length - 1].row;
        if (row.kind === 'TASK' && (parent.kind !== 'TASK' || parent.depth < row.depth)) break;
        if (row.kind === 'HEADING' && parent.kind === 'HEADING' && parent.heading.depth < row.heading.depth) break;
        ancestors.pop();
      }
      const parent = ancestors[ancestors.length - 1];
      if (parent) hasChildren.set(parent.row.key, true);
      const hidden = Boolean(parent && (parent.hidden || collapsedRows.has(parent.row.key)));
      if (!hidden) visible.push(row);
      ancestors.push({ row, hidden });
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

  const reorderContext = useRef({ projectId: currentProjectId, mode: planLifecycle.mode });
  reorderContext.current = { projectId: currentProjectId, mode: planLifecycle.mode };
  useEffect(() => () => { reorderIntent.current++; }, [currentProjectId]);

  // Only this live path persists. Redux owns the server version; optimistic
  // display order is separate, so expected_order is captured BEFORE any edit.
  const persistLiveOrder = useCallback(async (ids: string[], nextAutoSort: boolean) => {
    if (!currentProjectId || ids.join('|') === orderedTasks.map(task => task.task_id).join('|')) return;
    const intent = ++reorderIntent.current;
    const isCurrent = () => intent === reorderIntent.current && reorderContext.current.projectId === currentProjectId;
    const expectedOrder = tasks.filter(task => task.project_id === currentProjectId && !task.is_deleted).map(task => task.task_id);
    setLiveOrder({ projectId: currentProjectId, source: taskTree, ids });
    setAutoSort(nextAutoSort);
    dispatch(updateAutoSort(nextAutoSort));
    try {
      const result = await reorderTasks.mutateAsync({
        projectId: currentProjectId,
        expectedOrder,
        taskOrders: ids.map((taskId, index) => ({ taskId, priorityOrder: index + 1 })),
      });
      if (!isCurrent()) return;
      for (const item of result ?? []) {
        dispatch(updateTaskLocally({ taskId: item.taskId, updates: { priority_order: item.priorityOrder } }));
      }
    } catch (error) {
      if (!isCurrent()) return;
      setLiveOrder(null);
      if (reorderContext.current.mode === 'live') {
        setAutoSort(autoSort);
        dispatch(updateAutoSort(autoSort));
      }
      toast.error(error instanceof Error ? error.message : 'Unable to save task order');
      // Roll back first, then refresh the actual task owner over the network.
      // Never reset the lifecycle: a newer valid saved selection stays selected.
      try { await dispatch(fetchProjectTasks(currentProjectId)).unwrap(); }
      catch { if (isCurrent()) toast.error('Task refresh failed. Reload before reordering again.'); }
    }
  }, [autoSort, currentProjectId, dispatch, orderedTasks, reorderTasks, taskTree, tasks]);

  // DnD has one hierarchy contract: only visible matching siblings can move.
  // Saved snapshots reject moves; draft snapshots remain completely local.
  const onDragEnd = useCallback(async (event: DragEndEvent) => {
    setIsDragging(false);
    const activeTaskId = String(event.active.id);
    const overTaskId = event.over ? String(event.over.id) : '';
    if (!overTaskId || activeTaskId === overTaskId) return;
    if (planLifecycle.mode === 'saved') {
      toast.info('Saved plan order is immutable. Recalculate to create an editable draft.');
      return;
    }

    const reorderedIds = reorderGanttSiblingTaskIds(
      selectedPlanTasks,
      activeTaskId,
      overTaskId,
      draggableTaskIds
    );
    if (reorderedIds.join('|') === selectedPlanTasks.map((task) => task.task_id).join('|')) return;
    if (planLifecycle.mode === 'draft') {
      planLifecycle.reorderDraft(reorderedIds);
      return;
    }
    await persistLiveOrder(reorderedIds, false);
  }, [draggableTaskIds, persistLiveOrder, planLifecycle, selectedPlanTasks]);

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

  useEffect(() => {
    for (const element of [ganttContentRef.current, ganttHeaderRef.current, matrixScrollRef.current]) {
      if (element) element.scrollLeft = scrollLeftRef.current;
    }
  }, [schedulingConfig.loading, schedulingConfig.error, tasksLoading, isLoading]);

  const days = lifecycleDays;
  const dayWidth = Math.max(80, dimensions.width / days.length);
  const rowHeight = 48;
  const displayedTaskEfforts = useMemo<DisplayedTaskEffort[]>(
    () => selectedPlanTasks.filter(task => !contextTaskIds.has(task.task_id)).map((task) => ({
      unknownSpan: selectedSnapshot?.meta.legacyHoursMissing === true
        ? { start: selectedSnapshot.tasks.find(t => t.taskId === task.task_id)!.startDate, end: selectedSnapshot.tasks.find(t => t.taskId === task.task_id)!.endDate }
        : undefined,
      taskId: task.task_id,
      assigneeResourceMemberId: task.assignee_resource_member_id,
      assigneeUserId: task.assignee?.userId,
      hoursPerDay: taskAllocations[task.task_id]?.hoursPerDay ?? {},
      kind: 'TASK',
    })),
    [contextTaskIds, selectedSnapshot, selectedPlanTasks, taskAllocations]
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

  // Stable priority sorting is sibling-local, then persisted as the complete
  // hierarchy order. Saved plans stay immutable and draft order stays local.
  const handleAutoSort = useCallback(async () => {
    const sortedIds = sortGanttSiblingTaskIds(selectedPlanTasks, draggableTaskIds);
    if (planLifecycle.mode === 'draft') {
      planLifecycle.reorderDraft(sortedIds);
      return;
    }
    if (planLifecycle.mode === 'saved') {
      toast.info('Saved plan order is immutable. Recalculate or return to Live before auto-sorting.');
      return;
    }
    await persistLiveOrder(sortedIds, true);
  }, [draggableTaskIds, persistLiveOrder, planLifecycle, selectedPlanTasks]);

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


  return (
    <div className="bg-white rounded-lg p-2">
      <div className="flex flex-col">
        {/* Toolbar */}
        <div className="flex flex-col gap-2 mb-4 border-b pb-2">
          {/* Row 1: Plan controls - right-aligned */}
          <div className="flex justify-end gap-2 items-center flex-wrap">
            <PlanLifecycleBar
              lifecycle={planLifecycle}
              truncatedCommitmentRules={schedulingConfig.truncatedCommitmentRules}
            />


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
                <option value="">All project members</option>
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

        {scheduleMode === 'MASTER_SCHEDULE' && (
          <div className="mb-2 text-sm" data-testid="master-catalog-state">
            {progressCatalog.loading ? (
              <span>Loading progress types…</span>
            ) : progressCatalog.error ? (
              <span className="text-red-700">Unable to load progress types. Master totals are unavailable.</span>
            ) : progressCatalog.items.length === 0 ? (
              <span>No progress types configured. <a className="underline" href={`/projects/${currentProjectId}?tab=settings`}>Open project settings</a>.</span>
            ) : null}
          </div>
        )}

        {/* One hierarchy/grid is the shared row source for labels and bars. */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="flex" ref={containerRef}>
            <div className="w-96 flex-shrink-0 border-r border-slate-200 bg-white" data-testid="gantt-name-column">
              <div className="h-[40px] border-b border-slate-200 bg-slate-50 grid grid-cols-[22px_18px_minmax(0,1fr)_76px_76px] items-center gap-1 px-2 sticky z-40 text-xs font-medium text-slate-500" style={{ top: '64px' }}>
                <span className="col-span-3">Task</span><span>Start</span><span>End</span>
              </div>
              <SortableContext
                items={gridRows
                  .filter((row): row is Extract<ScheduleGridRow, { kind: 'TASK' }> => row.kind === 'TASK')
                  .filter((row) => draggableTaskIds.has(row.task.task_id))
                  .map((row) => row.task.task_id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="relative" style={{ height: `${gridRowCount * rowHeight}px`, minHeight: `${6 * rowHeight}px` }}>
                  {gridRows.map((row, rowIndex) => {
                    if (row.kind === 'TASK') {
                      const allocation = taskAllocations[row.task.task_id];
                      const bounds = allocation && positiveWorkBounds(allocation.hoursPerDay);
                      return (
                        <SortableGanttTaskRow
                          key={row.key}
                          row={row}
                          rowIndex={rowIndex}
                          rowHeight={rowHeight}
                          hasChildren={rowHasChildren.get(row.key) ?? false}
                          collapsed={collapsedRows.has(row.key)}
                          startLabel={bounds?.start ?? (allocation ? 'Unscheduled' : '—')}
                          endLabel={bounds?.end ?? (allocation ? 'Unscheduled' : '—')}
                          onToggle={toggleRowCollapsed}
                          onTaskClick={(taskId) => handleTaskBarClick(taskId)}
                          draggable={planLifecycle.mode !== 'saved' && draggableTaskIds.has(row.task.task_id)}
                        />
                      );
                    }
                    const title = row.kind === 'HEADING' ? row.heading.title : row.group.name;
                    return (
                      <div key={row.key} className="absolute left-0 right-0 grid grid-cols-[40px_minmax(0,1fr)_76px_76px] items-center gap-1 px-2 border-b border-slate-100 font-semibold text-xs text-slate-800" style={{ top: `${rowIndex * rowHeight}px`, height: `${rowHeight}px` }} data-testid="gantt-name-row" data-depth={row.kind === 'HEADING' ? row.heading.depth : 0}>
                        {rowHasChildren.get(row.key) ? (
                          <button
                            type="button"
                            aria-label={`${collapsedRows.has(row.key) ? 'Expand' : 'Collapse'} ${title}`}
                            aria-expanded={!collapsedRows.has(row.key)}
                            data-testid="gantt-row-toggle"
                            onClick={() => toggleRowCollapsed(row.key)}
                            className="p-0.5 rounded hover:bg-slate-200 text-slate-600"
                          >
                            {collapsedRows.has(row.key) ? <ChevronRightIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
                          </button>
                        ) : <span />}
                        <span className="truncate">{title}</span><span>—</span><span>—</span>
                      </div>
                    );
                  })}
                </div>
              </SortableContext>
            </div>
            <div className="flex-1 min-w-0">
            {/* Date header - sticky, synced horizontal scroll with grid below */}
            <div
              className="sticky z-40 bg-white border-b border-slate-200 overflow-hidden"
              style={{ top: '64px' }}
              ref={ganttHeaderRef}
              data-testid="gantt-header-scroll"
              onScroll={syncDateScroll}
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
            <div className="overflow-x-auto" ref={ganttContentRef} data-testid="gantt-scroll" onScroll={syncDateScroll}>
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
                                <>
                                  <PhaseScheduleRow group={row.group} />
                                  {Object.entries(row.group.hours_per_day)
                                    .filter(([, hours]) => Number.isFinite(hours) && hours > 0)
                                    .map(([dateKey, hours]) => {
                                      const index = days.findIndex((day) => formatDateVN(day) === dateKey);
                                      return index < 0 ? null : (
                                        <div
                                          key={`${row.key}-${dateKey}`}
                                          data-testid="master-phase-day-segment"
                                          data-phase-id={row.group.phase_id ?? 'unclassified'}
                                          data-date={dateKey}
                                          data-hours={hours}
                                          className="absolute flex items-center justify-center rounded-sm border border-indigo-200 bg-indigo-100 text-[0.65rem] font-medium text-gray-800"
                                          style={{ left: `${index * dayWidth + 4}px`, top: '6px', width: `${dayWidth - 8}px`, height: '36px' }}
                                        >
                                          {Math.round(hours * 10) / 10}h
                                        </div>
                                      );
                                    })}
                                </>
                              )}
                            </div>
                          );
                        }

                        const task = row.task;
                        // Requirements 3/5/6: capacity-aware allocation with
                        // per-day hour splits when available.
                        const allocation = taskAllocations[task.task_id];
                        // Only explicit positive vector days are clipped to the viewport.
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

                        // Missing/zero allocation is explicit: never fabricate a
                        // continuous title bar from task dates or deadlines.
                        return null;
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
          <MemberDailyEffortMatrix
            members={schedulingConfig.resourceMembers}
            dates={days}
            taskEfforts={displayedTaskEfforts}
            scheduling={schedulingConfig}
            snapshotFrozen={planLifecycle.mode !== 'live'}
            dayWidth={dayWidth}
            scrollRef={matrixScrollRef}
            onScroll={syncDateScroll}
            scrollLeft={scrollLeftRef.current}
          />
        </DndContext>

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
