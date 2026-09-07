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
}

export interface GanttTaskRow<T extends GanttRowTaskLike> {
  key: string;
  kind: 'TASK';
  task: T;
  depth: number;
}

export type GanttRow<T extends GanttRowTaskLike> = GanttTaskRow<T>;

/**
 * Reorders only direct siblings. A moved parent is emitted with its complete
 * subtree, while filtered/collapsed siblings retain their original slots.
 */
export function reorderGanttSiblingTaskIds<T extends GanttRowTaskLike>(
  tasks: readonly T[],
  activeTaskId: string,
  overTaskId: string,
  draggableTaskIds: ReadonlySet<string>
): string[] {
  const ordered = uniqueTasks(tasks);
  const byId = new Map(ordered.map((task) => [task.task_id, task]));
  const parentOf = (taskId: string): string | null | undefined => {
    const parentId = byId.get(taskId)?.parent_task_id;
    return parentId == null ? null : byId.has(parentId) ? parentId : undefined;
  };
  const activeParent = parentOf(activeTaskId);
  const overParent = parentOf(overTaskId);
  if (
    activeParent === undefined ||
    overParent === undefined ||
    activeParent !== overParent ||
    !draggableTaskIds.has(activeTaskId) ||
    !draggableTaskIds.has(overTaskId)
  ) {
    return ordered.map((task) => task.task_id);
  }

  const children = childIdsByParent(ordered, byId);
  const siblings = children.get(activeParent) ?? [];
  const visibleSiblings = siblings.filter((taskId) => draggableTaskIds.has(taskId));
  const from = visibleSiblings.indexOf(activeTaskId);
  const to = visibleSiblings.indexOf(overTaskId);
  if (from < 0 || to < 0 || from === to) return ordered.map((task) => task.task_id);

  const moved = [...visibleSiblings];
  moved.splice(to, 0, moved.splice(from, 1)[0]);
  let replacement = 0;
  children.set(
    activeParent,
    siblings.map((taskId) => draggableTaskIds.has(taskId) ? moved[replacement++] : taskId)
  );
  return flattenHierarchy(ordered, children);
}

/** Stable priority sort within every sibling set; completed tasks remain last. */
export function sortGanttSiblingTaskIds<T extends GanttRowTaskLike & { priority?: string; status?: string }>(
  tasks: readonly T[],
  matchingTaskIds: ReadonlySet<string> = new Set(tasks.map(task => task.task_id))
): string[] {
  const ordered = uniqueTasks(tasks);
  const byId = new Map(ordered.map((task) => [task.task_id, task]));
  const children = childIdsByParent(ordered, byId);
  const persistedIndex = new Map(ordered.map((task, index) => [task.task_id, index]));
  const priorityRank: Record<string, number> = {
    CRITICAL: 0, URGENT: 1, HIGH: 2, MEDIUM: 3, LOW: 4,
  };

  for (const siblingIds of Array.from(children.values())) {
    const sorted = siblingIds.filter(id => matchingTaskIds.has(id)).sort((a, b) => {
      const aTask = byId.get(a)!;
      const bTask = byId.get(b)!;
      const aDone = aTask.status === 'DONE' || aTask.status === 'CLOSE';
      const bDone = bTask.status === 'DONE' || bTask.status === 'CLOSE';
      if (aDone !== bDone) return aDone ? 1 : -1;
      const priority = (priorityRank[aTask.priority?.toUpperCase() ?? 'MEDIUM'] ?? 3) -
        (priorityRank[bTask.priority?.toUpperCase() ?? 'MEDIUM'] ?? 3);
      if (priority !== 0) return priority;
      return (persistedIndex.get(a)! - persistedIndex.get(b)!) || a.localeCompare(b);
    });
    let index = 0;
    siblingIds.forEach((id, slot) => { if (matchingTaskIds.has(id)) siblingIds[slot] = sorted[index++]; });
  }
  return flattenHierarchy(ordered, children);
}

function uniqueTasks<T extends GanttRowTaskLike>(tasks: readonly T[]): T[] {
  const ids = new Set<string>();
  return tasks.filter((task) => Boolean(task.task_id) && !ids.has(task.task_id) && (ids.add(task.task_id), true));
}

function childIdsByParent<T extends GanttRowTaskLike>(
  tasks: readonly T[],
  byId: ReadonlyMap<string, T>
): Map<string | null, string[]> {
  const children = new Map<string | null, string[]>();
  for (const task of tasks) {
    const parent = task.parent_task_id == null ? null : byId.has(task.parent_task_id) ? task.parent_task_id : null;
    const siblingIds = children.get(parent) ?? [];
    siblingIds.push(task.task_id);
    children.set(parent, siblingIds);
  }
  return children;
}

function flattenHierarchy<T extends GanttRowTaskLike>(
  tasks: readonly T[],
  children: ReadonlyMap<string | null, readonly string[]>
): string[] {
  const emitted = new Set<string>();
  const result: string[] = [];
  const emit = (taskId: string) => {
    if (emitted.has(taskId)) return;
    emitted.add(taskId);
    result.push(taskId);
    for (const childId of children.get(taskId) ?? []) emit(childId);
  };
  for (const rootId of children.get(null) ?? []) emit(rootId);
  for (const task of tasks) emit(task.task_id); // orphan/cycle safety
  return result;
}

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
