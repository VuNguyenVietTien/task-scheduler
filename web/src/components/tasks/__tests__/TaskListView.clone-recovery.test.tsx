import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TaskListView } from '../TaskListView';
import type { Task } from '@/types/task';

const cloneMutation = jest.fn();
const refetch = jest.fn();
const dispatch = jest.fn(() => ({ unwrap: () => Promise.resolve([]) }));
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
  useUpdateTask: () => ({ updateTask: jest.fn() }),
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

  it('locks the committed clone flow when refresh fails rather than offering a duplicate mutation', async () => {
    cloneMutation.mockResolvedValue({ data: { clone_task_subtree: { created_task_ids: ['created-root'] } } });
    refetch.mockRejectedValue(new Error('refresh down'));
    openClone();
    submitClone();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(
      'Created 1 copies (1 tasks), but the task list could not be refreshed. Refresh task list before creating another copy.'
    ));
    expect(screen.getByRole('button', { name: 'Create 1 copy (1 task)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Refresh task list' })).toBeEnabled();
    expect(cloneMutation).toHaveBeenCalledTimes(1);
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
