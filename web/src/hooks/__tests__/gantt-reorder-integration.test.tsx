import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MockedProvider } from '@apollo/client/testing';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buildSchema, graphql, print } from 'graphql';
import '@/i18n/i18n-config';
import { Timeline } from '@/components/timeline/Timeline';
import { store } from '@/redux/store';
import { fetchProjectTasks, resetTasks, updateTaskLocally } from '@/redux/features/tasksSlice';
import { TASK_TREE_ROWS, GET_PROJECT_TASKS } from '@/graphql/queries/tasks';
import { REORDER_TASKS } from '@/graphql/mutations/tasks';
import { mapReorderInput } from '../useTasks';

const mockQuery = jest.fn();
const mockMutate = jest.fn();
let mockProject = 'proj-1';
let mockOnDragEnd: (event: any) => Promise<void>;
let mockLifecycle: any;
let networkRows: any[];
jest.mock('@/lib/apollo-client', () => ({ client: { query: (...args: any[]) => mockQuery(...args), mutate: (...args: any[]) => mockMutate(...args) } }));
jest.mock('next/navigation', () => ({ useParams: () => ({ id: mockProject }) }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('@/components/tasks/TaskDetail', () => ({ TaskDetail: () => null }));
jest.mock('@/hooks/usePlanLifecycle', () => ({ usePlanLifecycle: () => mockLifecycle }));
jest.mock('@/hooks/useProjectTaxonomies', () => ({ useProjectTaxonomies: () => ({ phases: [] }) }));
jest.mock('@/hooks/useScheduleProjection', () => ({ useScheduleProjection: () => ({ wbsRows: [], masterRows: { phase_groups: [], unphased_group: { phase_id: null, name: 'Unphased', task_ids: [], task_count: 0 } }, loading: false }) }));
jest.mock('@/hooks/useProjectSchedulingConfig', () => ({ useProjectSchedulingConfig: () => ({
  loading: false, error: undefined, daysOff: [], commitments: [], groups: [],
  memberGroups: {}, memberCapacity: {}, defaultCapacity: { weekdayHours: 4, weekendHours: 0, dateOverrides: {} },
  resourceMembers: [{ resource_member_id: 'resource', display_name: 'Unlinked', user_id: null, member_kind: 'MEMBER' }],
  capacityFor: () => () => 4, configFor: () => ({ weekdayHours: 4, weekendHours: 0, dateOverrides: {} }),
  groupIdsFor: () => [], reservedFor: () => ({}), memberKeyFor: () => 'unassigned', truncatedCommitmentRules: new Set(),
}) }));
jest.mock('@dnd-kit/core', () => {
  const actual = jest.requireActual('@dnd-kit/core');
  return { ...actual, DndContext: (props: any) => { mockOnDragEnd = props.onDragEnd; return <actual.DndContext {...props} />; } };
});

// Execute the actual client documents at the network seam. This fixture is
// NOT a backend/DB persistence test; validation ensures unselected fields
// cannot magically appear in a mock response.
const schema = buildSchema(`
  type Assignee { user_id: ID username: String full_name: String avatar_url: String role: String }
  type Task {
    task_id: ID! project_id: ID! parent_task_id: ID title: String description: String
    assignee_resource_member_id: ID assignee: Assignee priority_order: Int
    start_date: String due_date: String actual_start_date: String actual_end_date: String
    effort: Float progress: Float created_by: ID created_at: String updated_at: String
    is_deleted: Boolean status: String priority: String type_: String category: String
    tags: [String!] progress_type: String progress_catalog_item_id: ID
    category_catalog_item_id: ID task_type_catalog_item_id: ID child_tasks: [Task!]
  }
  input TaskOrderInput { task_id: ID! priority_order: Int! }
  input ReorderTasksInput { project_id: ID! tasks: [TaskOrderInput!]! expected_order: [ID!] }
  type Query { task_tree_rows(project_id: ID!): [Task!]! tasks(project_id: ID!): [Task!]! }
  type Mutation { reorder_tasks(input: ReorderTasksInput!): [Task!]! }
`);
const task = (id: string, order: number, parent?: string, priority = 'LOW') => ({
  task_id: id, project_id: 'proj-1', parent_task_id: parent ?? null, title: id, priority_order: order,
  priority, status: 'TODO', effort: 2, start_date: '2026-09-07', created_by: 'owner', description: `Description ${id}`,
  tags: ['tag'], type_: 'Feature', actual_start_date: '2026-09-07', assignee_resource_member_id: 'resource', assignee: null,
});
const fixtureQuery = ({ query, variables }: any) => graphql({ schema, source: print(query), variableValues: variables,
  rootValue: { task_tree_rows: () => networkRows, tasks: () => networkRows.filter(t => !t.parent_task_id) } });
const fixtureMutation = ({ mutation, variables }: any) => graphql({ schema, source: print(mutation), variableValues: variables,
  rootValue: { reorder_tasks: ({ input }: any) => {
    networkRows = networkRows.map(task => ({ ...task, priority_order: input.tasks.find((item: any) => item.task_id === task.task_id).priority_order }));
    return networkRows;
  } } });
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function mount() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  queryClient.setQueryData(['tasks'], ['unrelated cache']);
  const ui = () => <QueryClientProvider client={queryClient}><Provider store={store}><MockedProvider mocks={[]}><Timeline /></MockedProvider></Provider></QueryClientProvider>;
  return { ...render(ui()), ui, queryClient };
}
const labels = () => screen.getAllByTestId('gantt-name-row').map(row => row.querySelector('button.truncate')?.textContent);
const fetchRows = async () => { await act(async () => { await store.dispatch(fetchProjectTasks(mockProject)).unwrap(); }); };
beforeEach(() => {
  jest.clearAllMocks(); act(() => { store.dispatch(resetTasks()); }); mockProject = 'proj-1';
  networkRows = [task('Match low', 1), task('Hidden', 2), task('Match high', 3, undefined, 'CRITICAL')];
  mockQuery.mockImplementation(fixtureQuery); mockMutate.mockImplementation(fixtureMutation);
  mockLifecycle = { mode: 'live', draft: null, draftSource: null, basePlanId: null, loadedPlan: null, savedBars: {}, overrideBars: null,
    loadedSnapshot: null, plans: [], plansLoading: false, saving: false, error: null, defaultPlanFallback: false, exhaustedTaskIds: [],
    newPlan: jest.fn(), recalculate: jest.fn(), loadPlan: jest.fn(), savePlan: jest.fn(), reorderDraft: jest.fn(),
    backToLive: jest.fn(), deletePlan: jest.fn(), setActivePlan: jest.fn() };
  localStorage.setItem('ganttChartDateRange', JSON.stringify({ startDate: '2026-09-07T00:00:00', endDate: '2026-09-09T00:00:00' }));
});

test('flat network document -> thunk -> recursive normalizer -> real Timeline preserves depth>2, fields, resource, priority on reload', async () => {
  networkRows = [task('Root', 2), task('Child', 4, 'Root'), task('Grandchild', 1, 'Child'), task('Depth3', 5, 'Grandchild'), task('Other root', 3, undefined, 'CRITICAL')];
  await fetchRows();
  expect(mockQuery).toHaveBeenLastCalledWith({ query: TASK_TREE_ROWS, variables: { projectId: 'proj-1' }, fetchPolicy: 'network-only' });
  const deep = store.getState().tasks.tasks[0].child_tasks![0].child_tasks![0].child_tasks![0];
  expect(deep).toMatchObject({ task_id: 'Depth3', parent_task_id: 'Grandchild', priority_order: 5, assignee_resource_member_id: 'resource', description: 'Description Depth3', tags: ['tag'], type: 'Feature', actual_start_date: '2026-09-07' });
  const view = mount();
  expect(labels()).toEqual(['Root', 'Child', 'Grandchild', 'Depth3', 'Other root']);
  expect(screen.getAllByTestId('gantt-name-row').map(row => Number(row.dataset.depth))).toEqual([0, 1, 2, 3, 0]);
  expect(screen.getAllByTestId('member-effort-cell').find(cell => cell.dataset.date === '2026-09-07')).toHaveTextContent('A 4h');
  fireEvent.click(screen.getByTitle('Auto sort tasks by priority'));
  await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
  expect(mockMutate.mock.calls[0][0]).toMatchObject({ mutation: REORDER_TASKS, variables: { input: {
    expected_order: ['Grandchild', 'Root', 'Other root', 'Child', 'Depth3'],
    tasks: ['Other root', 'Root', 'Child', 'Grandchild', 'Depth3'].map((task_id, index) => ({ task_id, priority_order: index + 1 })),
  } } });
  await waitFor(() => expect(store.getState().tasks.tasks.find(t => t.task_id === 'Other root')?.priority_order).toBe(1));
  view.unmount(); await fetchRows(); mount();
  expect(labels()).toEqual(['Other root', 'Root', 'Child', 'Grandchild', 'Depth3']);
  expect(store.getState().tasks.tasks.find(t => t.task_id === 'Root')?.child_tasks![0].child_tasks![0].child_tasks![0].assignee_resource_member_id).toBe('resource');
  expect(print(GET_PROJECT_TASKS)).toContain('priority_order'); // public roots query remains compatible
});

test.each(['auto', 'manual'])('%s uses the actual mapper once, complete pre-edit order and hidden slots; conflict rolls back then refreshes Redux', async action => {
  await fetchRows(); mockQuery.mockClear(); const pending = deferred<any>(); mockMutate.mockReturnValueOnce(pending.promise);
  const view = mount(); fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Match' } });
  if (action === 'auto') fireEvent.click(screen.getByTitle('Auto sort tasks by priority'));
  else act(() => { void mockOnDragEnd({ active: { id: 'Match high' }, over: { id: 'Match low' } }); });
  await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
  expect(labels()).toEqual(['Match high', 'Match low']);
  expect(mockMutate.mock.calls[0][0]).toEqual({ mutation: REORDER_TASKS, variables: { input: {
    project_id: 'proj-1', expected_order: ['Match low', 'Hidden', 'Match high'],
    tasks: ['Match high', 'Hidden', 'Match low'].map((task_id, index) => ({ task_id, priority_order: index + 1 })),
  } } });
  networkRows = [task('Server first', 0), ...networkRows];
  await act(async () => { pending.reject(new Error('CONFLICT')); });
  await waitFor(() => expect(mockQuery).toHaveBeenCalledTimes(1));
  expect(mockQuery).toHaveBeenCalledWith({ query: TASK_TREE_ROWS, variables: { projectId: 'proj-1' }, fetchPolicy: 'network-only' });
  await waitFor(() => expect(store.getState().tasks.tasks[0].task_id).toBe('Server first'));
  fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: '' } });
  expect(labels()).toEqual(['Server first', 'Match low', 'Hidden', 'Match high']);
  expect(view.queryClient.getQueryData(['tasks'])).toEqual(['unrelated cache']);
  expect(mockMutate).toHaveBeenCalledTimes(1);
});

test('a failed live mutation does not reset a newer valid selected saved plan', async () => {
  await fetchRows(); const pending = deferred<any>(); mockMutate.mockReturnValueOnce(pending.promise);
  const view = mount(); fireEvent.click(screen.getByTitle('Auto sort tasks by priority'));
  await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
  const snapshot = { version: 2, meta: { savedAt: '' }, tasks: [{ taskId: 'historic', title: 'Saved history', priorityOrder: 1, startDate: '2026-09-07', endDate: '2026-09-07', hoursPerDay: {} }] };
  mockLifecycle = { ...mockLifecycle, mode: 'saved', loadedPlan: { plan_id: 'B', name: 'Selected B', revision: 1 }, loadedSnapshot: snapshot, overrideBars: {} };
  view.rerender(view.ui());
  await act(async () => { pending.reject(new Error('CONFLICT')); });
  await screen.findByRole('button', { name: 'Saved history' });
  expect(mockLifecycle.backToLive).not.toHaveBeenCalled(); expect(mockLifecycle.loadedSnapshot).toBe(snapshot);
});

test.each(['resolve', 'reject'])('late mutation %s after project switch cannot restore or refetch the old project', async outcome => {
  await fetchRows(); const pending = deferred<any>(); mockMutate.mockReturnValueOnce(pending.promise);
  const view = mount(); fireEvent.click(screen.getByTitle('Auto sort tasks by priority'));
  await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
  mockProject = 'other'; networkRows = [{ ...task('Other project', 9), project_id: 'other' }]; await fetchRows(); view.rerender(view.ui()); mockQuery.mockClear();
  await act(async () => { if (outcome === 'reject') pending.reject(new Error('old conflict')); else pending.resolve({ data: { reorder_tasks: [{ task_id: 'Other project', priority_order: 1 }] } }); });
  expect(mockQuery).not.toHaveBeenCalled(); expect(store.getState().tasks.tasks[0]).toMatchObject({ project_id: 'other', priority_order: 9 });
});

test('latest live reorder intent wins over a late earlier failure', async () => {
  await fetchRows(); const first = deferred<any>(); mockMutate.mockReturnValueOnce(first.promise);
  mount(); fireEvent.click(screen.getByTitle('Auto sort tasks by priority'));
  await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
  await act(async () => { await mockOnDragEnd({ active: { id: 'Match low' }, over: { id: 'Match high' } }); });
  await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(2));
  mockQuery.mockClear(); await act(async () => { first.reject(new Error('old failure')); });
  expect(mockQuery).not.toHaveBeenCalled(); expect(labels()[0]).toBe('Match low');
});

test.each(['newer-project', 'same-project', 'reset'])('Redux rejects stale all-depth fetch after %s', async scenario => {
  const pending = deferred<any>(); mockQuery.mockReturnValueOnce(pending.promise);
  const oldRequest = store.dispatch(fetchProjectTasks('proj-1'));
  if (scenario === 'reset') store.dispatch(resetTasks());
  else {
    const project = scenario === 'same-project' ? 'proj-1' : 'other';
    networkRows = [{ ...task('Fresh', 7), project_id: project }];
    await store.dispatch(fetchProjectTasks(project)).unwrap();
  }
  pending.resolve({ data: { task_tree_rows: [task('Stale', 1)] } }); await oldRequest;
  expect(store.getState().tasks.tasks.map(t => t.task_id)).toEqual(scenario === 'reset' ? [] : ['Fresh']);
});

test('recursive imported assignment updater is preserved after the all-depth network read', async () => {
  networkRows = [task('Root', 1), task('Child', 2, 'Root'), task('Grandchild', 3, 'Child')]; await fetchRows();
  store.dispatch(updateTaskLocally({ taskId: 'Grandchild', updates: { assignee_resource_member_id: 'new-resource', assignee: undefined } }));
  expect(store.getState().tasks.tasks[0].child_tasks![0].child_tasks![0]).toMatchObject({ assignee_resource_member_id: 'new-resource', description: 'Description Grandchild', priority_order: 3 });
});
test('old mapper callers omit expected_order rather than inventing a version', () => {
  expect(mapReorderInput({ projectId: 'p', taskOrders: [{ taskId: 't', priorityOrder: 1 }] })).toEqual({ project_id: 'p', tasks: [{ task_id: 't', priority_order: 1 }] });
});
