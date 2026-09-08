import { filterTaskTreeByStatus, isTaskStatusVisible } from '@/utils/task-status-visibility';
import type { Task, TaskStatus } from '@/types/task';

const task = (task_id: string, status: TaskStatus, child_tasks: Task[] = []): Task => ({
  task_id,
  project_id: 'project',
  title: task_id,
  status,
  priority: 'MEDIUM',
  priority_order: 1,
  created_by: 'user',
  child_tasks,
});

const ids = (tasks: readonly Task[]): string[] =>
  tasks.flatMap((item) => [item.task_id, ...ids(item.child_tasks ?? [])]);

describe('task status visibility', () => {
  it('defaults to unfinished statuses only', () => {
    expect(['TODO', 'DOING', 'PENDING', 'REVIEW', 'BLOCKED'].filter((status) =>
      isTaskStatusVisible(status as TaskStatus)
    )).toEqual(['TODO', 'DOING', 'PENDING', 'REVIEW', 'BLOCKED']);
    expect(['DONE', 'CLOSE', 'REJECTED', 'ARCHIVED'].some((status) =>
      isTaskStatusVisible(status as TaskStatus)
    )).toBe(false);
  });

  it.each(['DONE', 'REJECTED', 'TODO'] as TaskStatus[])(
    'shows only explicitly selected %s tasks',
    (status) => {
      const tasks = ['TODO', 'DOING', 'DONE', 'REJECTED'].map((value) =>
        task(value, value as TaskStatus)
      );
      expect(ids(filterTaskTreeByStatus(tasks, [status]))).toEqual([status]);
    }
  );

  it('promotes unfinished descendants when a hidden parent is removed', () => {
    for (const status of ['REJECTED', 'DONE'] as TaskStatus[]) {
      const visible = filterTaskTreeByStatus([
        task(`${status.toLowerCase()}-parent`, status, [task('active-child', 'TODO')]),
      ]);

      expect(ids(visible)).toEqual(['active-child']);
      expect(visible.some(({ task_id }) => task_id.includes('parent'))).toBe(false);
    }
  });

  it('prunes unrelated descendants without retaining a hidden ancestor', () => {
    const visible = filterTaskTreeByStatus([
      task('done-parent', 'DONE', [
        task('matching-child', 'TODO'),
        task('rejected-sibling', 'REJECTED'),
        task('done-sibling', 'DONE'),
      ]),
    ]);

    expect(ids(visible)).toEqual(['matching-child']);
  });

  it('explicitly selected status shows matching nodes without unrelated ancestor context', () => {
    const visible = filterTaskTreeByStatus([
      task('active-parent', 'TODO', [task('rejected-child', 'REJECTED')]),
    ], ['REJECTED']);

    expect(ids(visible)).toEqual(['rejected-child']);
  });
});
