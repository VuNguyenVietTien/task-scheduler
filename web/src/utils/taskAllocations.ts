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

  for (const task of orderedTasks) {
    const taskId = task.task_id || task.id;
    if (!taskId) continue;
    if (task.status === 'DONE' || task.status === 'CLOSE') continue;
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
    let start: Date;
    if (task.start_date) {
      start = new Date(task.start_date);
      start.setHours(0, 0, 0, 0);
    } else {
      start = new Date(today);
    }
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
    allocations[taskId] = { start, end: endDate, hoursPerDay };
  }
  return { allocations, exhaustedTaskIds };
}
