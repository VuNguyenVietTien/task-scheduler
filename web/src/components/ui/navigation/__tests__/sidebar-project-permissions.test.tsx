import { render, screen } from '@testing-library/react';
import { SidebarProjectTreeItem } from '../sidebar-project-tree-item';

jest.mock('next/navigation', () => ({
  usePathname: () => '/projects/project-1',
  useSearchParams: () => ({ get: () => null }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const renderRole = (user_role: string) => render(
  <SidebarProjectTreeItem
    project={{ project_id: 'project-1', name: 'Project', user_role }}
    isExpanded
    onToggle={jest.fn()}
  />
);

test('guest cannot see Members or Settings navigation', () => {
  renderRole('guest');
  expect(screen.queryByText('projects.viewMembers')).not.toBeInTheDocument();
  expect(screen.queryByText('settings.title')).not.toBeInTheDocument();
  expect(screen.getByText('Timesheet')).toBeInTheDocument();
});

test('member sees Members view-only but not Settings', () => {
  renderRole('member');
  expect(screen.getByText('projects.viewMembers')).toBeInTheDocument();
  expect(screen.queryByText('settings.title')).not.toBeInTheDocument();
});

test('only manager sees Settings', () => {
  const view = renderRole('leader');
  expect(screen.queryByText('settings.title')).not.toBeInTheDocument();
  view.unmount();
  renderRole('manager');
  expect(screen.getByText('settings.title')).toBeInTheDocument();
});
