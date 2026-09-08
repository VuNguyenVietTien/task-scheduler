import type { Task } from '@/types/task';
import {
  flattenKanbanTasks,
  getKanbanStatus,
  updateKanbanTaskInTree,
} from '../kanban-tasks';

const task = (task_id: string, extra: Partial<Task> = {}): Task => ({
  task_id,
  project_id: 'project',
  title: task_id,
  status: 'TODO',
  priority: 'MEDIUM',
  priority_order: 1,
  created_by: 'owner',
  ...extra,
});

describe('Kanban task tree projection', () => {
  it('emits every nested task once in parent-first order with its own status and context', () => {
    const grandchild = task('grandchild', { parent_task_id: 'child', status: 'DONE' });
    const child = task('child', { parent_task_id: 'root', status: 'DOING', child_tasks: [grandchild] });
    const root = task('root', { child_tasks: [child] });

    const rows = flattenKanbanTasks([root, child]);

    expect(rows.map(({ task: rowTask }) => [rowTask.task_id, getKanbanStatus(rowTask.status)])).toEqual([
      ['root', 'TODO'],
      ['child', 'DOING'],
      ['grandchild', 'DONE'],
    ]);
    expect(rows.map(({ depth, parent }) => [depth, parent?.task_id])).toEqual([
      [0, undefined],
      [1, 'root'],
      [2, 'child'],
    ]);
  });

  it('falls back malformed statuses to Todo while retaining every supported status', () => {
    expect(getKanbanStatus(undefined)).toBe('TODO');
    expect(getKanbanStatus('UNKNOWN')).toBe('TODO');
    expect(getKanbanStatus('ARCHIVED')).toBe('ARCHIVED');
  });

  it('applies a returned child update without losing its descendants or forest shape', () => {
    const grandchild = task('grandchild', { parent_task_id: 'child' });
    const child = task('child', { parent_task_id: 'root', child_tasks: [grandchild] });
    const sibling = task('sibling');
    const root = task('root', { child_tasks: [child] });

    const updated = updateKanbanTaskInTree([root, sibling], 'child', {
      status: 'REVIEW',
      child_tasks: undefined,
    });

    expect(updated.map(({ task_id }) => task_id)).toEqual(['root', 'sibling']);
    expect(updated[0].child_tasks?.[0]).toMatchObject({ task_id: 'child', status: 'REVIEW' });
    expect(updated[0].child_tasks?.[0].child_tasks).toEqual([grandchild]);
    expect(flattenKanbanTasks(updated).map(({ task: rowTask }) => rowTask.task_id)).toEqual([
      'root', 'child', 'grandchild', 'sibling',
    ]);
  });
});
