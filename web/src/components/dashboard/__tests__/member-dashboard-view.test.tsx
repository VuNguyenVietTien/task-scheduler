import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemberDashboardView } from '../member-dashboard-view';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

describe('MemberDashboardView', () => {
  it('renders the Rust GraphQL due_date value in the Deadline column', () => {
    const task = {
      task_id: 'task-1',
      title: 'Production task',
      project_id: 'project-1',
      status: 'TODO',
      priority: 'MEDIUM',
      type: 'Feature',
      due_date: '2026-09-15T10:00:00.000Z',
      assignee: { user_id: 'user-1', username: 'Vu_Tien' },
    };

    render(<MemberDashboardView activeTasks={[task]} tasksByStatus={{ TODO: [task] }} />);

    const row = screen.getByRole('row', { name: /Production task/ });
    expect(within(row).getByText(new Date(task.due_date).toLocaleDateString())).toBeInTheDocument();
  });
});
