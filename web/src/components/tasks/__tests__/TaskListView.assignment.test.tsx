import React from 'react';
import { Provider, useSelector } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TaskListView } from '../TaskListView';
import tasksReducer, { fetchProjectTasks } from '../../../redux/features/tasksSlice';
import type { Task } from '@/types/task';

const updateAssignee = jest.fn();
const useQuery = jest.fn();

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('@/hooks/useTaskFieldMutations', () => ({
  useUpdateTaskStatus: () => ({ updateStatus: jest.fn(), isUpdating: false }),
  useUpdateTaskPriority: () => ({ updatePriority: jest.fn(), isUpdating: false }),
  useUpdateTaskEffort: () => ({ updateEffort: jest.fn(), isUpdating: false }),
  useUpdateTaskDueDate: () => ({ updateDueDate: jest.fn(), isUpdating: false }),
  useUpdateTaskAssignee: () => ({ updateAssignee, isUpdating: false }),
}));
jest.mock('@/hooks/useTasks', () => ({
  useUpdateTaskPriorityOrder: () => jest.fn(),
  useUpdateTask: () => ({ updateTask: jest.fn() }),
}));
jest.mock('@/hooks/useProjectTaxonomies', () => ({
  useProjectTaxonomies: () => ({
    phases: [], loading: false, ensureDefaultPhases: jest.fn(), createPhase: jest.fn(),
    updatePhase: jest.fn(), archivePhase: jest.fn(), setTaskPhase: jest.fn(),
  }),
}));
jest.mock('@/components/projects/phase-controls', () => ({
  PhaseFilterSelect: () => null,
  TaskPhaseSelect: () => null,
  applyPhaseFilter: (tasks: Task[]) => tasks,
}));
jest.mock('@/components/projects/PhaseSettingsPanel', () => ({ PhaseSettingsPanel: () => null }));
jest.mock('@/components/common/UserAvatar', () => ({ UserAvatar: ({ username }: { username: string }) => <span>{username}</span> }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }), { virtual: true });
jest.mock('@/redux/hooks', () => ({
  useAppDispatch: () => require('react-redux').useDispatch(),
  useAppSelector: (selector: unknown) => require('react-redux').useSelector(selector),
}), { virtual: true });
jest.mock('@/redux/features/tasksSlice', () => ({
  updateTaskLocally: (payload: unknown) => ({ type: 'tasks/updateTaskLocally', payload }),
  updateTaskStatus: jest.fn(), updateTaskPriority: jest.fn(), updateTaskEffort: jest.fn(),
  updateTaskAssignee: jest.fn(), updateTaskDueDate: jest.fn(),
  fetchProjectTasks: jest.fn(),
}), { virtual: true });
jest.mock('@/lib/apollo-client', () => ({ client: { query: jest.fn(), mutate: jest.fn() } }));
jest.mock('@/graphql/mutations', () => ({ CLONE_TASK_SUBTREE: {} }), { virtual: true });
jest.mock('@/graphql/queries/tasks', () => ({ TASK_TREE_ROWS: {} }), { virtual: true });
jest.mock('@/graphql/scheduling', () => ({ RESOURCE_MEMBERS_QUERY: {} }), { virtual: true });
jest.mock('../TaskCloneDialog', () => ({ TaskCloneDialog: () => null }));
jest.mock('../TaskDetail', () => ({ TaskDetail: () => null }));
jest.mock('@apollo/client', () => ({
  gql: (strings: TemplateStringsArray) => strings.join(''),
  useQuery: (...args: unknown[]) => useQuery(...args),
  useMutation: () => [jest.fn(), { loading: false }],
}), { virtual: true });

const membersReducer = (state = { members: [] }) => state;

const parent: Task = {
  task_id: 'parent', project_id: 'project-1', title: 'Parent task', description: 'keep parent description',
  assignee_resource_member_id: 'linked-member', assignee: { userId: 'linked-user', username: 'Linked Member' },
  priority_order: 1, status: 'TODO', priority: 'MEDIUM', created_by: 'owner', child_tasks: [],
};
const child: Task = {
  task_id: 'child', project_id: 'project-1', parent_task_id: 'parent', title: 'Deep child', description: 'keep child description',
  priority_order: 2, status: 'TODO', priority: 'MEDIUM', created_by: 'owner', child_tasks: [],
};

function makeStore() {
  return configureStore({
    reducer: { tasks: tasksReducer, members: membersReducer },
    preloadedState: {
      tasks: {
        tasks: [{ ...parent, child_tasks: [{ ...child }] }], loading: false, error: null,
        pagination: { totalItems: 1, totalPages: 1, currentPage: 1, pageSize: 20 }, filters: {},
      },
      members: { members: [] },
    },
  });
}

function TaskSource() {
  const tasks = useSelector((state: any) => state.tasks.tasks as Task[]);
  return <TaskListView tasks={tasks} />;
}

function renderList() {
  const store = makeStore();
  render(<Provider store={store}><TaskSource /></Provider>);
  return store;
}

function taskFromStore(store: ReturnType<typeof makeStore>, taskId: string): Task | undefined {
  const visit = (tasks: Task[]): Task | undefined => {
    for (const task of tasks) {
      if (task.task_id === taskId) return task;
      const nested = visit(task.child_tasks ?? []);
      if (nested) return nested;
    }
    return undefined;
  };
  return visit(store.getState().tasks.tasks);
}

function assignResult(taskId: string, value: unknown) {
  return {
    task_id: taskId,
    assignee_resource_member_id: value === null ? null : 'unlinked-member',
    assignee: undefined,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  updateAssignee.mockImplementation(async (taskId: string, value: unknown) => assignResult(taskId, value));
  useQuery.mockImplementation((_document, options: { variables?: { only_assignable?: boolean } }) => (
    options.variables?.only_assignable
      ? { data: { resource_members: [
        { resource_member_id: 'linked-member', display_name: 'Linked Member', user_id: 'linked-user' },
        { resource_member_id: 'unlinked-member', display_name: 'Unlinked Member', user_id: null },
      ] }, loading: false }
      : { data: { task_tree_rows: [{ ...parent }, { ...child }] }, loading: false, refetch: jest.fn() }
  ));
});

describe('TaskListView canonical assignment source wiring', () => {
  it('retains a canonical resource assignment when the query result is normalized into Redux', () => {
    const state = tasksReducer(undefined, {
      type: fetchProjectTasks.fulfilled.type,
      payload: [{ ...child, assignee_resource_member_id: 'unlinked-member', assignee: null }],
    });
    expect(state.tasks[0]).toMatchObject({
      task_id: 'child', assignee_resource_member_id: 'unlinked-member', assignee: undefined,
    });
  });

  it('persists normal root clear and deep-child unlinked assignment into the real Redux tree without altering unrelated fields', async () => {
    const store = renderList();
    const parentRow = screen.getByText('Parent task').closest('tr')!;

    fireEvent.click(within(parentRow).getAllByText('Linked Member')[0]);
    fireEvent.change(screen.getByRole('combobox', { name: 'Người được giao' }), { target: { value: '' } });
    fireEvent.click(within(parentRow).getByTitle('Lưu'));

    await waitFor(() => expect(taskFromStore(store, 'parent')?.assignee_resource_member_id).toBeNull());
    expect(taskFromStore(store, 'parent')?.description).toBe('keep parent description');

    fireEvent.click(within(parentRow).getByRole('button', { name: 'Mở rộng task con' }));
    const childRow = screen.getByText('Deep child').closest('tr')!;
    fireEvent.click(within(childRow).getByText('Chưa gán'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Người được giao' }), { target: { value: 'resource:unlinked-member' } });
    fireEvent.click(within(childRow).getByTitle('Lưu'));

    await waitFor(() => expect(taskFromStore(store, 'child')).toMatchObject({
      assignee_resource_member_id: 'unlinked-member', assignee: undefined,
    }));
    expect(taskFromStore(store, 'child')?.description).toBe('keep child description');
    expect(updateAssignee).toHaveBeenLastCalledWith('child', {
      assigneeId: null, assigneeResourceMemberId: 'unlinked-member',
    });
  });

  it('persists Excel root clear and deep-child unlinked assignment into the same Redux tree', async () => {
    const store = renderList();
    fireEvent.click(screen.getByTestId('mode-excel-btn'));

    fireEvent.mouseDown(screen.getByTestId('excel-cell-0-5'));
    fireEvent.keyDown(screen.getByTestId('excel-typing-input'), { key: 'Delete' });
    fireEvent.mouseDown(screen.getByTestId('excel-cell-1-5'));
    fireEvent.change(screen.getByTestId('excel-typing-input'), { target: { value: 'Unlinked Member' } });
    fireEvent.keyDown(screen.getByTestId('excel-typing-input'), { key: 'Enter' });
    fireEvent.click(screen.getByTestId('excel-save-btn'));

    await waitFor(() => expect(taskFromStore(store, 'parent')?.assignee_resource_member_id).toBeNull());
    await waitFor(() => expect(taskFromStore(store, 'child')?.assignee_resource_member_id).toBe('unlinked-member'));
    expect(taskFromStore(store, 'parent')?.description).toBe('keep parent description');
    expect(taskFromStore(store, 'child')?.description).toBe('keep child description');
  });
});
