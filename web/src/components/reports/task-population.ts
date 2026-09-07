export interface HierarchicalTask {
  task_id: string;
  child_tasks?: HierarchicalTask[];
}

/** Return each task identity once while traversing every nested depth. */
export function distinctTaskPopulation<T extends HierarchicalTask>(roots: readonly T[]): T[] {
  const tasks: T[] = [];
  const seenIds = new Set<string>();
  const expanded = new Set<HierarchicalTask>();
  const stack: HierarchicalTask[] = [...roots].reverse();

  while (stack.length > 0) {
    const task = stack.pop()!;
    if (!seenIds.has(task.task_id)) {
      seenIds.add(task.task_id);
      tasks.push(task as T);
    }

    if (!expanded.has(task)) {
      expanded.add(task);
      const children = task.child_tasks ?? [];
      for (let index = children.length - 1; index >= 0; index -= 1) stack.push(children[index]);
    }
  }

  return tasks;
}

export function countTasksByStatus<T extends { status: string }>(tasks: readonly T[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const task of tasks) {
    const status = task.status.toUpperCase();
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}
