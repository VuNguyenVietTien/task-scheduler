/**
 * Pure Master Schedule row builder.
 *
 * Groups every real task exactly once by its own phase_id in configured phase
 * display order plus an explicit Unphased group. Derives presentation-only
 * rollups from current task fields; never mutates inputs and never fabricates
 * dates for unscheduled effort.
 */
import type {
  PhaseRollupSummary,
  TaskScheduleItem,
} from '@/types/schedule-projection';
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
