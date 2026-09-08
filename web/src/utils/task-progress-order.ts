import type { Task } from '@/types/task';

export type ProgressDisplayOrder = ReadonlyMap<string, number>;

function progressRank(task: Task, order: ProgressDisplayOrder): number {
  const catalogId = task.progressCatalogItemId
    ?? (task as Task & { progress_catalog_item_id?: string | null }).progress_catalog_item_id;
  return catalogId ? order.get(catalogId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
}

function orderSiblings(tasks: readonly Task[], order: ProgressDisplayOrder): Task[] {
  return tasks.map((task, index) => ({ task, index })).sort((a, b) =>
    progressRank(a.task, order) - progressRank(b.task, order)
    || a.task.priority_order - b.task.priority_order
    || a.index - b.index
  ).map(({ task }) => task);
}

/** Group only children; root/global order remains untouched. */
export function orderNestedTaskChildrenByProgress(tasks: readonly Task[], order: ProgressDisplayOrder): Task[] {
  const visit = (task: Task): Task => task.child_tasks?.length
    ? { ...task, child_tasks: orderSiblings(task.child_tasks, order).map(visit) }
    : task;
  return tasks.map(visit);
}

/** Rebuild parent-before-child rows with each direct sibling group ordered by progress then stored priority. */
export function orderFlatTaskChildrenByProgress(tasks: readonly Task[], order: ProgressDisplayOrder): Task[] {
  const byId = new Map(tasks.map((task) => [task.task_id, task]));
  const children = new Map<string, Task[]>();
  const roots: Task[] = [];
  tasks.forEach((task) => {
    const parentId = task.parent_task_id;
    if (parentId && parentId !== task.task_id && byId.has(parentId)) {
      children.set(parentId, [...(children.get(parentId) ?? []), task]);
    } else {
      roots.push(task);
    }
  });

  const result: Task[] = [];
  const seen = new Set<string>();
  const visit = (task: Task) => {
    if (seen.has(task.task_id)) return;
    seen.add(task.task_id);
    result.push(task);
    orderSiblings(children.get(task.task_id) ?? [], order).forEach(visit);
  };
  roots.forEach(visit);
  tasks.forEach(visit); // retain malformed/cyclic rows once, in original fallback order
  return result;
}
