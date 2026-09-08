import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TaskDetail } from '../TaskDetail';
import tasksReducer from '@/redux/features/tasksSlice';
import type { Task } from '@/types/task';

const mutate = jest.fn();
const onTaskUpdate = jest.fn();
const members = [
  { resource_member_id: 'linked-resource', display_name: 'Linked Member', user_id: 'linked-user' },
  { resource_member_id: 'unlinked-resource', display_name: 'Name Only Member', user_id: null },
];
const commentsQueryResult = { data: { task_comments: [] }, loading: false };
const membersQueryResult = { data: { resource_members: members }, loading: false };

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/lib/apollo-client', () => ({ client: { mutate: (...args: unknown[]) => mutate(...args) } }));
jest.mock('@/hooks/useTasks', () => ({ useUpdateTask: () => ({ updateTask: jest.fn() }) }));
jest.mock('@/components/common/AdvancedEditor', () => ({ AdvancedEditor: () => null }));
jest.mock('@/components/projects/ProjectCatalogSettingsPanel', () => ({ ProjectCatalogSelect: () => null }));
jest.mock('@/services/imageService', () => ({ imageService: {} }), { virtual: true });
jest.mock('@apollo/client', () => ({
  useQuery: (_query: unknown, options: { variables?: { project_id?: string } }) => options.variables?.project_id
    ? membersQueryResult
    : commentsQueryResult,
  useMutation: () => [jest.fn()],
  useApolloClient: () => ({ cache: {} }),
  gql: (parts: TemplateStringsArray) => parts.join(''),
}));

const task: Task = {
  task_id: 'task-1', project_id: 'project-1', title: 'Assigned task',
  assignee_resource_member_id: 'linked-resource',
  assignee: { userId: 'linked-user', username: 'Old account name' },
  priority_order: 1, status: 'TODO', priority: 'MEDIUM', created_by: 'owner',
};

function renderModal() {
  const store = configureStore({
    reducer: { tasks: tasksReducer },
    preloadedState: { tasks: {
      tasks: [task], loading: false, error: null,
      pagination: { totalItems: 1, totalPages: 1, currentPage: 1, pageSize: 20 }, filters: {},
    } },
  });
  render(<Provider store={store}><TaskDetail task={task} isOpen onClose={jest.fn()} onTaskUpdate={onTaskUpdate} /></Provider>);
  return store;
}

beforeEach(() => {
  jest.clearAllMocks();
  mutate.mockImplementation(async ({ variables: { input } }: any) => ({ data: { update_task: {
    ...task,
    assignee_resource_member_id: input.assignee_resource_member_id,
    assignee: null,
  } } }));
});

test('Gantt modal lists name-only members and saves canonical resource assignment', async () => {
  const store = renderModal();
  fireEvent.click(screen.getByText('Linked Member'));
  const select = screen.getByRole('combobox', { name: 'tasks.fields.assignedTo' });
  expect(screen.getByRole('option', { name: 'Name Only Member' })).toBeInTheDocument();
  fireEvent.change(select, { target: { value: 'unlinked-resource' } });
  fireEvent.click(screen.getByTitle('tasks.confirm'));

  await waitFor(() => expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ variables: { input: {
    task_id: 'task-1', assignee_id: null, assignee_resource_member_id: 'unlinked-resource',
  } } })));
  expect(store.getState().tasks.tasks[0]).toMatchObject({
    task_id: 'task-1', assignee_resource_member_id: 'unlinked-resource', title: 'Assigned task',
  });
  expect(onTaskUpdate).toHaveBeenCalledWith('task-1', expect.objectContaining({ assignee_resource_member_id: 'unlinked-resource' }));
});

test('Gantt modal unsets both canonical assignment fields', async () => {
  const store = renderModal();
  fireEvent.click(screen.getByText('Linked Member'));
  fireEvent.change(screen.getByRole('combobox', { name: 'tasks.fields.assignedTo' }), { target: { value: '' } });
  fireEvent.click(screen.getByTitle('tasks.confirm'));

  await waitFor(() => expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ variables: { input: {
    task_id: 'task-1', assignee_id: null, assignee_resource_member_id: null,
  } } })));
  expect(store.getState().tasks.tasks[0].assignee_resource_member_id).toBeNull();
});
