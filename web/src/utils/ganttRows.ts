/**
 * Gantt row building (Timeline schedule-grid fallback path) — herdr-260906
 * edge hardening: DEEP trees, ORPHAN parents, parent CYCLES, and DUPLICATE
 * task entries must all produce a finite, de-duplicated row list.
 *
 * Previously inline in Timeline: `emitTree` recursed without a visited set,
 * so a parent_task_id cycle (a→b→a) would hang the render, and duplicate
 * entries emitted duplicate rows.
 */

export interface GanttRowTaskLike {
  task_id: string;
  parent_task_id?: string | null;
  [k: string]: unknown;
}

export interface GanttTaskRow<T extends GanttRowTaskLike> {
  key: string;
  kind: 'TASK';
  task: T;
  depth: number;
}

export type GanttRow<T extends GanttRowTaskLike> = GanttTaskRow<T>;

/**
 * Build task rows from a parent/child map with, in order:
 * - dedup: each distinct task_id is emitted EXACTLY once (first wins);
 * - cycle guard: a task whose parent chain loops never re-emits descendants
 *   (visited set), so recursion terminates for ANY input;
 * - orphan emission: tasks whose parent is missing/filtered (or part of a
 *   broken cycle chain) are still emitted at depth 0 — nothing disappears.
 * Depth is bounded by the number of distinct tasks (no fixed depth limit:
 * deep trees indent per level).
 */
export function buildGanttTaskRows<T extends GanttRowTaskLike>(
  tasks: readonly T[]
): GanttTaskRow<T>[] {
  // Dedup by task_id — duplicates must not produce duplicate rows.
  const byId = new Map<string, T>();
  for (const t of tasks) {
    if (t.task_id && !byId.has(t.task_id)) byId.set(t.task_id, t);
  }

  // parent → children (only parents that exist in the deduped map are real).
  const childrenOf = new Map<string | undefined, T[]>();
  for (const t of Array.from(byId.values())) {
    const parentKey = t.parent_task_id && byId.has(t.parent_task_id)
      ? t.parent_task_id
      : undefined; // orphan: missing parent → treated as a root
    if (!childrenOf.has(parentKey)) childrenOf.set(parentKey, []);
    childrenOf.get(parentKey)!.push(t);
  }

  const rows: GanttTaskRow<T>[] = [];
  const emitted = new Set<string>();

  const emitTree = (parent: string | undefined, depth: number) => {
    for (const child of childrenOf.get(parent) ?? []) {
      // Cycle guard: a cycle member is reachable both as a "root orphan" and
      // again through its in-cycle child edge; emitted-set stops re-entry.
      if (emitted.has(child.task_id)) continue;
      emitted.add(child.task_id);
      rows.push({ key: `task:${child.task_id}`, kind: 'TASK', task: child, depth });
      emitTree(child.task_id, depth + 1);
    }
  };

  // Roots: children with no (existing) parent. Cycle members have existing
  // parents but no root ancestor — they are emitted by the orphan pass below
  // if the recursion never reached them.
  emitTree(undefined, 0);

  // Orphan/cycle safety: emit anything not yet reached at depth 0. Their
  // descendants are then emitted through the normal recursion.
  for (const t of Array.from(byId.values())) {
    if (!emitted.has(t.task_id)) {
      emitted.add(t.task_id);
      rows.push({ key: `task:${t.task_id}`, kind: 'TASK', task: t, depth: 0 });
      emitTree(t.task_id, 1);
    }
  }

  return rows;
}
