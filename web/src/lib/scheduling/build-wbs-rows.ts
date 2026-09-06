/**
 * Pure WBS Detail row builder.
 *
 * Materializes arbitrary-depth task hierarchy and optionally interleaves
 * non-task source headings. No mutation of inputs, no side effects, no
 * framework or GraphQL dependencies — replaceable by later producers.
 */
import type { TaskScheduleItem, WbsRow } from '@/types/schedule-projection';
import type { WbsSourceHeading } from '@/types/taxonomy';
import type { GqlScheduleWbsRow, GqlScheduleTaskEntry } from '@/graphql/queries/scheduleProjection';

/** Alias so adapter callers (and tests) can stay contract-typed. */
export type ProjectionWbsRowInput = GqlScheduleWbsRow;

/**
 * Build presentation rows for WBS Detail.
 *
 * - Real tasks keep their parent/subtask hierarchy at arbitrary depth.
 * - Tasks whose parent is missing (or part of a cycle) are treated as roots,
 *   so no task is ever dropped.
 * - Source headings are display-only rows with no task semantics; they never
 *   receive bar callbacks, effort, progress, assignees or dependency roles.
 *
 * Ordering: input order of roots is preserved; children follow their parents
 * in input order. Source headings are emitted first in the given order.
 */
export function buildWbsRows(
  tasks: readonly TaskScheduleItem[],
  sourceHeadings: readonly WbsSourceHeading[] = []
): WbsRow[] {
  const byId = new Map<string, TaskScheduleItem>();
  for (const t of tasks) byId.set(t.task_id, t);

  const rows: WbsRow[] = [];

  for (const heading of sourceHeadings) {
    rows.push({
      kind: 'SOURCE_HEADING',
      row_id: `heading:${heading.source_heading_id}`,
      depth: heading.depth,
      heading,
    });
  }

  // Children must follow parents: emit parents before any of their children by
  // walking roots in input order and doing a depth-first expansion.
  const childrenOf = new Map<string, TaskScheduleItem[]>();
  const roots: TaskScheduleItem[] = [];
  for (const t of tasks) {
    const parentVisible = t.parent_task_id ? byId.has(t.parent_task_id) : false;
    if (parentVisible && !wouldCycle(t, byId)) {
      const list = childrenOf.get(t.parent_task_id as string) ?? [];
      list.push(t);
      childrenOf.set(t.parent_task_id as string, list);
    } else {
      roots.push(t);
    }
  }

  const emit = (task: TaskScheduleItem, depth: number, seen: Set<string>): void => {
    if (seen.has(task.task_id)) return; // cycle guard
    seen.add(task.task_id);
    rows.push({ kind: 'TASK', row_id: `task:${task.task_id}`, depth, task });
    for (const child of childrenOf.get(task.task_id) ?? []) {
      emit(child, depth + 1, seen);
    }
  };

  const seen = new Set<string>();
  for (const root of roots) emit(root, 0, seen);

  return rows;
}

/** True if following parent links from this task returns to it (cycle). */
function wouldCycle(task: TaskScheduleItem, byId: Map<string, TaskScheduleItem>): boolean {
  const seen = new Set<string>([task.task_id]);
  let current = task;
  while (current.parent_task_id) {
    const parent = byId.get(current.parent_task_id);
    if (!parent) return false;
    if (seen.has(parent.task_id)) return true;
    seen.add(parent.task_id);
    current = parent;
  }
  return false;
}

/**
 * Map one GraphQL ScheduleTaskEntry (current-field producer) to the pure
 * builder's task input. Effort arrives as a normalized display decimal
 * string ("30.00") and is parsed to a number; progress is 0-100.
 */
export function taskScheduleItemFromEntry(entry: GqlScheduleTaskEntry): TaskScheduleItem {
  const effort = Number.parseFloat(entry.effort_hours);
  return {
    task_id: entry.task_id,
    parent_task_id: null,
    phase_id: entry.phase_id ?? null,
    title: entry.title,
    status: 'TODO',
    priority_order: 0,
    effort_hours: Number.isFinite(effort) ? effort : 0,
    progress_percent:
      typeof entry.progress === 'number' && Number.isFinite(entry.progress)
        ? entry.progress
        : undefined,
    start: entry.start_date ?? undefined,
    end: entry.end_date ?? undefined,
  };
}

/**
 * Adapter: GraphQL project_schedule_projection.wbs_rows → presentation rows.
 *
 * The backend already flattens the WBS as a pre-order traversal with depths,
 * so this preserves the exact server order and depths instead of rebuilding
 * the tree. Source headings stay distinct rows with no task identity.
 * Renders exactly what is provided — no rows are fabricated client-side
 * (wbs_rows may omit task-cycle members that totals still count; known
 * backend limitation, Increment-2 follow-up).
 */
export function wbsRowsFromProjection(rows: readonly GqlScheduleWbsRow[]): WbsRow[] {
  return rows.map((row) => {
    if (row.__typename === 'ScheduleTaskEntry') {
      return {
        kind: 'TASK' as const,
        row_id: `task:${row.task_id}`,
        depth: row.depth,
        task: taskScheduleItemFromEntry(row),
      };
    }
    const heading: WbsSourceHeading = {
      source_heading_id: row.heading_id,
      title: row.title,
      depth: row.depth,
    };
    return {
      kind: 'SOURCE_HEADING' as const,
      row_id: `heading:${row.heading_id}`,
      depth: row.depth,
      heading,
    };
  });
}
