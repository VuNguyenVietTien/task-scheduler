/**
 * Pure Master Schedule row builder.
 *
 * Groups every real task exactly once by its own phase_id in configured phase
 * display order plus an explicit Unphased group. Derives presentation-only
 * rollups from current task fields; never mutates inputs and never fabricates
 * dates for unscheduled effort.
 */
import type {
  MasterPhaseRow,
  PhaseRollupSummary,
  TaskScheduleItem,
} from '@/types/schedule-projection';
import type { ProjectCatalogItem } from '@/types/project-catalog';
import { resolveProjectCatalogLabel } from '@/utils/project-catalog';
import type { PhaseDescriptor } from '@/types/taxonomy';
import { taskScheduleItemFromEntry, type ProjectionWbsRowInput } from './build-wbs-rows';

export type { ProjectionWbsRowInput };

export interface MasterScheduleRows {
  /** Configured phases in display_order (empty phases included). */
  phase_groups: PhaseRollupSummary[];
  /** Always-present explicit Unphased group. */
  unphased_group: PhaseRollupSummary;
}

const UNPHASED_NAME = 'Unphased';
const UNCLASSIFIED_NAME = 'Unclassified / not recorded';

export interface MasterPhaseAllocation {
  taskId: string;
  /** undefined is historical classification missing; null is known unclassified. */
  progressCatalogItemId?: string | null;
  hoursPerDay: Record<string, number>;
  /** Saved span used only when a legacy snapshot has no daily vector. */
  start?: string;
  end?: string;
  /** False only when a legacy snapshot has no authoritative daily vector. */
  allocationKnown?: boolean;
  /** False for terminal/excluded tasks that must not consume schedule. */
  eligible?: boolean;
}

/**
 * Builds phase-only Master rows from direct selected-plan allocations.
 * It intentionally has no task-tree or current-field projection input.
 */
export function buildMasterPhaseRows(
  allocations: readonly MasterPhaseAllocation[],
  catalogItems: readonly ProjectCatalogItem[],
  locale: string
): MasterPhaseRow[] {
  const configured = [...catalogItems]
    .sort((a, b) => a.display_order - b.display_order || a.catalog_item_id.localeCompare(b.catalog_item_id))
    .filter((item, index, items) => index === 0 || item.catalog_item_id !== items[index - 1].catalog_item_id);
  const configuredById = new Map(configured.map((item) => [item.catalog_item_id, item]));
  const buckets = new Map<string | null, {
    taskIds: string[];
    hoursPerDay: Record<string, number>;
    hasKnownHours: boolean;
    historyIncomplete: boolean;
    start?: string;
    end?: string;
  }>();
  const bucketFor = (id: string | null) => {
    let bucket = buckets.get(id);
    if (!bucket) {
      bucket = { taskIds: [], hoursPerDay: {}, hasKnownHours: false, historyIncomplete: false };
      buckets.set(id, bucket);
    }
    return bucket;
  };
  const seenTaskIds = new Set<string>();

  for (const allocation of allocations) {
    if (!allocation.taskId || allocation.eligible === false) continue;
    const positiveHours = Object.entries(allocation.hoursPerDay).filter(([, hours]) => Number.isFinite(hours) && hours > 0);
    const legacySpan = allocation.allocationKnown === false && /^\d{4}-\d{2}-\d{2}$/.test(allocation.start ?? '') && /^\d{4}-\d{2}-\d{2}$/.test(allocation.end ?? '') && allocation.start! <= allocation.end!;
    if ((!positiveHours.length && !legacySpan) || seenTaskIds.has(allocation.taskId)) continue;
    seenTaskIds.add(allocation.taskId);
    const item = allocation.progressCatalogItemId ? configuredById.get(allocation.progressCatalogItemId) : undefined;
    const id = item ? item.catalog_item_id : null;
    const bucket = bucketFor(id);
    bucket.taskIds.push(allocation.taskId);
    bucket.historyIncomplete ||= allocation.allocationKnown === false || allocation.progressCatalogItemId === undefined || (typeof allocation.progressCatalogItemId === 'string' && !item);
    if (legacySpan) {
      bucket.start = bucket.start === undefined || allocation.start! < bucket.start ? allocation.start! : bucket.start;
      bucket.end = bucket.end === undefined || allocation.end! > bucket.end ? allocation.end! : bucket.end;
    }
    for (const [date, hours] of positiveHours) {
      bucket.hoursPerDay[date] = (bucket.hoursPerDay[date] ?? 0) + hours;
      bucket.hasKnownHours = true;
    }
  }

  const rowFor = (item: ProjectCatalogItem | null): MasterPhaseRow => {
    const bucket = buckets.get(item?.catalog_item_id ?? null) ?? {
      taskIds: [], hoursPerDay: {}, hasKnownHours: false, historyIncomplete: false,
    };
    const dates = Object.keys(bucket.hoursPerDay).sort();
    const start = [bucket.start, dates[0]].filter((date): date is string => Boolean(date)).sort()[0];
    const end = [bucket.end, dates.at(-1)].filter((date): date is string => Boolean(date)).sort().at(-1);
    return {
      phase_id: item?.catalog_item_id ?? null,
      name: item ? resolveProjectCatalogLabel(item, locale) : UNCLASSIFIED_NAME,
      display_order: item?.display_order ?? Number.MAX_SAFE_INTEGER,
      is_unphased: item === null,
      task_ids: bucket.taskIds,
      task_count: bucket.taskIds.length,
      ...(bucket.hasKnownHours
        ? { total_hours: Object.values(bucket.hoursPerDay).reduce((total, hours) => total + hours, 0) }
        : {}),
      hours_per_day: bucket.hoursPerDay,
      ...(start && end ? { start, end } : {}),
      ...(bucket.historyIncomplete ? { history_incomplete: true } : {}),
    };
  };

  const rows = configured.map((item) => rowFor(item))
    .filter((row) => row.task_count > 0 || row.history_incomplete);
  const unclassified = rowFor(null);
  return unclassified.task_count > 0 || unclassified.history_incomplete ? [...rows, unclassified] : rows;
}

/**
 * Build Master Schedule phase summary rows.
 *
 * - effort = sum of direct task effort_hours, once per task regardless of
 *   hierarchy depth (no parent/child double counting);
 * - start/end = min start / max end among scheduled tasks only; undefined
 *   when no task in the group has dates (unscheduled effort fabricates none);
 * - progress = weighted mean per the backend contract rule: contributors are
 *   tasks WITH a progress value; each contributor's weight is its effort when
 *   effort > 0, else 1.0; the result is rounded to 2 decimal places and is
 *   undefined when no contributor exists;
 * - allocated/remaining are summed only when tasks supply them;
 * - deleted tasks are excluded everywhere.
 */
export function buildMasterRows(
  tasks: readonly TaskScheduleItem[],
  phases: readonly PhaseDescriptor[] = []
): MasterScheduleRows {
  const live = tasks.filter((t) => !t.deleted);

  const configuredIds = new Set(phases.map((p) => p.phase_id));
  const buckets = new Map<string, TaskScheduleItem[]>();
  const unphased: TaskScheduleItem[] = [];
  for (const t of live) {
    // Tasks whose phase_id is unknown/unconfigured (e.g. archived or invalid
    // phase) fall back to explicit Unphased so every live task appears exactly
    // once and none are silently dropped.
    if (t.phase_id && configuredIds.has(t.phase_id)) {
      const list = buckets.get(t.phase_id) ?? [];
      list.push(t);
      buckets.set(t.phase_id, list);
    } else {
      unphased.push(t);
    }
  }

  const summarize = (
    phase: PhaseDescriptor | null,
    group: readonly TaskScheduleItem[]
  ): PhaseRollupSummary => {
    let totalEffort = 0;
    let weighted = 0;
    let weight = 0;
    let hasContributor = false;
    let allocated: number | undefined;
    let remaining: number | undefined;
    let minStart: string | undefined;
    let maxEnd: string | undefined;

    for (const t of group) {
      // Negative or invalid effort counts as zero everywhere.
      const effort = typeof t.effort_hours === 'number' && t.effort_hours > 0 ? t.effort_hours : 0;
      totalEffort += effort;
      // Contract weighted-progress rule (Task 1.3 handoff §5): contributors
      // are tasks with a progress value; weight = effort when > 0 else 1.0;
      // tasks without progress are excluded from numerator AND denominator.
      if (typeof t.progress_percent === 'number' && Number.isFinite(t.progress_percent)) {
        hasContributor = true;
        const w = effort > 0 ? effort : 1.0;
        weighted += w * t.progress_percent;
        weight += w;
      }
      if (typeof t.start === 'string' && t.start) {
        minStart = minStart === undefined || t.start < minStart ? t.start : minStart;
      }
      if (typeof t.end === 'string' && t.end) {
        maxEnd = maxEnd === undefined || t.end > maxEnd ? t.end : maxEnd;
      }
      if (typeof t.allocated_hours === 'number') {
        allocated = (allocated ?? 0) + t.allocated_hours;
      }
      if (typeof t.remaining_hours === 'number') {
        remaining = (remaining ?? 0) + t.remaining_hours;
      }
    }

    return {
      phase_id: phase ? phase.phase_id : null,
      name: phase ? phase.name : UNPHASED_NAME,
      display_order: phase ? phase.display_order : Number.MAX_SAFE_INTEGER,
      is_unphased: phase === null,
      task_ids: group.map((t) => t.task_id),
      task_count: group.length,
      total_effort_hours: totalEffort,
      ...(allocated !== undefined ? { allocated_hours: allocated } : {}),
      ...(remaining !== undefined ? { remaining_hours: remaining } : {}),
      ...(minStart !== undefined ? { start: minStart } : {}),
      ...(maxEnd !== undefined ? { end: maxEnd } : {}),
      ...(hasContributor && weight > 0
        ? { progress_percent: Math.round((weighted / weight) * 100) / 100 }
        : {}),
    };
  };

  const configured = [...phases].sort((a, b) => a.display_order - b.display_order);
  const phase_groups = configured.map((p) => summarize(p, buckets.get(p.phase_id) ?? []));
  const unphased_group = summarize(null, unphased);

  return { phase_groups, unphased_group };
}

/**
 * Adapter: build Master Schedule rows from the GraphQL projection's wbs_rows.
 *
 * Only real task entries contribute (source headings are not tasks). The
 * provided rows are the render source of truth — the builder never assumes
 * wbs_rows count equals totals.task_count (known backend limitation: cycle
 * members may be omitted; Increment-2 follow-up). Unknown/inactive phase ids
 * fall into the explicit Unphased group so no provided task is dropped.
 */
export function masterRowsFromProjection(
  rows: readonly ProjectionWbsRowInput[],
  phases: readonly PhaseDescriptor[]
): MasterScheduleRows {
  const tasks = rows
    .filter((r): r is Extract<ProjectionWbsRowInput, { __typename: 'ScheduleTaskEntry' }> =>
      r.__typename === 'ScheduleTaskEntry'
    )
    .map(taskScheduleItemFromEntry);
  return buildMasterRows(tasks, phases);
}
