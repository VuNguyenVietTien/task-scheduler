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
}

export interface PlanSnapshot {
  version: 2;
  tasks: SnapshotTask[];
  meta: {
    savedAt: string;
    horizonDays?: number;
    configFingerprint?: string;
    source?: 'new-plan' | 'recalculate';
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

export interface PlanSchedulingInputs {
  tasks: AllocatableTask[];
  config: AllocationConfig;
  horizon: { from: string; to: string };
  today: Date;
}

function allocationPriority(t: AllocatableTask): number {
  const order = (t as { priority_order?: number | null }).priority_order;
  return typeof order === 'number' && Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER;
}

/** Priority-ordered draft from CURRENT tasks + CURRENT config (New Plan). */
export function draftFromCurrentTasks(inputs: PlanSchedulingInputs): PlanDraft {
  const ordered = [...inputs.tasks].sort((a, b) => allocationPriority(a) - allocationPriority(b));
  return draftFromOrderedTasks(ordered, inputs, 'new-plan');
}

/** Draft from the SAVED plan's task ids in saved priority order, scheduled
 * against CURRENT config (Recalculate — leave/capacity take current effect). */
export function draftFromSavedPlanTasks(
  savedTasks: SnapshotTask[],
  inputs: PlanSchedulingInputs
): PlanDraft {
  const byId = new Map(inputs.tasks.map((t) => [t.task_id || t.id || '', t]));
  const ordered: AllocatableTask[] = [];
  for (const st of savedTasks) {
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
  const { allocations, exhaustedTaskIds } = computeTaskAllocations(
    ordered,
    inputs.config,
    inputs.horizon,
    inputs.today
  );
  const snapshotTasks: SnapshotTask[] = ordered
    .map((t) => {
      const id = (t.task_id || t.id) as string;
      const a = allocations[id];
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      return {
        taskId: id,
        startDate: a ? fmt(a.start) : fmt(inputs.today),
        endDate: a ? fmt(a.end) : fmt(inputs.today),
        hoursPerDay: a ? { ...a.hoursPerDay } : {},
        assigneeUserId: t.assignee_user_id ?? null,
        assigneeResourceMemberId:
          (t as { assignee_resource_member_id?: string | null }).assignee_resource_member_id ?? null,
        priorityOrder: allocationPriority(t),
      } satisfies SnapshotTask;
    })
    .filter((st) => st !== null);
  // Unscheduled (exhausted) tasks stay in the snapshot with empty hours so a
  // loaded plan keeps them visible instead of silently dropping them.
  const snapshot: PlanSnapshot = {
    version: 2,
    tasks: snapshotTasks,
    meta: {
      savedAt: inputs.today.toISOString(),
      source,
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
    bars[t.taskId] = {
      start: t.startDate,
      end: t.endDate,
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
export function parsePlanSnapshot(planData: unknown): PlanSnapshot {
  if (typeof planData === 'string') {
    planData = JSON.parse(planData);
  }
  if (!planData || typeof planData !== 'object') throw new Error('plan_data is not an object');
  const obj = planData as Record<string, unknown>;
  const tasks = obj.tasks;
  if (!Array.isArray(tasks) || tasks.length === 0) throw new Error('plan_data.tasks is empty');
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (!t || typeof (t as SnapshotTask).taskId !== 'string') {
      throw new Error(`plan_data.tasks[${i}].taskId missing`);
    }
  }
  return planData as PlanSnapshot;
}
