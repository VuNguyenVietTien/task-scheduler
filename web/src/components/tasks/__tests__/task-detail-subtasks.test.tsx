import React from 'react';
import { render, screen } from '@testing-library/react';
import { print } from 'graphql';
import TaskDetailSubtasks from '../TaskDetailSubtasks';
import { GET_TASK_BY_ID } from '@/graphql/queries/tasks';
import { transformTaskFromAPI } from '@/redux/features/taskDetailSlice';
import type { Task } from '@/types/task';

const task = (task_id: string, parent_task_id: string | null, status: Task['status']): Task => ({
  task_id,
  project_id: 'project-1',
  parent_task_id: parent_task_id ?? undefined,
  title: `Task ${task_id}`,
  status,
  priority: 'MEDIUM',
  priority_order: 1,
  created_by: 'owner',
});

describe('Task Detail subtasks', () => {
  it('keeps child_tasks from the shared detail fragment and renders direct child links/statuses only', () => {
    const child = task('child', 'parent', 'DOING');
    const grandchild = task('grandchild', 'child', 'DONE');
    const normalized = transformTaskFromAPI({
      ...task('parent', null, 'TODO'),
      child_tasks: [child, grandchild],
    });

    expect(print(GET_TASK_BY_ID)).toContain('...TaskWithChildrenFields');
    expect(normalized.child_tasks?.map((item) => item.task_id)).toEqual(['child', 'grandchild']);

    render(<TaskDetailSubtasks taskId="parent" projectId="project-1" subtasks={normalized.child_tasks ?? []} />);
    expect(screen.getByRole('link', { name: 'Task child' })).toHaveAttribute(
      'href',
      '/projects/project-1/tasks/child'
    );
    expect(screen.getByText('DOING')).toBeInTheDocument();
    expect(screen.queryByText('Task grandchild')).not.toBeInTheDocument();
    expect(screen.queryByText('No subtasks.')).not.toBeInTheDocument();
  });

  it('shows the empty state only when no direct children exist', () => {
    render(<TaskDetailSubtasks
      taskId="parent"
      projectId="project-1"
      subtasks={[task('grandchild', 'child', 'DONE')]}
    />);
    expect(screen.getByText('No subtasks.')).toBeInTheDocument();
  });

  it('preserves canonical unlinked assignments while normalizing detail tasks', () => {
    const normalized = transformTaskFromAPI({
      ...task('parent', null, 'TODO'),
      assignee_resource_member_id: 'resource-unlinked',
      assignee: null,
      child_tasks: [{
        ...task('child', 'parent', 'TODO'),
        assigneeResourceMemberId: 'resource-child',
        assignee: null,
      }],
    });

    expect(normalized).toMatchObject({
      assignee_resource_member_id: 'resource-unlinked',
      assignee: undefined,
    });
    expect(normalized.child_tasks?.[0]).toMatchObject({
      assignee_resource_member_id: 'resource-child',
      assignee: undefined,
    });
  });
});
