import { filterListTaskTreeByStatus } from '@/utils/task-list-visibility';
import type { Task, TaskStatus } from '@/types/task';

const task = (task_id: string, status: TaskStatus, child_tasks: Task[] = []): Task => ({
  task_id, project_id: 'project', title: task_id, status, priority: 'MEDIUM', priority_order: 1,
  created_by: 'user', child_tasks,
});

const ids = (tasks: readonly Task[]): string[] => tasks.flatMap((item) => [item.task_id, ...ids(item.child_tasks ?? [])]);

describe('List-only hierarchy visibility', () => {
  it('hides completed roots without promoting descendants, but keeps completed descendants under active roots', () => {
    const visible = filterListTaskTreeByStatus([
      task('active-root', 'TODO', [task('done-child', 'DONE', [task('archived-grandchild', 'ARCHIVED')])]),
      task('done-root', 'DONE', [task('active-orphan', 'TODO')]),
      task('archived-root', 'ARCHIVED'),
    ]);

    expect(ids(visible)).toEqual(['active-root', 'done-child', 'archived-grandchild']);
  });

  it('allows an explicit completed status to include completed roots', () => {
    const visible = filterListTaskTreeByStatus([
      task('active-root', 'TODO', [task('done-child', 'DONE')]),
      task('done-root', 'DONE'),
    ], 'DONE');

    expect(ids(visible)).toEqual(['done-child', 'done-root']);
  });
});
