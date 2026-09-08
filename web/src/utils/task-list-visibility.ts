import type { Task, TaskStatus } from '@/types/task';
import { filterTaskTree, isTaskStatusVisible } from '@/utils/task-status-visibility';

/** List-only status semantics: default hiding applies to roots, never descendants. */
export function filterListTaskTreeByStatus(
  tasks: readonly Task[],
  selectedStatus?: TaskStatus
): Task[] {
  if (!selectedStatus) return tasks.filter((task) => isTaskStatusVisible(task.status));
  return filterTaskTree(tasks, (task) => isTaskStatusVisible(task.status, [selectedStatus]));
}
