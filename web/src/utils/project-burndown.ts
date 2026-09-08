import type { Task } from '@/types/task';

const EXCLUDED_STATUSES = new Set(['REJECTED', 'ARCHIVED']);
const COMPLETED_STATUSES = new Set(['DONE', 'CLOSE']);
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export interface BurndownPlanTask {
  taskId: string;
  startDate?: string;
  endDate?: string;
  parentTaskId?: string | null;
  status?: string;
  unscheduled?: boolean;
}

export interface BurndownContextTask {
  taskId: string;
  parentTaskId?: string | null;
}

export interface BurndownPoint {
  date: string;
  plannedRemaining: number;
  actualRemaining: number | null;
}

export interface ProjectBurndown {
  points: BurndownPoint[];
  totalTasks: number;
  plannedRemaining: number;
  actualRemaining: number;
  delta: number;
  indicator: 'ahead' | 'on-track' | 'behind' | 'unavailable';
  scheduledRange: { start: string; end: string } | null;
  excludedCount: number;
  summaryCount: number;
  unscheduledCount: number;
  missingCurrentTaskCount: number;
  completedWithoutActualEndCount: number;
  completedEarlyCount: number;
  completedOnTimeCount: number;
  completedLateCount: number;
  unplannedTaskCount: number;
  zeroEffortCount: number;
}

function calendarDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = value.slice(0, 10);
  if (!DATE_KEY.test(key)) return null;
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? key : null;
}

function shiftDate(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let date = from; date <= to; date = shiftDate(date, 1)) dates.push(date);
  return dates;
}

function selectedSummaryIds(tasks: readonly BurndownPlanTask[], context: readonly BurndownContextTask[]): Set<string> {
  const selected = new Set(tasks.map((task) => task.taskId));
  const parents = new Map([...context, ...tasks].map((task) => [task.taskId, task.parentTaskId]));
  const summaries = new Set<string>();
  for (const task of tasks) {
    const visited = new Set<string>();
    let parentId = parents.get(task.taskId);
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      if (selected.has(parentId)) summaries.add(parentId);
      parentId = parents.get(parentId);
    }
  }
  return summaries;
}

function currentLeafTasks(tasks: readonly Task[]): Task[] {
  const parentIds = new Set(tasks.map((task) => task.parent_task_id).filter((id): id is string => Boolean(id)));
  return tasks.filter((task) => !parentIds.has(task.task_id));
}

/** Build an immutable saved-plan baseline and an actual curve from canonical actual-end evidence only. */
export function buildProjectBurndown(
  planTasks: readonly BurndownPlanTask[],
  currentTasks: readonly Task[],
  asOf: string,
  contextTasks: readonly BurndownContextTask[] = []
): ProjectBurndown {
  const today = calendarDate(asOf);
  if (!today) throw new Error('Invalid burndown as-of date');

  const uniquePlanTasks = Array.from(new Map(planTasks.map((task) => [task.taskId, task])).values());
  const currentById = new Map(currentTasks.map((task) => [task.task_id, task]));
  const summaries = selectedSummaryIds(uniquePlanTasks, contextTasks);
  let excludedCount = 0;
  let summaryCount = 0;
  let unscheduledCount = 0;

  const executable = uniquePlanTasks.filter((planTask) => {
    const status = (currentById.get(planTask.taskId)?.status ?? planTask.status ?? '').toUpperCase();
    if (EXCLUDED_STATUSES.has(status)) {
      excludedCount += 1;
      return false;
    }
    if (summaries.has(planTask.taskId)) {
      summaryCount += 1;
      return false;
    }
    return true;
  });

  const scheduled = executable.filter((task) => {
    const valid = Boolean(calendarDate(task.endDate)) && !task.unscheduled;
    if (!valid) unscheduledCount += 1;
    return valid;
  });
  const actualEnds = new Map<string, string | null>();
  let missingCurrentTaskCount = 0;
  let completedWithoutActualEndCount = 0;
  let completedEarlyCount = 0;
  let completedOnTimeCount = 0;
  let completedLateCount = 0;
  let zeroEffortCount = 0;

  for (const planTask of scheduled) {
    const current = currentById.get(planTask.taskId);
    if (!current) missingCurrentTaskCount += 1;
    const actualEnd = calendarDate(current?.actual_end_date);
    actualEnds.set(planTask.taskId, actualEnd);
    if (actualEnd && actualEnd <= today) {
      const plannedEnd = calendarDate(planTask.endDate)!;
      if (actualEnd < plannedEnd) completedEarlyCount += 1;
      else if (actualEnd > plannedEnd) completedLateCount += 1;
      else completedOnTimeCount += 1;
    }
    if (current && COMPLETED_STATUSES.has(current.status.toUpperCase()) && !actualEnd) completedWithoutActualEndCount += 1;
    if (current?.effort === 0) zeroEffortCount += 1;
  }

  const planIds = new Set(uniquePlanTasks.map((task) => task.taskId));
  const unplannedTaskCount = currentLeafTasks(currentTasks).filter((task) =>
    !planIds.has(task.task_id) && !EXCLUDED_STATUSES.has(task.status.toUpperCase())
  ).length;

  const plannedEnds = scheduled.map((task) => calendarDate(task.endDate)!);
  const plannedStarts = scheduled.map((task) => calendarDate(task.startDate)).filter((date): date is string => Boolean(date));
  const evidencedActualEnds = Array.from(actualEnds.values()).filter((date): date is string => Boolean(date));
  const totalTasks = scheduled.length;
  const plannedRemaining = scheduled.filter((task) => calendarDate(task.endDate)! > today).length;
  const actualRemaining = scheduled.filter((task) => !actualEnds.get(task.taskId) || actualEnds.get(task.taskId)! > today).length;
  const delta = actualRemaining - plannedRemaining;
  const incomplete = unscheduledCount > 0 || missingCurrentTaskCount > 0;
  const indicator = incomplete ? 'unavailable' : delta < 0 ? 'ahead' : delta > 0 ? 'behind' : 'on-track';

  if (!totalTasks) {
    return {
      points: [], totalTasks, plannedRemaining, actualRemaining, delta, indicator: 'unavailable', scheduledRange: null,
      excludedCount, summaryCount, unscheduledCount, missingCurrentTaskCount,
      completedWithoutActualEndCount, completedEarlyCount, completedOnTimeCount, completedLateCount,
      unplannedTaskCount, zeroEffortCount,
    };
  }

  const earliest = [...plannedStarts, ...plannedEnds, ...evidencedActualEnds, today].sort()[0];
  const latest = [...plannedEnds, ...evidencedActualEnds.filter((date) => date <= today), today].sort().at(-1)!;
  const points = dateRange(shiftDate(earliest, -1), latest).map((date) => ({
    date,
    plannedRemaining: scheduled.filter((task) => calendarDate(task.endDate)! > date).length,
    actualRemaining: date <= today
      ? scheduled.filter((task) => !actualEnds.get(task.taskId) || actualEnds.get(task.taskId)! > date).length
      : null,
  }));

  return {
    points, totalTasks, plannedRemaining, actualRemaining, delta, indicator,
    scheduledRange: { start: plannedEnds.sort()[0], end: plannedEnds.sort().at(-1)! },
    excludedCount, summaryCount, unscheduledCount, missingCurrentTaskCount,
    completedWithoutActualEndCount, completedEarlyCount, completedOnTimeCount, completedLateCount,
    unplannedTaskCount, zeroEffortCount,
  };
}
