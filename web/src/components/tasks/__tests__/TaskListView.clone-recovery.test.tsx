import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TaskListView } from '../TaskListView';
import type { Task } from '@/types/task';

const cloneMutation = jest.fn();
const refetch = jest.fn();
const dispatch = jest.fn(() => ({ unwrap: () => Promise.resolve([]) }));
const mockUpdateTask = jest.fn();
let treeQuery: Record<string, unknown>;

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../../../redux/hooks', () => ({
  useAppDispatch: () => dispatch,
  useAppSelector: () => [],
}));
jest.mock('@/hooks/useTaskFieldMutations', () => ({
  useUpdateTaskStatus: () => ({ updateStatus: jest.fn(), isUpdating: false }),
  useUpdateTaskPriority: () => ({ updatePriority: jest.fn(), isUpdating: false }),
  useUpdateTaskEffort: () => ({ updateEffort: jest.fn(), isUpdating: false }),
  useUpdateTaskDueDate: () => ({ updateDueDate: jest.fn(), isUpdating: false }),
  useUpdateTaskAssignee: () => ({ updateAssignee: jest.fn(), isUpdating: false }),
}));
jest.mock('@/hooks/useTasks', () => ({
  useUpdateTaskPriorityOrder: () => jest.fn(),
  useUpdateTask: () => ({ updateTask: mockUpdateTask }),
}));
jest.mock('@/hooks/useProjectTaxonomies', () => ({
  useProjectTaxonomies: () => ({
    phases: [], loading: false, ensureDefaultPhases: jest.fn(), createPhase: jest.fn(),
    updatePhase: jest.fn(), archivePhase: jest.fn(), setTaskPhase: jest.fn(),
  }),
}));
jest.mock('@/components/projects/phase-controls', () => ({
  PhaseFilterSelect: () => null, TaskPhaseSelect: () => null, applyPhaseFilter: (tasks: Task[]) => tasks,
}));
jest.mock('@/components/projects/PhaseSettingsPanel', () => ({ PhaseSettingsPanel: () => null }));
jest.mock('@/components/common/UserAvatar', () => ({ UserAvatar: () => null }));
jest.mock('../TaskDetail', () => ({ TaskDetail: () => null }));
jest.mock('@/components/ui/Dialog', () => ({
  Dialog: ({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) =>
    open ? <div role="dialog" aria-label={title}>{children}</div> : null,
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/apollo-client', () => ({ client: { query: jest.fn(), mutate: jest.fn() } }));
jest.mock('@apollo/client', () => ({
  gql: (strings: TemplateStringsArray) => strings.join(''),
  useQuery: (_document: unknown, options: { variables?: { only_assignable?: boolean } }) => (
    options.variables?.only_assignable
      ? { data: { resource_members: [] }, loading: false }
      : treeQuery
  ),
  useMutation: () => [cloneMutation, { loading: false }],
}), { virtual: true });

const root: Task = {
  task_id: 'root', project_id: 'project-1', title: 'Root task', priority_order: 1,
  status: 'TODO', priority: 'MEDIUM', created_by: 'owner', child_tasks: [],
};

function openClone() {
  render(<TaskListView tasks={[root]} />);
  fireEvent.click(screen.getByTestId('clone-task-root'));
}

function submitClone() {
  fireEvent.click(screen.getByRole('button', { name: 'Create 1 copy (1 task)' }));
}

beforeEach(() => {
  jest.clearAllMocks();
  treeQuery = { data: { task_tree_rows: [root] }, loading: false, error: undefined, refetch };
  refetch.mockResolvedValue({ data: { task_tree_rows: [root] } });
  mockUpdateTask.mockImplementation(async (taskId: string, updates: Partial<Task>) => ({
    ...root, task_id: taskId, ...updates,
  }));
});

describe('TaskListView clone recovery', () => {
  it('shows an initial tree-query failure with an explicit retry instead of perpetual loading', () => {
    treeQuery = { data: undefined, loading: false, error: new Error('tree offline'), refetch };
    openClone();

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load task tree: tree offline');
    expect(screen.getByRole('button', { name: 'Refresh task list' })).toBeEnabled();
    expect(screen.queryByText('Loading task tree…')).not.toBeInTheDocument();
  });

  it('refreshes after CONFLICT and closes the stale selection instead of retrying the mutation', async () => {
    cloneMutation.mockRejectedValue({ graphQLErrors: [{ extensions: { code: 'CONFLICT' } }] });
    openClone();
    submitClone();

    await waitFor(() => expect(refetch).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Clone task' })).not.toBeInTheDocument());
  });

  it('retains a confirmed clone checkpoint when append refresh fails instead of cloning twice', async () => {
    cloneMutation.mockResolvedValue({ data: { clone_task_subtree: { root_task_ids: ['created-root'], created_task_ids: ['created-root'] } } });
    refetch.mockRejectedValue(new Error('refresh down'));
    openClone();
    submitClone();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(
      '0 of 1 clone destinations completed. Created tasks are safe; retry to finish append ordering.'
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Create 1 copy (1 task)' }));
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(2));
    expect(cloneMutation).toHaveBeenCalledTimes(1);
  });

  it('retries only unfinished destinations and appends each canonical root after existing children', async () => {
    const child: Task = { ...root, task_id: 'child', parent_task_id: 'root', title: 'Child', priority_order: 2 };
    const targetA: Task = { ...root, task_id: 'target-a', title: 'Target A', priority_order: 3 };
    const targetB: Task = { ...root, task_id: 'target-b', title: 'Target B', priority_order: 4 };
    const existingA: Task = { ...root, task_id: 'existing-a', parent_task_id: 'target-a', title: 'Existing A', priority_order: 7 };
    const existingB: Task = { ...root, task_id: 'existing-b', parent_task_id: 'target-b', title: 'Existing B', priority_order: 11 };
    const rows = [root, child, targetA, existingA, targetB, existingB];
    treeQuery = { data: { task_tree_rows: rows }, loading: false, error: undefined, refetch };
    refetch.mockResolvedValue({ data: { task_tree_rows: rows } });
    cloneMutation
      .mockResolvedValueOnce({ data: { clone_task_subtree: { root_task_ids: ['clone-a'], created_task_ids: ['clone-a'] } } })
      .mockRejectedValueOnce({ graphQLErrors: [{ message: 'destination failed' }] })
      .mockResolvedValueOnce({ data: { clone_task_subtree: { root_task_ids: ['clone-b'], created_task_ids: ['clone-b'] } } });

    openClone();
    fireEvent.click(screen.getByRole('checkbox', { name: /Clone parent task: Root task/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Destination parent: Target A' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Destination parent: Target B' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create 1 copy per destination (2 tasks)' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('1 of 2 clone destinations completed. Retry to continue.'));
    expect(mockUpdateTask).toHaveBeenCalledWith('clone-a', { priority_order: 8 });
    fireEvent.click(screen.getByRole('button', { name: 'Create 1 copy per destination (2 tasks)' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Clone task' })).not.toBeInTheDocument());
    expect(cloneMutation).toHaveBeenCalledTimes(3);
    expect(cloneMutation.mock.calls[0][0].variables.input.destination_parent_task_id).toBe('target-a');
    expect(cloneMutation.mock.calls[1][0].variables.input.destination_parent_task_id).toBe('target-b');
    expect(cloneMutation.mock.calls[2][0].variables.input.destination_parent_task_id).toBe('target-b');
    expect(mockUpdateTask).toHaveBeenCalledWith('clone-b', { priority_order: 12 });
  });

  it('does not claim a refresh after an unknown network outcome when refresh also fails', async () => {
    cloneMutation.mockRejectedValue({ networkError: new Error('connection lost') });
    refetch.mockRejectedValue(new Error('refresh down'));
    openClone();
    submitClone();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not confirm clone. The task list could not be refreshed; do not retry until it succeeds.'
    ));
    expect(screen.getByRole('button', { name: 'Create 1 copy (1 task)' })).toBeDisabled();
    expect(screen.queryByText('Could not confirm clone; task list refreshed. Check results before retrying.')).not.toBeInTheDocument();
    expect(cloneMutation).toHaveBeenCalledTimes(1);
  });
});
