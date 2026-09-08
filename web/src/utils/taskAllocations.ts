/**
 * Capacity-aware task allocation (R3/R5/R6) — extracted from Timeline so the
 * scheduling HORIZON is explicit and viewport-independent (manager review).
 *
 * Horizon rule: allocation ALWAYS runs on [horizonFrom, horizonEnd]
 * (typically today → today + SCHEDULING_HORIZON_DAYS), regardless of the
 * visible date range. Commitments are seeded across the whole horizon so a
 * task that spills past the viewport still has meeting hours subtracted, and
 * scrolling (viewport change) can never change an allocation.
 */
import { calculateTaskSchedule, type WorkSchedule } from '@/utils/taskScheduler';
import type { CapacityResolver } from '@/utils/capacity';
import { buildGanttTaskSummaries } from '@/utils/ganttRows';

export const SCHEDULING_HORIZON_DAYS = 365;

export interface AllocatableTask {
  task_id?: string;
  id?: string;
  status?: string;
  assignee_user_id?: string | null;
  /** Direct resource-member assignment (placeholder allowed). Preferred
   * scheduling key when present (herdr-260906 R5). */
  assignee_resource_member_id?: string | null;
  start_date?: string | null;
  parent_task_id?: string | null;
  effort?: number | null;
  [k: string]: unknown;
}

export interface AllocationConfig {
  capacityFor(memberKey: string): CapacityResolver;
  reservedFor(memberKey: string, from: string, to: string): Record<string, number>;
  /** Maps a task assignee userId → resource_member key (unlinked →
   * 'unassigned'); see useProjectSchedulingConfig.memberKeyFor. */
  memberKeyFor(userId?: string | null): string;
}

export interface TaskAllocation {
  start: Date;
  end: Date;
  hoursPerDay: Record<string, number>;
}

/** Positive work, not the requested span, owns rendered date bounds. */
export function positiveWorkBounds(hoursPerDay: Record<string, number>): { start: string; end: string } | null {
  const dates = Object.keys(hoursPerDay).filter(date => Number.isFinite(hoursPerDay[date]) && hoursPerDay[date] > 0).sort();
  return dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null;
}

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}
export function fmt(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Explicit horizon: [max(today, earliestNeed), today + 365d] at minimum. */
export function schedulingHorizon(
  today: Date,
  viewportFrom?: Date,
  viewportTo?: Date
): { from: string; to: string } {
  const from = new Date(today);
  from.setHours(0, 0, 0, 0);
  let to = addDays(from, SCHEDULING_HORIZON_DAYS);
  if (viewportTo && viewportTo > to) to = viewportTo; // long viewports extend it
  return { from: fmt(from), to: fmt(to) };
}

export function isTaskScheduleEligible(status?: string | null): boolean {
  return !['DONE', 'CLOSE', 'REJECTED', 'ARCHIVED'].includes(status?.toUpperCase() ?? '');
}

export interface AllocationResult {
  allocations: Record<string, TaskAllocation>;
  /** Tasks whose effort could NOT be fully scheduled inside the horizon
   * (zero capacity / horizon exhausted). NEVER silently reported complete. */
  exhaustedTaskIds: string[];
}

export function computeTaskAllocations(
  orderedTasks: AllocatableTask[],
  config: AllocationConfig,
  horizon: { from: string; to: string },
  today: Date
): AllocationResult {
  const allocations: Record<string, TaskAllocation> = {};
  const exhaustedTaskIds: string[] = [];
  const schedules: Record<string, WorkSchedule> = {};
  // Tasks arrive in their stable priority order. A member's next task may
  // share the final day's unused capacity, but never schedule before it.
  const plannedThrough: Record<string, Date> = {};
  const seenTaskIds = new Set<string>();
  const summaryTaskIds = buildGanttTaskSummaries(orderedTasks);

  for (const task of orderedTasks) {
    const taskId = task.task_id || task.id;
    if (!taskId || seenTaskIds.has(taskId)) continue;
    seenTaskIds.add(taskId);
    // Parents are presentation summaries; only executable descendants consume capacity.
    if (summaryTaskIds.has(taskId) || !isTaskScheduleEligible(task.status)) continue;
    // R5: a direct resource-member assignment is the stable scheduling key
    // (survives user linking); fall back to userId→member mapping.
    const memberKey =
      task.assignee_resource_member_id || config.memberKeyFor(task.assignee_user_id ?? null);
    const capacity = config.capacityFor(memberKey);
    const schedule = (schedules[memberKey] ??= {});
    // Seed reserved (capacity − commitments) across the WHOLE horizon once.
    const reserved = config.reservedFor(memberKey, horizon.from, horizon.to);
    for (const [dateKey, hours] of Object.entries(reserved)) {
      if (schedule[dateKey] === undefined) {
        const [y, m, d] = dateKey.split('-').map(Number);
        schedule[dateKey] = Math.max(0, capacity(new Date(y, m - 1, d)) - hours);
      }
    }
    let start = task.start_date ? new Date(task.start_date) : new Date(today);
    start.setHours(0, 0, 0, 0);
    const priorEnd = plannedThrough[memberKey];
    if (priorEnd && priorEnd > start) start = new Date(priorEnd);
    const effort = task.effort ?? 0;
    if (effort <= 0) {
      allocations[taskId] = { start, end: new Date(start), hoursPerDay: { [fmt(start)]: 0 } };
      continue;
    }
    const { endDate, updatedSchedule, hoursPerDay, exhausted } = calculateTaskSchedule(
      start,
      effort,
      schedule,
      capacity
    );
    // Exhausted = scheduler hit its internal bound, OR the allocation ran
    // past the explicit horizon, OR hours were silently dropped (allocated <
    // effort). Any of these means the task is NOT fully scheduled.
    const allocated = Object.values(hoursPerDay).reduce((a, b) => a + b, 0);
    if (exhausted || allocated + 1e-9 < effort || fmt(endDate) > horizon.to) {
      exhaustedTaskIds.push(taskId);
    }
    schedules[memberKey] = updatedSchedule;
    const bounds = positiveWorkBounds(hoursPerDay);
    const end = bounds ? new Date(`${bounds.end}T00:00:00`) : endDate;
    if (bounds) plannedThrough[memberKey] = end;
    allocations[taskId] = { start: bounds ? new Date(`${bounds.start}T00:00:00`) : start, end, hoursPerDay };
  }
  return { allocations, exhaustedTaskIds };
}
