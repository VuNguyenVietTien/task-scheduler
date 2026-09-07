/**
 * Saved-plan lifecycle (herdr-260906) — pure, viewport-independent core.
 *
 * Model:
 * - LIVE view: bars computed from CURRENT tasks + CURRENT config on an
 *   explicit horizon (computeTaskAllocations). Nothing is persisted.
 * - New Plan → DRAFT built locally from current tasks ordered by priority.
 *   It NEVER touches a saved plan (no destructive overwrite before Save).
 * - Save Plan → snapshot v2 persisted via save_plan_snapshot:
 *   {version:2, tasks:[{taskId,startDate,endDate,hoursPerDay,
 *   assigneeUserId,assigneeResourceMemberId,priorityOrder}], meta:{…}}.
 *   Bars from a saved snapshot are a PURE function of the snapshot bytes —
 *   capacity/leave/group/meeting changes cannot move them.
 * - Stale: backend compares the stored config fingerprint to the current one.
 *   Client mirrors it locally for tests/instant UX.
 * - Recalculate → new DRAFT from the SAVED plan's task ids (in saved
 *   priority order) against CURRENT config; the user then saves as
 *   NEW_REVISION (append, default) or SAME_REVISION (explicit overwrite).
 */

import {
  computeTaskAllocations,
  positiveWorkBounds,
  fmt,
  type AllocatableTask,
  type AllocationConfig,
  type TaskAllocation,
} from '@/utils/taskAllocations';

export interface SnapshotTask {
  taskId: string;
  startDate: string;
  endDate: string;
  hoursPerDay: Record<string, number>;
  assigneeUserId?: string | null;
  assigneeResourceMemberId?: string | null;
  priorityOrder: number;
  /** Optional v2-compatible display metadata for historical saved tasks. */
  title?: string;
  parentTaskId?: string | null;
  status?: string;
}

export interface PlanSnapshot {
  version: 2;
  tasks: SnapshotTask[];
  meta: {
    savedAt: string;
    horizonDays?: number;
    configFingerprint?: string;
    source?: 'new-plan' | 'recalculate';
    /** Ancestors are display metadata only, never task effort. */
    contextTasks?: Pick<SnapshotTask, 'taskId' | 'title' | 'parentTaskId' | 'priorityOrder'>[];
    [k: string]: unknown;
  };
}

/** A rendered bar: dates are snapshot strings (viewport-independent). */
export interface PlanBar {
  start: string;
  end: string;
  hoursPerDay: Record<string, number>;
  unscheduled?: boolean;
}

export interface PlanDraft {
  allocations: Record<string, TaskAllocation>;
  snapshot: PlanSnapshot;
  /** Tasks whose effort could not be scheduled (zero capacity / horizon
   * exhausted). Surfaced as an ⚠ warning — never silently dropped. */
  exhaustedTaskIds: string[];
}

/** Local-only snapshot ordering for draft DnD. Invalid/incomplete input is a no-op. */
export function reorderPlanSnapshot(snapshot: PlanSnapshot, taskIds: readonly string[]): PlanSnapshot {
  const byId = new Map(snapshot.tasks.map((task) => [task.taskId, task]));
  if (byId.size !== snapshot.tasks.length || taskIds.length !== snapshot.tasks.length || new Set(taskIds).size !== taskIds.length || taskIds.some((id) => !byId.has(id))) {
    return snapshot;
  }
  return {
    ...snapshot,
    tasks: taskIds.map((taskId, index) => ({ ...byId.get(taskId)!, priorityOrder: index + 1 })),
  };
}

export interface PlanSchedulingInputs {
  tasks: AllocatableTask[];
  config: AllocationConfig;
  horizon: { from: string; to: string };
  today: Date;
  selectedTaskIds?: ReadonlySet<string>;
  unavailableReason?: string;
}

function allocationPriority(t: AllocatableTask): number {
  const order = (t as { priority_order?: number | null }).priority_order;
  return typeof order === 'number' && Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER;
}

/** Priority-ordered draft from CURRENT tasks + CURRENT config (New Plan). */
export function draftFromCurrentTasks(inputs: PlanSchedulingInputs): PlanDraft {
  const ordered = [...inputs.tasks].sort((a, b) => allocationPriority(a) - allocationPriority(b));
  const selected = inputs.selectedTaskIds ? ordered.filter(t => inputs.selectedTaskIds!.has(t.task_id || t.id || '')) : ordered;
  return draftFromOrderedTasks(selected, inputs, 'new-plan');
}

/** Draft from the SAVED plan's task ids in saved priority order, scheduled
 * against CURRENT config (Recalculate — leave/capacity take current effect). */
export function draftFromSavedPlanTasks(
  savedTasks: SnapshotTask[],
  inputs: PlanSchedulingInputs
): PlanDraft {
  const byId = new Map(inputs.tasks.map((t) => [t.task_id || t.id || '', t]));
  const ordered: AllocatableTask[] = [];
  for (const st of [...savedTasks].sort((a, b) => a.priorityOrder - b.priorityOrder)) {
    const live = byId.get(st.taskId);
    if (live) ordered.push(live);
  }
  return draftFromOrderedTasks(ordered, inputs, 'recalculate');
}

function draftFromOrderedTasks(
  ordered: AllocatableTask[],
  inputs: PlanSchedulingInputs,
  source: 'new-plan' | 'recalculate'
): PlanDraft {
  if (inputs.unavailableReason) throw new Error(inputs.unavailableReason);
  const { allocations, exhaustedTaskIds } = computeTaskAllocations(
    ordered,
    inputs.config,
    inputs.horizon,
    inputs.today
  );
  const snapshotTasks: SnapshotTask[] = ordered
    .map((t, index) => {
      const id = (t.task_id || t.id) as string;
      const a = allocations[id];
      return {
        taskId: id,
        startDate: a ? fmt(a.start) : fmt(inputs.today),
        endDate: a ? fmt(a.end) : fmt(inputs.today),
        hoursPerDay: a ? { ...a.hoursPerDay } : {},
        assigneeUserId: t.assignee_user_id ?? null,
        assigneeResourceMemberId:
          (t as { assignee_resource_member_id?: string | null }).assignee_resource_member_id ?? null,
        priorityOrder: index + 1,
        title: typeof t.title === 'string' ? t.title : undefined,
        parentTaskId: typeof t.parent_task_id === 'string' ? t.parent_task_id : null,
        status: typeof t.status === 'string' ? t.status : undefined,
      } satisfies SnapshotTask;
    })
    .filter((st) => st !== null);
  const selectedIds = new Set(snapshotTasks.map(t => t.taskId));
  const byId = new Map(inputs.tasks.map(t => [t.task_id || t.id || '', t]));
  const contextIds = new Set<string>();
  for (const task of ordered) {
    let parentId = task.parent_task_id;
    const visited = new Set<string>();
    while (typeof parentId === 'string' && byId.has(parentId) && !visited.has(parentId)) {
      visited.add(parentId);
      if (!selectedIds.has(parentId)) contextIds.add(parentId);
      parentId = byId.get(parentId)!.parent_task_id;
    }
  }
  const contextTasks = Array.from(contextIds).map(taskId => {
    const task = byId.get(taskId)!;
    return { taskId, title: typeof task.title === 'string' ? task.title : undefined,
      parentTaskId: typeof task.parent_task_id === 'string' ? task.parent_task_id : null,
      priorityOrder: allocationPriority(task) };
  });
  // Unscheduled (exhausted) tasks stay in the snapshot with empty hours so a
  // loaded plan keeps them visible instead of silently dropping them.
  const snapshot: PlanSnapshot = {
    version: 2,
    tasks: snapshotTasks,
    meta: {
      savedAt: inputs.today.toISOString(),
      source,
      contextTasks,
    },
  };
  return { allocations, snapshot, exhaustedTaskIds };
}

/** Bars from a saved snapshot — PURE: independent of viewport, horizon and
 * current config. Exhausted-at-save-time tasks carry `unscheduled: true`
 * (empty hoursPerDay) so the UI can warn instead of faking a bar. */
export function snapshotToBars(snapshot: PlanSnapshot): Record<string, PlanBar> {
  const bars: Record<string, PlanBar> = {};
  const seen = new Set<string>();
  for (const t of snapshot.tasks) {
    if (!t.taskId || seen.has(t.taskId)) continue; // duplicate guard
    seen.add(t.taskId);
    const totalHours = Object.values(t.hoursPerDay ?? {}).reduce((s, h) => s + (h || 0), 0);
    const bounds = positiveWorkBounds(t.hoursPerDay);
    bars[t.taskId] = {
      start: bounds?.start ?? t.startDate,
      end: bounds?.end ?? t.endDate,
      hoursPerDay: { ...(t.hoursPerDay ?? {}) },
      unscheduled: totalHours <= 0,
    };
  }
  return bars;
}

/** Client-side staleness mirror: saved fingerprint vs current one. The
 * backend's computed `stale` remains authoritative; this powers instant UX
 * and tests without a server round-trip. */
export function isSnapshotStale(
  savedFingerprint: string | null | undefined,
  currentFingerprint: string | null | undefined
): boolean {
  if (!savedFingerprint || !currentFingerprint) return false;
  return savedFingerprint !== currentFingerprint;
}

/** Viewport independence check for saved bars: rendering inputs (viewport
 * window) must not appear anywhere in the bar output. Exposed for tests and
 * as documentation of the invariant. */
export function savedBarsAreViewportIndependent(
  snapshot: PlanSnapshot,
  _viewport: { from: string; to: string } | null
): Record<string, PlanBar> {
  // Deliberately ignores the viewport argument.
  return snapshotToBars(snapshot);
}

/** Validate a parsed plan_data payload into a v2 snapshot (throws on junk so
 * callers can surface a load error instead of rendering garbage). */
function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

export function parsePlanSnapshot(planData: unknown): PlanSnapshot {
  if (typeof planData === 'string') {
    planData = JSON.parse(planData);
  }
  if (!planData || typeof planData !== 'object') throw new Error('plan_data is not an object');
  const obj = planData as Record<string, unknown>;
  const tasks = obj.tasks;
  if (!Array.isArray(tasks)) throw new Error('plan_data.tasks is not an array');
  // Old plan rows preserved dates/order/assignee but never daily vectors. Keep
  // them viewable as explicitly incomplete rather than inventing allocations.
  if (obj.version === undefined || obj.version === 1) {
    const legacyTasks = tasks.map((task, index) => {
      const legacy = task as {
        task_id?: string; taskId?: string; start_date?: string; end_date?: string;
        startDate?: string; endDate?: string; priority_order?: number; priorityOrder?: number;
        title?: string; assignee_id?: string; assigneeId?: string; status?: string;
      };
      if (!legacy || typeof legacy !== 'object') throw new Error(`plan_data.tasks[${index}] is invalid`);
      const fields = legacy as Record<string, unknown>;
      for (const [camel, snake] of [['taskId', 'task_id'], ['startDate', 'start_date'], ['endDate', 'end_date'], ['priorityOrder', 'priority_order'], ['assigneeId', 'assignee_id']]) {
        if (camel in fields && snake in fields && fields[camel] !== fields[snake]) throw new Error('conflicting legacy aliases');
      }
      const taskId = legacy.taskId ?? legacy.task_id;
      if (!taskId) throw new Error(`plan_data.tasks[${index}] has no task id`);
      const startDate = legacy.startDate || legacy.start_date || '';
      return {
        taskId,
        startDate,
        endDate: legacy.endDate || legacy.end_date || startDate,
        hoursPerDay: {},
        assigneeUserId: (fields.assigneeUserId ?? fields.assignee_user_id ?? legacy.assigneeId ?? legacy.assignee_id ?? null) as string | null,
        assigneeResourceMemberId: (fields.assigneeResourceMemberId ?? fields.assignee_resource_member_id ?? null) as string | null,
        parentTaskId: (fields.parentTaskId ?? fields.parent_task_id ?? null) as string | null,
        priorityOrder: legacy.priorityOrder ?? legacy.priority_order ?? index + 1,
        title: legacy.title,
        status: legacy.status,
      } satisfies SnapshotTask;
    });
    return parsePlanSnapshot({ version: 2, tasks: legacyTasks, meta: { savedAt: '', legacyHoursMissing: true } });
  }
  if (obj.version !== 2 || !obj.meta || typeof obj.meta !== 'object' || Array.isArray(obj.meta)) {
    throw new Error('plan_data has an unsupported snapshot shape');
  }
  const ids = new Set<string>();
  const orders = new Set<number>();
  const parsedTasks: SnapshotTask[] = tasks.map((raw, index) => {
    const t = raw as Partial<SnapshotTask> | null;
    if (!t || typeof t.taskId !== 'string' || !t.taskId || ids.has(t.taskId)) {
      throw new Error(`plan_data.tasks[${index}] has an invalid or duplicate taskId`);
    }
    ids.add(t.taskId);
    if (!isCalendarDate(t.startDate) || !isCalendarDate(t.endDate) || t.startDate > t.endDate) {
      throw new Error(`plan_data.tasks[${index}] has invalid dates`);
    }
    if (typeof t.priorityOrder !== 'number' || !Number.isSafeInteger(t.priorityOrder) || t.priorityOrder < 0 || orders.has(t.priorityOrder)) {
      throw new Error(`plan_data.tasks[${index}] has invalid priorityOrder`);
    }
    orders.add(t.priorityOrder);
    if ((t.parentTaskId != null && (typeof t.parentTaskId !== 'string' || !t.parentTaskId || t.parentTaskId === t.taskId)) ||
      (t.title !== undefined && typeof t.title !== 'string') || (t.status !== undefined && typeof t.status !== 'string')) {
      throw new Error(`plan_data.tasks[${index}] has invalid metadata`);
    }
    if (
      (t.assigneeUserId != null && (typeof t.assigneeUserId !== 'string' || !t.assigneeUserId.trim())) ||
      (t.assigneeResourceMemberId != null && (typeof t.assigneeResourceMemberId !== 'string' || !t.assigneeResourceMemberId.trim()))
    ) {
      throw new Error(`plan_data.tasks[${index}] has invalid assignee identity`);
    }
    if (!t.hoursPerDay || typeof t.hoursPerDay !== 'object' || Array.isArray(t.hoursPerDay)) {
      throw new Error(`plan_data.tasks[${index}] has invalid daily hours`);
    }
    for (const [date, hours] of Object.entries(t.hoursPerDay)) {
      if (!isCalendarDate(date) || date < t.startDate || date > t.endDate || !Number.isFinite(hours) || hours < 0) {
        throw new Error(`plan_data.tasks[${index}] has invalid daily hours`);
      }
    }
    return { ...t, hoursPerDay: { ...t.hoursPerDay } } as SnapshotTask;
  });
  const meta = { ...(obj.meta as PlanSnapshot['meta']) };
  if (meta.contextTasks !== undefined) {
    if (!Array.isArray(meta.contextTasks)) throw new Error('invalid ancestor context');
    meta.contextTasks = meta.contextTasks.map(context => {
      if (!context || typeof context.taskId !== 'string' || !context.taskId.trim() || ids.has(context.taskId) ||
        (context.title !== undefined && typeof context.title !== 'string') ||
        (context.parentTaskId != null && (typeof context.parentTaskId !== 'string' || !context.parentTaskId.trim())) ||
        !Number.isSafeInteger(context.priorityOrder) || context.priorityOrder < 0) throw new Error('invalid ancestor context');
      ids.add(context.taskId);
      return { taskId: context.taskId, title: context.title, parentTaskId: context.parentTaskId, priorityOrder: context.priorityOrder };
    });
  }
  const parents = new Map([...parsedTasks, ...(meta.contextTasks ?? [])].map(task => [task.taskId, task.parentTaskId]));
  for (const id of Array.from(parents.keys())) {
    const seen = new Set<string>();
    let current: string | null | undefined = id;
    while (current && parents.has(current)) {
      if (seen.has(current)) throw new Error('cyclic snapshot hierarchy');
      seen.add(current); current = parents.get(current);
    }
  }
  return { version: 2, tasks: parsedTasks, meta };
}
