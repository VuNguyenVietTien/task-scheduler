import { Task, TaskStatus } from '@/types/task';
import { formatDateVN, isSameDay } from '@/lib/utils';
import type { CapacityResolver } from '@/utils/capacity';
import { TaskOrderItem } from '@/redux/features/taskOrderStore';
import { AppDispatch } from '@/redux/store';
import { initializeFromTasks, updateCalculatedDates, updateTaskOrderAndDates } from '@/redux/features/taskOrderStore';

// Constants for worker effort scheduling
export const WORK_HOURS_PER_DAY = 8; // Giờ làm việc trong ngày (8h)
export const WEEKEND_DAYS = [0, 6]; // Chủ nhật (0) và thứ bảy (6)

/**
 * Capacity-aware scheduling options (requirements 3 & 6).
 * - `capacity`: effective available hours per date for the assignee
 *   (weekday/weekend defaults + date overrides + days off). When omitted the
 *   legacy 8h weekday / 0h weekend rule applies.
 * - `reservedHours`: per-date hours already reserved by recurring
 *   commitments (meetings) for the assignee; subtracted BEFORE finite tasks
 *   are allocated, so commitments always win over priority tasks.
 */
export interface ScheduleOptions {
  capacity?: CapacityResolver;
  reservedHours?: Record<string, number>;
  /** Per-assignee overrides (preferred when members differ). */
  capacityFor?: (assigneeId: string) => CapacityResolver | undefined;
  reservedFor?: (assigneeId: string) => Record<string, number> | undefined;
}

export function calculateTaskDates(tasks: Task[]): Task[] {
  if (!tasks || !Array.isArray(tasks)) {
    return [];
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    // If both tasks have start dates, sort by date
    if (a.start_date && b.start_date) {
      return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
    }

    // If neither has a start date, sort by priority order
    if (!a.start_date && !b.start_date) {
      return a.priority_order - b.priority_order;
    }

    // Tasks with start dates come first
    if (!a.start_date) return 1;
    if (!b.start_date) return -1;

    return 0;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const processedTasks: Task[] = [];
  let lastEndDate: Date | null = null;

  sortedTasks.forEach(task => {
    const updatedTask = { ...task };
    const daysNeeded = Math.ceil((task.effort || WORK_HOURS_PER_DAY) / WORK_HOURS_PER_DAY);

    // Case 1: Task has both startDate and deadline
    if (task.start_date && task.deadline) {
      return;
    }

    // Case 2: Task has only deadline
    if (task.deadline && !task.start_date) {
      const endDate = new Date(task.deadline);
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - daysNeeded + 1);
      updatedTask.start_date = startDate.toISOString();
    }
    // Case 3: Task has only startDate
    else if (task.start_date && !task.deadline) {
      const startDate = new Date(task.start_date);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + daysNeeded - 1);
      updatedTask.deadline = endDate.toISOString();
    }
    // Case 4: Task has neither
    else {
      let startDate: Date;

      if (lastEndDate) {
        // Start after the previous task
        startDate = new Date(lastEndDate);
        startDate.setDate(startDate.getDate() + 1);
      } else {
        // Start from today
        startDate = new Date(today);
      }

      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + daysNeeded - 1);

      updatedTask.start_date = startDate.toISOString();
      updatedTask.deadline = endDate.toISOString();
      lastEndDate = endDate;
    }

    if (updatedTask.deadline) {
      lastEndDate = new Date(updatedTask.deadline);
    }

    processedTasks.push(updatedTask);
  });

  return processedTasks.sort((a, b) => {
    // Sort by start date if both have it
    if (a.start_date && b.start_date) {
      return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
    }

    // Sort by priority order for tasks without dates
    if (!a.start_date && !b.start_date) {
      return a.priority_order - b.priority_order;
    }

    // Tasks with dates come first
    if (!a.start_date) return 1;
    if (!b.start_date) return -1;

    return 0;
  });
}

// Kiểm tra ngày có phải là ngày cuối tuần
export const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return WEEKEND_DAYS.includes(day);
};

// Lấy ngày làm việc tiếp theo (bỏ qua cuối tuần)
export const getNextWorkDay = (date: Date): Date => {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  // Bỏ qua ngày cuối tuần
  while (isWeekend(nextDay)) {
    nextDay.setDate(nextDay.getDate() + 1);
  }
  return nextDay;
};

// Tính số giờ làm việc cần thiết trong ngày
export const getWorkHoursInDay = (remainingEffort: number): number => {
  return Math.min(remainingEffort, WORK_HOURS_PER_DAY); // Tối đa 8h/ngày
};

// Struct để theo dõi thời gian làm việc còn lại của mỗi ngày
export interface WorkSchedule {
  // Key: yyyy-MM-dd, Value: Số giờ còn lại trong ngày (WORK_HOURS_PER_DAY - đã sử dụng)
  [date: string]: number;
}

// Hàm tìm thời gian bắt đầu khả dụng cho task tiếp theo (dựa trên người được gán)
export const findNextAvailableStartDate = (
  assigneeId: string | undefined,
  lastTaskEndTime: Record<string, Date>,
  currentTime: Date,
  taskPriority?: string
): Date => {
  console.log(`Tìm ngày bắt đầu khả dụng cho assignee: ${assigneeId || 'unassigned'}, Priority: ${taskPriority || 'unknown'}`);
  console.log(`  - Ngày hiện tại: ${formatDateVN(currentTime)}`);

  // Không ưu tiên task urgent nữa - xử lý tất cả các task như nhau

  // Nếu không có assigneeId hoặc không có lịch sử kết thúc của người này, bắt đầu từ ngày hiện tại
  if (!assigneeId || !lastTaskEndTime[assigneeId]) {
    console.log(`  - Không có lịch sử cho assignee này, bắt đầu từ: ${formatDateVN(currentTime)}`);

    // Luôn bắt đầu từ ngày hiện tại hoặc ngày làm việc tiếp theo
    // Nếu là cuối tuần, chuyển sang ngày làm việc tiếp theo
    let startDate = new Date(currentTime);
    if (isWeekend(startDate)) {
      let nextWorkDay = getNextWorkDay(startDate);
      console.log(`  - Ngày hiện tại là cuối tuần, chuyển sang ngày làm việc tiếp theo: ${formatDateVN(nextWorkDay)}`);
      return nextWorkDay;
    }

    return startDate;
  }

  // Nếu có lịch sử kết thúc, bắt đầu sau ngày kết thúc gần nhất
  const userLastEndTime = lastTaskEndTime[assigneeId];
  console.log(`  - Ngày kết thúc gần nhất của assignee: ${formatDateVN(userLastEndTime)}`);

  // Nếu ngày kết thúc gần nhất là sau ngày hiện tại, bắt đầu từ ngày đó
  // Ngược lại, bắt đầu từ ngày hiện tại
  let startDate = userLastEndTime > currentTime ? userLastEndTime : currentTime;

  // Đảm bảo ngày bắt đầu không phải là cuối tuần
  if (isWeekend(startDate)) {
    startDate = getNextWorkDay(startDate);
    console.log(`  - Ngày bắt đầu dự kiến là cuối tuần, chuyển sang: ${formatDateVN(startDate)}`);
  } else {
    console.log(`  - Ngày bắt đầu dự kiến: ${formatDateVN(startDate)}`);
  }

  return startDate;
};

// Tính thời điểm kết thúc của task dựa trên effort và thời gian làm việc còn lại
export const calculateTaskSchedule = (
  startDate: Date,
  effort: number,
  workSchedule: WorkSchedule = {},
  capacity?: CapacityResolver
): { endDate: Date, updatedSchedule: WorkSchedule, hoursPerDay: Record<string, number>, exhausted?: boolean } => {
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


  let currentDay = 0; // Số ngày đã xử lý

  // R3 edge guard: a member with zero capacity for the whole reachable
  // horizon (all days off / 0h overrides) must not loop forever. Bounded
  // scan; exhaustion is REPORTED (exhausted: true), never a silent drop of
  // remaining effort.
  const MAX_SCHEDULING_DAYS = 730;
  let exhausted = false;

  while (remainingEffort > 0) {
    if (currentDay > MAX_SCHEDULING_DAYS) {
      // Horizon exhausted with effort remaining — report, don't hang/drop silently.
      console.warn(
        `  ! Scheduling horizon exhausted after ${MAX_SCHEDULING_DAYS} days with ${remainingEffort}h remaining`
      );
      exhausted = true;
      break;
    }
    // Tạo bản sao của ngày hiện tại để tránh thay đổi trực tiếp
    const processingDate = new Date(currentDate);
    processingDate.setDate(processingDate.getDate() + currentDay);

    // Ngày 0h (cuối tuần mặc định hoặc ngày nghỉ / override = 0): bỏ qua,
    // KHÔNG có thanh task ngày đó (requirement 3).
    if (capacity ? capacity(processingDate) <= 0 : isWeekend(processingDate)) {
      // Bỏ qua việc tính giờ làm cho ngày cuối tuần, tăng ngày và tiếp tục vòng lặp
      console.log(`  - Bỏ qua ngày 0 giờ: ${formatDateVN(processingDate)}`);
      currentDay++;
      continue;
    }

    const dateStr = formatDateVN(processingDate);
    lastWorkDate = new Date(processingDate); // Cập nhật ngày làm việc cuối cùng

    // Số giờ còn lại trong ngày này (mặc định WORK_HOURS_PER_DAY nếu chưa có ai dùng,
    // hoặc theo capacity resolver khi cấu hình theo member)
    const availableHoursInDay = updatedSchedule[dateStr] !== undefined
      ? updatedSchedule[dateStr]
      : (capacity ? capacity(processingDate) : WORK_HOURS_PER_DAY);

    if (availableHoursInDay <= 0) {
      // Ngày đã hết giờ làm việc, chuyển sang ngày tiếp theo
      console.log(`  - Ngày ${dateStr} đã hết giờ làm việc, chuyển ngày tiếp theo`);
      currentDay++;
      continue;
    }

    // Tính toán số giờ làm việc trong ngày này (tối đa là số giờ còn lại trong ngày)
    const hoursForThisDay = Math.min(remainingEffort, availableHoursInDay);

    // Log để debug
    console.log(`  - Ngày ${dateStr}: ${hoursForThisDay}h (còn lại: ${remainingEffort - hoursForThisDay}h)`);

    // Lưu số giờ task chiếm trong ngày
    hoursPerDay[dateStr] = hoursForThisDay;

    // Cập nhật số giờ còn lại trong ngày
    updatedSchedule[dateStr] = availableHoursInDay - hoursForThisDay;

    // Cập nhật effort còn lại
    remainingEffort -= hoursForThisDay;

    // Nếu đã sử dụng hết effort, không cần tăng ngày nữa
    if (remainingEffort <= 0) {
      break;
    }

    // Tăng ngày để xử lý ngày tiếp theo
    currentDay++;
  }

  console.log(`  => Kết thúc vào: ${formatDateVN(lastWorkDate)}`);

  // Trả về ngày làm việc cuối cùng làm ngày kết thúc
  return {
    endDate: lastWorkDate,
    updatedSchedule,
    hoursPerDay,
    ...(exhausted ? { exhausted: true } : {})
  };
};

// Hàm chuyển đổi từ TaskOrderItem sang Task
export const convertTaskOrderToTask = (item: TaskOrderItem, projectId: string): Task => {
  return {
    task_id: item.taskId,
    id: item.taskId,
    title: item.title || 'Unknown',
    priority: item.priority || 'MEDIUM',
    priority_order: item.priorityOrder,
    status: item.status || 'TODO',
    effort: item.effort || 0,
    assignee: item.assigneeId ? {
      userId: item.assigneeId,
      username: item.assigneeName || item.assigneeId
    } : undefined,
    start_date: item.startDate,
    due_date: item.endDate,
    project_id: projectId || '',
    type: item.type as any,
    category: item.category as any,
    progress_type: item.progressType as any,
    progress: item.progress,
    created_by: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  } as Task;
};

// Hàm sắp xếp tasks theo priority
export const sortTasksByPriority = (tasks: Task[]): Task[] => {
  const priorityOrder: Record<string, number> = {
    CRITICAL: 0,
    URGENT: 1,  // Ưu tiên cao nhất
    HIGH: 2,
    MEDIUM: 3,
    LOW: 4
  };

  return [...tasks].sort((a, b) => {
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
};

// Hàm cập nhật date vào Redux store sử dụng single action
export const updateReduxStore = (
  tasks: Task[],
  dispatch: AppDispatch,
  dateUpdates: { taskId: string, startDate: string, endDate: string }[] = []
) => {
  // Chuyển đổi từ Task[] sang TaskOrderItem[]
  const orderItems = tasks.map((task, index) => ({
    taskId: task.task_id,
    title: task.title,
    priorityOrder: task.priority_order || index,
    startDate: task.start_date,
    endDate: task.due_date,
    effort: task.effort,
    assigneeId: task.assignee?.userId,
    assigneeName: task.assignee?.username,
    priority: task.priority,
    status: task.status,
    type: task.type,
    category: task.category,
    progressType: task.progress_type,
    progress: task.progress,
    fromPlan: false
  }));

  // Nếu không có dateUpdates, tạo từ tasks
  if (dateUpdates.length === 0 && tasks.length > 0) {
    dateUpdates = tasks
      .filter(task => task.start_date && task.due_date) // Đảm bảo cả 2 đều tồn tại
      .map(task => ({
        taskId: task.task_id,
        startDate: task.start_date as string, // Type assertion để xác nhận không phải undefined
        endDate: task.due_date as string      // Type assertion để xác nhận không phải undefined
      }));
  }

  // Dispatch action kết hợp để cập nhật cả thứ tự và dates trong một lần
  dispatch(updateTaskOrderAndDates({
    tasks: orderItems,
    dateUpdates: dateUpdates
  }));
};

// Sửa lại hàm processTasks để tích hợp với Redux
export const processTasksAndUpdateStore = (
  inputTasks: Task[],
  keepOrder: boolean = false,
  dispatch: AppDispatch,
  options?: ScheduleOptions
): Task[] => {
  // Sử dụng trực tiếp inputTasks mà không sắp xếp lại
  let tasksToProcess: Task[] = [...inputTasks];

  // Đảm bảo priority_order được cập nhật chính xác theo thứ tự đầu vào
  if (!keepOrder) {
    // Chỉ cập nhật priority_order nếu không giữ thứ tự
    tasksToProcess = tasksToProcess.map((task, index) => ({
      ...task,
      priority_order: index + 1
    }));
  }

  // XỬ LÝ TASK - Thay thế phần này thay vì gọi processTasks
  // Bắt đầu xử lý từng task từ tasksToProcess để tính start_date và end_date
  let completedTasks: Task[] = [];
  let activeTasks: Task[] = [];

  // Lấy ngày hiện tại
  const currentDate = new Date();
  // Đảm bảo thời gian hiện tại về 00:00:00 để so sánh chính xác
  currentDate.setHours(0, 0, 0, 0);

  // Lọc các task đã hoàn thành và chưa hoàn thành
  tasksToProcess.forEach(task => {
    if (task.status === 'DONE') {
      completedTasks.push(task);
    } else {
      activeTasks.push(task);
    }
  });


  // Map để lưu trữ thông tin về start_date từ database (chỉ dùng khi cần)
  const originalStartDates = new Map<string, string | undefined>();

  // Lưu lại start_date gốc từ database của mỗi task nếu cần
  activeTasks.forEach(task => {
    // Chỉ lưu start_date từ database nếu được đánh dấu
    if (task.db_start_date) {
      originalStartDates.set(task.task_id, task.db_start_date);
    }
  });

  // Mảng 2 chiều để theo dõi lịch làm việc theo ngày và assignee
  interface WorkDay {
    date: Date;
    remainingHours: number; // Số giờ còn lại trong ngày (tối đa WORK_HOURS_PER_DAY)
  }

  // Theo dõi lịch làm việc cho mỗi assignee
  interface AssigneeSchedule {
    [assigneeId: string]: {
      workDays: WorkDay[];
      lastTaskEndDate: Date | null;
    }
  }

  const assigneeSchedules: AssigneeSchedule = {};

  // Khởi tạo lịch làm việc cho các assignee
  const uniqueAssignees = new Set<string>();
  activeTasks.forEach(task => {
    const assigneeId = task.assignee?.userId || 'unassigned';
    uniqueAssignees.add(assigneeId);
  });

  uniqueAssignees.forEach(assigneeId => {
    assigneeSchedules[assigneeId] = {
      workDays: [],
      lastTaskEndDate: null
    };
  });

  // Tạo hàm helper để tìm ngày làm việc tiếp theo (0 giờ được bỏ qua:
  // cuối tuần mặc định hoặc capacity = 0 theo cấu hình member)
  const capacityOf = (assigneeId: string): CapacityResolver | undefined =>
    options?.capacityFor?.(assigneeId) ?? options?.capacity;
  const reservedOf = (assigneeId: string): Record<string, number> | undefined =>
    options?.reservedFor?.(assigneeId) ?? options?.reservedHours;
  const dayHoursFor = (assigneeId: string) => (date: Date): number => {
    const cap = capacityOf(assigneeId);
    return cap ? cap(date) : (isWeekend(date) ? 0 : WORK_HOURS_PER_DAY);
  };
  const findNextWorkDay = (date: Date, assigneeId: string): Date => {
    const dayHours = dayHoursFor(assigneeId);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    // Bỏ qua ngày 0 giờ (cuối tuần legacy hoặc capacity = 0)
    while (dayHours(nextDay) <= 0) {
      nextDay.setDate(nextDay.getDate() + 1);
    }
    return nextDay;
  };

  // Hàm helper để lấy hoặc tạo workDay mới cho assignee
  const getOrCreateWorkDay = (assigneeId: string, date: Date): WorkDay => {
    const schedule = assigneeSchedules[assigneeId];

    // Tìm workDay cho ngày này
    const existingDay = schedule.workDays.find(day =>
      isSameDay(day.date, date)
    );

    if (existingDay) {
      return existingDay;
    }

    // Tạo workDay mới: capacity theo cấu hình (mặc định 8h), trừ đi giờ đã
    // đặt trước bởi recurring commitments (meetings) của assignee này.
    const reserved = reservedOf(assigneeId)?.[formatDateVN(date)] ?? 0;
    const newWorkDay: WorkDay = {
      date: new Date(date),
      remainingHours: Math.max(0, dayHoursFor(assigneeId)(date) - reserved)
    };

    schedule.workDays.push(newWorkDay);
    return newWorkDay;
  };

  // Xử lý từng task trong danh sách đã sắp xếp
  const processedTasks: Task[] = [];
  const dateUpdates: { taskId: string, startDate: string, endDate: string }[] = [];

  for (let i = 0; i < activeTasks.length; i++) {
    const task = activeTasks[i];
    const assigneeId = task.assignee?.userId || 'unassigned';
    let updatedTask = { ...task };

    console.log(`Xử lý task thứ ${i + 1}: ${task.title} (${task.priority})`);

    // Tìm thời gian bắt đầu khả dụng cho task này
    let startDate: Date;

    // Kiểm tra nếu task có start_date cố định từ database VÀ không cần tính toán lại
    if (task.db_start_date && !task.force_recalculate) {
      console.log(`Task ${task.title} giữ nguyên start_date cố định từ DB: ${task.db_start_date}`);
      startDate = new Date(task.db_start_date);

      // Ghi nhớ đây là start_date từ DB
      updatedTask.db_start_date = task.db_start_date;
    } else {
      // Mọi trường hợp khác đều tính toán lại start_date dựa trên thứ tự trong danh sách
      console.log(`Task ${task.title} tính toán lại start_date dựa trên thứ tự trong danh sách`);

      // Kiểm tra assignee có lịch sử kết thúc task không
      const assigneeSchedule = assigneeSchedules[assigneeId];

      if (assigneeSchedule.lastTaskEndDate) {
        // Bắt đầu từ ngày kết thúc task cuối cùng của assignee này
        startDate = new Date(assigneeSchedule.lastTaskEndDate);

        // Kiểm tra xem có cần chuyển sang ngày làm việc tiếp theo không
        const lastWorkDay = assigneeSchedule.workDays.find(day =>
          isSameDay(day.date, startDate)
        );

        if (lastWorkDay && lastWorkDay.remainingHours <= 0) {
          // Nếu ngày này đã hết giờ làm việc, chuyển sang ngày tiếp theo
          startDate = findNextWorkDay(startDate, assigneeId);
          console.log(`- Ngày cuối cùng đã hết giờ, chuyển đến: ${formatDateVN(startDate)}`);
        }
      } else {
        // Nếu không có lịch sử, bắt đầu từ ngày hiện tại
        startDate = new Date(currentDate);

        // Nếu là ngày 0 giờ (cuối tuần / ngày nghỉ), chuyển sang ngày làm việc tiếp theo
        if (dayHoursFor(assigneeId)(startDate) <= 0) {
          startDate = findNextWorkDay(startDate, assigneeId);
          console.log(`- Ngày hiện tại là 0 giờ, chuyển đến: ${formatDateVN(startDate)}`);
        }
      }
    }

    // Lấy effort thực tế, mặc định là 0 nếu không có
    const taskEffort = task.effort !== undefined ? task.effort : 0;

    // Xử lý lịch trình làm việc theo mảng 2 chiều
    let remainingEffort = taskEffort;
    let endDate = new Date(startDate);
    const hoursPerDay: Record<string, number> = {};

    // Nếu task không có effort, đánh dấu kết thúc cùng ngày với bắt đầu
    if (remainingEffort <= 0) {
      console.log(`Task ${task.title} không có effort, kết thúc cùng ngày bắt đầu: ${formatDateVN(startDate)}`);
      hoursPerDay[formatDateVN(startDate)] = 0;
    } else {
      // Xử lý từng ngày cho đến khi hết effort
      let currentDay = startDate;

      while (remainingEffort > 0) {
        // Bỏ qua ngày 0 giờ (cuối tuần legacy / capacity 0 / ngày nghỉ)
        if (dayHoursFor(assigneeId)(currentDay) <= 0) {
          currentDay = findNextWorkDay(currentDay, assigneeId);
          continue;
        }

        // Lấy hoặc tạo workDay cho ngày này
        const workDay = getOrCreateWorkDay(assigneeId, currentDay);

        // Tính toán số giờ có thể làm trong ngày này
        const hoursForThisDay = Math.min(remainingEffort, workDay.remainingHours);

        if (hoursForThisDay <= 0) {
          // Ngày này đã hết giờ, chuyển sang ngày tiếp theo
          currentDay = findNextWorkDay(currentDay, assigneeId);
          continue;
        }

        // Đánh dấu số giờ đã sử dụng
        const dateStr = formatDateVN(currentDay);
        hoursPerDay[dateStr] = hoursForThisDay;

        // Cập nhật giờ còn lại trong ngày
        workDay.remainingHours -= hoursForThisDay;

        // Cập nhật effort còn lại
        remainingEffort -= hoursForThisDay;

        // Đánh dấu ngày kết thúc
        endDate = new Date(currentDay);

        // Nếu còn effort, chuyển sang ngày tiếp theo
        if (remainingEffort > 0) {
          currentDay = findNextWorkDay(currentDay, assigneeId);
        }
      }
    }

    // Cập nhật thời gian kết thúc mới nhất cho assignee
    assigneeSchedules[assigneeId].lastTaskEndDate = new Date(endDate);

    // Lưu lịch trình của task - đảm bảo taskId không bao giờ là undefined
    const taskId = task.task_id || task.id || `task-${i}`;

    console.log(`Task ${task.title} (${taskEffort}h):`, {
      startDate: formatDateVN(startDate),
      endDate: formatDateVN(endDate),
      hoursPerDay: Object.entries(hoursPerDay).map(([date, hours]) => `${date}: ${hours}h`).join(', ')
    });

    updatedTask.start_date = formatDateVN(startDate);
    updatedTask.due_date = formatDateVN(endDate);

    // Lưu vào mảng dateUpdates để cập nhật store
    dateUpdates.push({
      taskId: taskId,
      startDate: formatDateVN(startDate),
      endDate: formatDateVN(endDate)
    });

    // Đảm bảo xóa flag force_recalculate sau khi đã tính toán lại
    if (updatedTask.force_recalculate) {
      updatedTask.force_recalculate = false;
    }

    processedTasks.push(updatedTask);
  }

  // Kết hợp lại với các task đã hoàn thành
  const allProcessedTasks = [...processedTasks, ...completedTasks];

  // Tạo mảng dateUpdates từ kết quả xử lý
  console.log(`Cập nhật ${dateUpdates.length} ngày tháng vào store:`);
  dateUpdates.forEach((update, index) => {
    const task = allProcessedTasks.find(t => t.task_id === update.taskId);
    if (task) {
      console.log(`  ${index + 1}. ${task.title} (${task.priority}): ${update.startDate} đến ${update.endDate}`);
    }
  });

  // Chuyển đổi từ Task[] sang TaskOrderItem[] - GIỮ ĐÚNG THỨ TỰ của processedTasks
  const orderItems = allProcessedTasks.map((task, index) => ({
    taskId: task.task_id,
    title: task.title,
    priorityOrder: task.priority_order || index + 1,
    startDate: task.start_date,
    endDate: task.due_date,
    effort: task.effort,
    assigneeId: task.assignee?.userId,
    assigneeName: task.assignee?.username,
    priority: task.priority,
    status: task.status,
    type: task.type,
    category: task.category,
    progressType: task.progress_type,
    progress: task.progress,
    fromPlan: false
  }));

  // Tìm component gọi hàm này bằng cách phân tích stack trace
  const stackTrace = new Error().stack || '';
  const callerInfo = stackTrace.split('\n')[2] || 'unknown'; // Dòng thứ 3 thường là caller

  // Dispatch action kết hợp để cập nhật cả thứ tự và dates trong một lần
  dispatch(updateTaskOrderAndDates({
    tasks: orderItems,
    dateUpdates: dateUpdates
  }));

  // Trả về các tasks đã xử lý
  return allProcessedTasks;
};

// Thêm một hàm mới để kiểm tra và xử lý tasks dựa trên việc có plan hay không
export const processTasksBasedOnPlan = (
  tasks: Task[],
  hasActivePlan: boolean,
  dispatch: AppDispatch
): void => {
  if (!tasks || tasks.length === 0) {
    console.log('Không có tasks để xử lý');
    return;
  }

  console.log(`Xử lý ${tasks.length} tasks dựa trên plan:`, hasActivePlan ? 'Có active plan' : 'Không có active plan');

  if (hasActivePlan) {
    // Nếu có active plan, hệ thống đã load dữ liệu vào TaskOrderStore qua extraReducers
    console.log('Đã có active plan, dữ liệu sẽ được tự động cập nhật thông qua reducer');

    // KHÔNG GỌI THÊM initializeFromTasks khi đã có active plan vì sẽ gây duplicate
    // Chỉ log thông báo
    console.log('Đã có active plan, bỏ qua việc gọi initializeFromTasks để tránh duplicate');

    // KHÔNG ĐƯỢC gọi processTasksAndUpdateStore khi đã có active plan
    // vì sẽ gây ra duplicate tasks trong store
    console.log('Đã có active plan, chỉ bổ sung task mới, không tính toán lại để tránh duplicate');
  } else {
    // Nếu không có active plan, sử dụng processTasksAndUpdateStore và sắp xếp theo priority
    console.log('Không có active plan, tính toán ngày dựa trên thứ tự priority');

    // Nếu không cần tính toán lại, vẫn cần cập nhật store với định dạng của TaskOrderItem
    dispatch(initializeFromTasks({
      tasks,
      autoSort: true
    }));

    // Kiểm tra xem có task nào được đánh dấu force_recalculate không
    const needsRecalculation = tasks.some(task => task.force_recalculate);

    // Nếu có task cần tính toán lại hoặc chưa có task nào có start_date và due_date
    const needsInitialCalculation = tasks.some(task => !task.start_date || !task.due_date);

    if (needsRecalculation || needsInitialCalculation) {
      // Sắp xếp task theo priority trước khi tính toán ngày
      console.log('Sắp xếp tasks theo priority trước khi tính toán ngày');
      const sortedTasks = sortTasksByPriority(tasks);
      console.log('Thứ tự tasks sau khi sắp xếp theo priority:');
      sortedTasks.forEach((task, idx) => {
        console.log(`  ${idx + 1}. ${task.title} (${task.priority})`);
      });

      // Chỉ thực hiện sắp xếp và tính toán một lần duy nhất
      // Dùng keepOrder=true để giữ nguyên thứ tự đã sắp xếp theo priority
      processTasksAndUpdateStore(sortedTasks, true, dispatch);
    }
  }
};
