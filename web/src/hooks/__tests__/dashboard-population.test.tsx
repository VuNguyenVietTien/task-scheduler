import { act, renderHook, waitFor } from '@testing-library/react';
import { useApolloClient } from '@apollo/client';
import {
  GET_DASHBOARD_PROJECTS,
  GET_DASHBOARD_TASK_ROWS,
} from '@/graphql/queries/dashboard';
import { useDashboardTasks } from '@/hooks/use-dashboard-tasks';

jest.mock('@apollo/client', () => ({
  ...jest.requireActual('@apollo/client'),
  useApolloClient: jest.fn(),
}));

const query = jest.fn();
const task = (task_id: string, project_id: string, status: string, assigneeId?: string) => ({
  task_id,
  title: task_id,
  project_id,
  status,
  priority: 'MEDIUM',
  type_: null,
  due_date: null,
  assignee: assigneeId ? { user_id: assigneeId } : null,
});

beforeEach(() => {
  jest.clearAllMocks();
  (useApolloClient as jest.Mock).mockReturnValue({ query });
});

function mockVisibleProjects(rowsByProject: Record<string, unknown[]>, projects = Object.keys(rowsByProject)) {
  query.mockImplementation(({ query: document, variables }: { query: unknown; variables?: { projectId: string } }) => {
    if (document === GET_DASHBOARD_PROJECTS) {
      return Promise.resolve({ data: { projects: projects.map(project_id => ({ project_id })) } });
    }
    if (document === GET_DASHBOARD_TASK_ROWS) {
      return Promise.resolve({ data: { task_tree_rows: rowsByProject[variables!.projectId] } });
    }
    throw new Error('Unexpected dashboard document');
  });
}

test('uses authorized project rows, counts all depths once, and retains dashboard status filters', async () => {
  mockVisibleProjects({
    p1: [
      task('root', 'p1', 'TODO', 'other-user'),
      task('child', 'p1', 'DOING', 'member'),
      task('grandchild', 'p1', 'TODO', 'member'),
      task('grandchild', 'p1', 'TODO', 'member'),
      task('wrong-project', 'not-visible', 'TODO', 'member'),
    ],
    p2: [task('done', 'p2', 'DONE', 'member')],
  });

  const hook = renderHook(() => useDashboardTasks('manager', 'manager'));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));

  expect(query.mock.calls[0][0]).toMatchObject({ query: GET_DASHBOARD_PROJECTS });
  expect(query.mock.calls.slice(1)).toEqual(expect.arrayContaining([
    [expect.objectContaining({ query: GET_DASHBOARD_TASK_ROWS, variables: { projectId: 'p1' } })],
    [expect.objectContaining({ query: GET_DASHBOARD_TASK_ROWS, variables: { projectId: 'p2' } })],
  ]));
  expect(hook.result.current.tasks.map(current => current.task_id)).toEqual(['root', 'child', 'grandchild', 'done']);
  expect(hook.result.current.activeTasks).toHaveLength(3);
  expect(hook.result.current.doingTasks).toHaveLength(1);
});

test('filters a member by each flat row, not by a differently assigned parent', async () => {
  mockVisibleProjects({
    p1: [
      task('root', 'p1', 'TODO', 'other-user'),
      task('child', 'p1', 'DOING', 'member'),
      task('grandchild', 'p1', 'TODO', 'member'),
    ],
  });

  const hook = renderHook(() => useDashboardTasks('member', 'member'));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));

  expect(hook.result.current.tasks.map(current => current.task_id)).toEqual(['child', 'grandchild']);
  expect(hook.result.current.tasksByStatus).toEqual(expect.objectContaining({ DOING: [expect.anything()], TODO: [expect.anything()] }));
});

test('keeps an authorized empty project population empty', async () => {
  mockVisibleProjects({}, []);

  const hook = renderHook(() => useDashboardTasks('member', 'member'));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));

  expect(hook.result.current.error).toBeUndefined();
  expect(hook.result.current.tasks).toEqual([]);
  expect(hook.result.current.activeTasks).toEqual([]);
});

test('surfaces a project task failure instead of reporting a partial population as zero', async () => {
  mockVisibleProjects({ p1: [task('root', 'p1', 'TODO', 'member')], p2: [] });
  query.mockImplementationOnce(() => Promise.resolve({ data: { projects: [{ project_id: 'p1' }, { project_id: 'p2' }] } }))
    .mockImplementationOnce(() => Promise.resolve({ data: { task_tree_rows: [task('root', 'p1', 'TODO', 'member')] } }))
    .mockImplementationOnce(() => Promise.reject(new Error('p2 unavailable')));

  const hook = renderHook(() => useDashboardTasks('member', 'member'));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));

  expect(hook.result.current.error).toHaveProperty('message', 'p2 unavailable');
  expect(hook.result.current.tasks).toEqual([]);
  expect(hook.result.current.activeTasks).toEqual([]);
});

test('a prior user request cannot overwrite the newer member population', async () => {
  let resolveFirstProjects!: (result: unknown) => void;
  let projectCalls = 0;
  query.mockImplementation(({ query: document, variables }: { query: unknown; variables?: { projectId: string } }) => {
    if (document === GET_DASHBOARD_PROJECTS) {
      if (projectCalls++ === 0) return new Promise(resolve => { resolveFirstProjects = resolve; });
      return Promise.resolve({ data: { projects: [{ project_id: 'new-project' }] } });
    }
    return Promise.resolve({ data: { task_tree_rows: [task(variables!.projectId, variables!.projectId, 'TODO', 'new-member')] } });
  });

  const hook = renderHook(({ userId }) => useDashboardTasks(userId, 'member'), { initialProps: { userId: 'old-member' } });
  await waitFor(() => expect(projectCalls).toBe(1));
  hook.rerender({ userId: 'new-member' });
  await waitFor(() => expect(hook.result.current.tasks.map(current => current.task_id)).toEqual(['new-project']));

  await act(async () => { resolveFirstProjects({ data: { projects: [{ project_id: 'old-project' }] } }); });
  await waitFor(() => expect(hook.result.current.tasks.map(current => current.task_id)).toEqual(['new-project']));
});

test('refresh replaces prior rows and cannot retain a previous project population', async () => {
  let refresh = false;
  query.mockImplementation(({ query: document, variables }: { query: unknown; variables?: { projectId: string } }) => {
    if (document === GET_DASHBOARD_PROJECTS) {
      return Promise.resolve({ data: { projects: [{ project_id: refresh ? 'p2' : 'p1' }] } });
    }
    return Promise.resolve({ data: { task_tree_rows: [task(refresh ? 'fresh' : 'stale', variables!.projectId, 'TODO', 'member')] } });
  });

  const hook = renderHook(() => useDashboardTasks('member', 'member'));
  await waitFor(() => expect(hook.result.current.tasks.map(current => current.task_id)).toEqual(['stale']));

  refresh = true;
  await act(async () => { await hook.result.current.refetch(); });

  expect(hook.result.current.tasks.map(current => current.task_id)).toEqual(['fresh']);
  expect(query).toHaveBeenCalledWith(expect.objectContaining({ query: GET_DASHBOARD_PROJECTS, fetchPolicy: 'network-only' }));
});
