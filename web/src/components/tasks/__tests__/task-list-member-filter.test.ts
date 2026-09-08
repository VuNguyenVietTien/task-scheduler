import { buildListFilterAssignees, matchesListAssignee } from '../task-list-member-filter';
import type { Task } from '@/types/task';

const task = (resourceId: string | null, userId?: string): Task => ({
  task_id: resourceId ?? userId ?? 'task',
  project_id: 'project-1',
  title: 'Task',
  status: 'TODO',
  priority: 'MEDIUM',
  priority_order: 0,
  created_by: 'owner',
  assignee_resource_member_id: resourceId,
  assignee: userId ? { userId, username: userId } : undefined,
});

const options = [
  { key: 'resource:linked', label: 'Linked', resourceMemberId: 'linked', userId: 'user-1' },
  { key: 'resource:unlinked', label: 'Name only', resourceMemberId: 'unlinked' },
];

describe('List canonical member filtering', () => {
  it('passes stable canonical options to the filter modal', () => {
    expect(buildListFilterAssignees(options)).toEqual([
      { key: 'resource:linked', label: 'Linked', userId: 'user-1' },
      { key: 'resource:unlinked', label: 'Name only', userId: undefined },
    ]);
  });

  it('matches stable resource keys, including unlinked members', () => {
    expect(matchesListAssignee(task('linked', 'user-1'), 'resource:linked', options)).toBe(true);
    expect(matchesListAssignee(task('unlinked'), 'resource:unlinked', options)).toBe(true);
    expect(matchesListAssignee(task('other', 'user-1'), 'resource:linked', options)).toBe(false);
  });

  it('falls back from legacy user-id filters only for tasks without a canonical assignment', () => {
    expect(matchesListAssignee(task(null, 'user-1'), 'user-1', options)).toBe(true);
    expect(matchesListAssignee(task(null, 'other-user'), 'user-1', options)).toBe(false);
  });
});
