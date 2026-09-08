import { buildKanbanMemberOptions, matchesKanbanAssignee } from '../KanbanBoard';
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

describe('Kanban canonical member filtering', () => {
  const options = buildKanbanMemberOptions([
    { resource_member_id: 'linked', display_name: 'Linked', user_id: 'user-1' },
    { resource_member_id: 'unlinked', display_name: 'Name only', user_id: null },
  ], 'All');

  it('includes unlinked members under stable resource keys', () => {
    expect(options).toEqual([
      { value: 'all', label: 'All' },
      { value: 'resource:linked', label: 'Linked', userId: 'user-1' },
      { value: 'resource:unlinked', label: 'Name only', userId: undefined },
    ]);
  });

  it('matches canonical resource assignments and legacy user-only assignments', () => {
    expect(matchesKanbanAssignee(task('unlinked'), options[2])).toBe(true);
    expect(matchesKanbanAssignee(task(null, 'user-1'), options[1])).toBe(true);
    expect(matchesKanbanAssignee(task('other', 'user-1'), options[1])).toBe(false);
    expect(matchesKanbanAssignee(task(null, 'user-1'), { value: 'user-1', label: 'Legacy' })).toBe(true);
  });
});
