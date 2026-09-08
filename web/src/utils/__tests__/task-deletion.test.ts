import { countTaskDescendants, taskDeletionConfirmationMessage } from '../task-deletion';
import type { Task } from '@/types/task';

const task = (task_id: string, child_tasks?: Task[]): Task => ({
  task_id,
  project_id: 'project',
  title: task_id,
  status: 'TODO',
  priority: 'MEDIUM',
  priority_order: 1,
  created_by: 'owner',
  child_tasks,
}) as Task;

describe('task deletion confirmation', () => {
  it('counts every loaded descendant and names the irreversible impact', () => {
    const root = task('root', [task('child', [task('grandchild')])]);

    expect(countTaskDescendants(root)).toBe(2);
    expect(taskDeletionConfirmationMessage(root, 'reject')).toContain('2 descendant tasks');
    expect(taskDeletionConfirmationMessage(root, 'reject')).toContain('permanently deletes');
  });

  it('warns about descendants when the current view has not loaded the tree', () => {
    expect(taskDeletionConfirmationMessage(task('root'), 'delete')).toContain('any descendant tasks');
  });
});
