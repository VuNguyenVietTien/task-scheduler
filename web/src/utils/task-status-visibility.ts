import { TaskStatuses, type Task, type TaskStatus } from '@/types/task';

const DEFAULT_HIDDEN_STATUSES = new Set<TaskStatus>([
  TaskStatuses.DONE,
  TaskStatuses.CLOSE,
  TaskStatuses.REJECTED,
  TaskStatuses.ARCHIVED,
]);

export function isTaskStatusVisible(
  status: TaskStatus,
  selectedStatuses: readonly TaskStatus[] = []
): boolean {
  return selectedStatuses.length
    ? selectedStatuses.includes(status)
    : !DEFAULT_HIDDEN_STATUSES.has(status);
}

/** Keeps matching descendants under their ancestor chain and prunes unrelated branches. */
export function filterTaskTree(
  tasks: readonly Task[],
  matches: (task: Task) => boolean
): Task[] {
  return tasks.flatMap((task) => {
    const childTasks = filterTaskTree(task.child_tasks ?? [], matches);
    if (!matches(task) && childTasks.length === 0) return [];
    return [{ ...task, child_tasks: childTasks }];
  });
}

export function filterTaskTreeByStatus(
  tasks: readonly Task[],
  selectedStatuses: readonly TaskStatus[] = []
): Task[] {
  return filterTaskTree(tasks, (task) => isTaskStatusVisible(task.status, selectedStatuses));
}
