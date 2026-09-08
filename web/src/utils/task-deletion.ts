import type { Task } from '@/types/task';

export function countTaskDescendants(task: Pick<Task, 'task_id' | 'child_tasks'>): number {
  const seen = new Set<string>([task.task_id]);
  const pending = [...(task.child_tasks ?? [])];
  let count = 0;
  while (pending.length) {
    const child = pending.pop()!;
    if (seen.has(child.task_id)) continue;
    seen.add(child.task_id);
    count += 1;
    pending.push(...(child.child_tasks ?? []));
  }
  return count;
}

export function taskDeletionConfirmationMessage(
  task: Pick<Task, 'task_id' | 'title' | 'child_tasks'>,
): string {
  const descendantCount = countTaskDescendants(task);
  const impact = task.child_tasks === undefined
    ? ' and all descendant tasks'
    : descendantCount ? ` and all ${descendantCount} descendant task${descendantCount === 1 ? '' : 's'}` : '';
  return `Delete “${task.title}”${impact}? ${impact ? 'They' : 'It'} will be permanently deleted and cannot be recovered. Continue?`;
}
