import React from 'react';
import { Provider, useSelector } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { TaskListView } from '../TaskListView';
import tasksReducer, { fetchProjectTasks } from '../../../redux/features/tasksSlice';
import type { Task } from '@/types/task';
import { useUpdateTaskAssignee } from '@/hooks/useTaskFieldMutations';

const { client } = require('@/lib/apollo-client');
const useQuery = jest.fn();
const treeRefetch = jest.fn();
const memberRefetch = jest.fn();
let flatRows: Task[];
let memberQuery: any;

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
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
  useApolloClient: () => require('@/lib/apollo-client').client,
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

beforeEach(() => {
  jest.clearAllMocks();
  flatRows = [{ ...parent }, { ...child }];
  treeRefetch.mockImplementation(async () => ({ data: { task_tree_rows: flatRows } }));
  memberQuery = { data: { resource_members: [
    { resource_member_id: 'linked-member', display_name: 'Linked Member', user_id: 'linked-user' },
    { resource_member_id: 'unlinked-member', display_name: 'Unlinked Member', user_id: null },
  ] }, loading: false, refetch: memberRefetch };
  client.mutate.mockImplementation(async ({ variables: { input } }: any) => ({ data: { update_task: { task_id: input.task_id, assignee_resource_member_id: input.assignee_resource_member_id ?? null, assignee: null } } }));
  useQuery.mockImplementation((_document, options: { variables?: { only_assignable?: boolean } }) => (
    options.variables?.only_assignable ? memberQuery
      : { data: { task_tree_rows: flatRows }, loading: false, refetch: treeRefetch }
  ));
});


// Real TaskListView, TaskExcelGrid, field mutation hook and Redux reducer.
// Only API transport/query responses and unrelated UI seams mocked. No DB claim.
async function saveExcelAssignment(row: number, value: string) {
  fireEvent.mouseDown(screen.getByTestId('excel-cell-'+row+'-5'));
  if(value) {
    fireEvent.change(screen.getByTestId('excel-typing-input'), {target:{value}});
    fireEvent.keyDown(screen.getByTestId('excel-typing-input'), {key:'Enter'});
  } else fireEvent.keyDown(screen.getByTestId('excel-typing-input'), {key:'Delete'});
  fireEvent.click(screen.getByTestId('excel-save-btn'));
  await waitFor(()=>expect(screen.getByTestId('excel-save-btn')).not.toHaveTextContent('Saving'));
}

test('saved Excel clear must remain clear after staged value is removed', async()=>{
  const store=renderList();
  fireEvent.click(screen.getByTestId('mode-excel-btn'));
  await saveExcelAssignment(0,'');
  expect(client.mutate).toHaveBeenCalledWith(expect.objectContaining({variables:{input:{task_id:'parent',assignee_id:null,assignee_resource_member_id:null}}}));
  expect(taskFromStore(store,'parent')?.assignee_resource_member_id).toBeNull();
  expect(taskFromStore(store,'parent')?.child_tasks).toHaveLength(1);
  expect(taskFromStore(store,'parent')?.description).toBe('keep parent description');
  expect(screen.queryByTestId('excel-dirty-count')).not.toBeInTheDocument();
  expect(screen.getByTestId('excel-cell-0-5').textContent).toBe('');
});

test('saved Excel child assignment must display canonical name, not stale query data', async()=>{
  const store=renderList();
  fireEvent.click(screen.getByTestId('mode-excel-btn'));
  await saveExcelAssignment(1,'Unlinked Member');
  expect(client.mutate).toHaveBeenCalledWith(expect.objectContaining({variables:{input:{task_id:'child',assignee_id:null,assignee_resource_member_id:'unlinked-member'}}}));
  expect(taskFromStore(store,'child')?.assignee_resource_member_id).toBe('unlinked-member');
  expect(screen.queryByTestId('excel-dirty-count')).not.toBeInTheDocument();
  expect(screen.getByTestId('excel-cell-1-5')).toHaveTextContent('Unlinked Member');
});

test('assignment errors with partial GraphQL data must keep Excel edit staged', async()=>{
  client.mutate.mockResolvedValue({data:{update_task:{task_id:'child',assignee_resource_member_id:'unlinked-member',assignee:null}},errors:[{message:'Could not resolve assignee'}]});
  renderList();
  fireEvent.click(screen.getByTestId('mode-excel-btn'));
  await saveExcelAssignment(1,'Unlinked Member');
  expect(screen.getByTestId('excel-dirty-count')).toHaveTextContent('1 unsaved');
  expect(screen.getByTestId('excel-errors')).toHaveTextContent('Could not resolve assignee');
});

test('missing assignment mutation result must not clear canonical local assignment', async()=>{
  client.mutate.mockResolvedValue({data:{}});
  const store=renderList();
  fireEvent.click(screen.getByTestId('mode-excel-btn'));
  await saveExcelAssignment(0,'Unlinked Member');
  expect(taskFromStore(store,'parent')?.assignee_resource_member_id).toBe('linked-member');
  expect(screen.getByTestId('excel-dirty-count')).toHaveTextContent('1 unsaved');
});

// Read-through query replies change independently of Redux and of staged edits.
test.each([[0, '', ''], [1, 'Unlinked Member', 'Unlinked Member']] as const)(
  'canonical row %i survives mode switches, failed refresh and confirmed query acknowledgment', async (row, value, label) => {
    renderList();
    fireEvent.click(screen.getByTestId('mode-excel-btn'));
    await saveExcelAssignment(row, value);
    treeRefetch.mockRejectedValueOnce(new Error('rows offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh task rows' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('rows offline'));
    expect(screen.getByTestId(`excel-cell-${row}-5`).textContent).toBe(label);
    // An unrelated unsaved title must survive mode switching and query refresh.
    fireEvent.mouseDown(screen.getByTestId('excel-cell-0-0'));
    fireEvent.change(screen.getByTestId('excel-typing-input'), { target: { value: 'Unrelated draft' } });
    fireEvent.keyDown(screen.getByTestId('excel-typing-input'), { key: 'Enter' });
    fireEvent.click(screen.getByTestId('mode-normal-btn'));
    fireEvent.click(screen.getByTestId('mode-excel-btn'));
    expect(screen.getByTestId('excel-dirty-count')).toHaveTextContent('1 unsaved');
    treeRefetch.mockImplementationOnce(async () => {
      flatRows = flatRows.map((task, i) => i === row ? { ...task, assignee_resource_member_id: value ? 'unlinked-member' : null, assignee: undefined } : task);
      return { data: { task_tree_rows: flatRows } };
    });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh task rows' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByTestId(`excel-cell-${row}-5`).textContent).toBe(label);
    expect(screen.getByTestId('excel-cell-0-0')).toHaveTextContent('Unrelated draft');
    expect(screen.getByTestId('excel-cell-1-0')).toHaveTextContent('Deep child');
    expect(flatRows[1].parent_task_id).toBe('parent');
    expect(flatRows[0].description).toBe('keep parent description');
  }
);

test.each([
  { data: { update_task: null } },
  { data: { update_task: { task_id: 'parent', assignee: null } } },
  { data: { update_task: { task_id: 'parent', assignee_resource_member_id: null } } },
  { data: { update_task: { task_id: 'parent', assignee_resource_member_id: null, assignee: null } }, errors: [{ message: 'denied' }] },
])('real hook rejects incomplete/error result without broadcasting: %j', async (response) => {
  client.mutate.mockResolvedValue(response);
  const broadcast = jest.fn();
  window.addEventListener('task-assignee-updated', broadcast);
  const { result } = renderHook(() => useUpdateTaskAssignee());
  await act(async () => { await expect(result.current.updateAssignee('parent', null)).rejects.toBeDefined(); });
  expect(broadcast).not.toHaveBeenCalled();
  expect(result.current.error).toBeDefined();
  window.removeEventListener('task-assignee-updated', broadcast);
});

test('normal rendered cell retains the prior pair and failed editor on partial GraphQL error', async () => {
  client.mutate.mockResolvedValue({ data: { update_task: { task_id: 'parent', assignee_resource_member_id: null, assignee: null } }, errors: [{ message: 'assignment denied' }] });
  const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
  const store = renderList();
  const row = screen.getByText('Parent task').closest('tr')!;
  fireEvent.click(within(row).getAllByText('Linked Member')[0].parentElement!);
  fireEvent.change(screen.getByRole('combobox', { name: 'Người được giao' }), { target: { value: '' } });
  fireEvent.click(within(row).getByTitle('Lưu'));
  await waitFor(() => expect(alert).toHaveBeenCalled());
  expect(screen.getByRole('combobox', { name: 'Người được giao' })).toBeInTheDocument();
  expect(taskFromStore(store, 'parent')?.assignee_resource_member_id).toBe('linked-member');
  expect(taskFromStore(store, 'parent')?.assignee?.userId).toBe('linked-user');
  fireEvent.click(within(row).getByTitle('Hủy'));
  expect(within(row).getAllByText('Linked Member').length).toBeGreaterThan(0);
  alert.mockRestore();
});

test('mapping loading/error/empty are distinct; assigned cells never become unassigned and retry is explicit', async () => {
  memberQuery = { data: undefined, loading: true, refetch: memberRefetch };
  const store = renderList();
  expect(screen.getByRole('status')).toHaveTextContent('Loading member mapping');
  expect(screen.getByText('Parent task').closest('tr')).not.toHaveTextContent('Chưa gán');
  memberQuery = { data: undefined, loading: false, error: new Error('mapping offline'), refetch: memberRefetch };
  fireEvent.click(screen.getByTestId('mode-excel-btn'));
  expect(screen.getByRole('alert')).toHaveTextContent('mapping offline');
  await saveExcelAssignment(0, '');
  expect(screen.getByTestId('excel-dirty-count')).toHaveTextContent('1 unsaved');
  expect(client.mutate).not.toHaveBeenCalled();
  memberRefetch.mockImplementationOnce(async () => {
    memberQuery = { data: { resource_members: [] }, loading: false, refetch: memberRefetch };
    return memberQuery;
  });
  fireEvent.click(screen.getByRole('button', { name: 'Retry member mapping' }));
  await waitFor(() => expect(screen.getByText('No assignable members.')).toBeInTheDocument());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(taskFromStore(store, 'parent')?.assignee?.userId).toBe('linked-user');
});
