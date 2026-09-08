import React from 'react';
import { Provider, useSelector } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TaskListView } from '../TaskListView';
import tasksReducer, { fetchProjectTasks } from '../../../redux/features/tasksSlice';
import type { Task } from '@/types/task';

const { client } = require('@/lib/apollo-client');
const mockUpdateAssignee = jest.fn();
const mockUpdateTask = jest.fn();
const mockCreateTask = jest.fn();
const mockUseQuery = jest.fn();
let mockLocale = 'en';
let mockCatalogItems: typeof catalogItems;
let mockTreeRows: Task[];

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: mockLocale, resolvedLanguage: mockLocale } }) }));
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('@/hooks/useTaskFieldMutations', () => ({
  useUpdateTaskStatus: () => ({ updateStatus: jest.fn(), isUpdating: false }),
  useUpdateTaskPriority: () => ({ updatePriority: jest.fn(), isUpdating: false }),
  useUpdateTaskEffort: () => ({ updateEffort: jest.fn(), isUpdating: false }),
  useUpdateTaskDueDate: () => ({ updateDueDate: jest.fn(), isUpdating: false }),
  useUpdateTaskAssignee: () => ({ updateAssignee: mockUpdateAssignee, isUpdating: false }),
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
jest.mock('@/lib/apollo-client', () => ({ client: { query: jest.fn(), mutate: jest.fn() } }));
jest.mock('@/graphql/mutations', () => ({ CLONE_TASK_SUBTREE: {} }), { virtual: true });
jest.mock('@/graphql/queries/tasks', () => ({ TASK_TREE_ROWS: {} }), { virtual: true });
jest.mock('@/graphql/scheduling', () => ({ RESOURCE_MEMBERS_QUERY: {} }), { virtual: true });
jest.mock('../TaskCloneDialog', () => ({ TaskCloneDialog: () => null }));
jest.mock('../TaskDetail', () => ({ TaskDetail: () => null }));
jest.mock('@apollo/client', () => ({
  gql: (strings: TemplateStringsArray) => strings.join(''),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (document: unknown) => [String(document).includes('mutation CreateTask') ? mockCreateTask : jest.fn(), { loading: false }],
}), { virtual: true });

const membersReducer = (state = { members: [] }) => state;

const parent: Task = {
  task_id: 'parent', project_id: 'project-1', title: 'Parent task', description: 'keep parent description',
  assignee_resource_member_id: 'linked-member', assignee: { userId: 'linked-user', username: 'Linked Member' },
  progressCatalogItemId: 'progress-create', categoryCatalogItemId: 'category-ui', taskTypeCatalogItemId: 'type-feature',
  priority_order: 1, status: 'TODO', priority: 'MEDIUM', effort: 8, progress: 50,
  start_date: '2026-09-09T00:00:00.000Z', actual_start_date: '2026-09-10T00:00:00.000Z', actual_end_date: '2026-09-11T00:00:00.000Z',
  tags: ['alpha'], created_by: 'owner', child_tasks: [],
};
const catalogItems = [
  { catalog_item_id: 'progress-create', project_id: 'project-1', kind: 'PROGRESS_TYPE', display_order: 0, labels: [{ locale: 'en', name: 'Create' }, { locale: 'ja', name: '作成' }, { locale: 'vi', name: 'Tạo' }] },
  { catalog_item_id: 'category-ui', project_id: 'project-1', kind: 'CATEGORY', display_order: 0, labels: [{ locale: 'en', name: 'UI' }, { locale: 'ja', name: 'UI日本語' }, { locale: 'vi', name: 'Giao diện' }] },
  { catalog_item_id: 'type-feature', project_id: 'project-1', kind: 'TASK_TYPE', display_order: 0, labels: [{ locale: 'en', name: 'Feature' }, { locale: 'ja', name: '機能' }, { locale: 'vi', name: 'Tính năng' }] },
];
const child: Task = {
  task_id: 'child', project_id: 'project-1', parent_task_id: 'parent', title: 'Deep child', description: 'keep child description',
  priority_order: 2, status: 'TODO', priority: 'MEDIUM', effort: 4, created_by: 'owner', child_tasks: [],
};

function makeStore(taskRoots: Task[] = [{ ...parent, child_tasks: [{ ...child }] }]) {
  return configureStore({
    reducer: { tasks: tasksReducer, members: membersReducer },
    preloadedState: {
      tasks: {
        tasks: taskRoots, loading: false, error: null,
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

function renderList(taskRoots?: Task[]) {
  const store = makeStore(taskRoots);
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
  localStorage.clear();
  mockCreateTask.mockReset();
  mockUpdateTask.mockReset();
  mockLocale = 'en';
  mockCatalogItems = catalogItems;
  mockTreeRows = [{ ...parent }, { ...child }];
  mockUpdateAssignee.mockImplementation(async (taskId: string, value: unknown) => ({
    ...(taskId === 'parent' ? parent : child), child_tasks: undefined, ...assignResult(taskId, value),
  }));
  mockUpdateTask.mockImplementation(async (taskId: string, updates: Partial<Task>) => ({
    ...(taskId === 'parent' ? parent : child), child_tasks: undefined, ...updates, task_id: taskId,
  }));
  mockUseQuery.mockImplementation((_document, options: { variables?: { only_assignable?: boolean; kind?: string } }) => (
    options.variables?.only_assignable
      ? { data: { resource_members: [
        { resource_member_id: 'linked-member', display_name: 'Linked Member', user_id: 'linked-user' },
        { resource_member_id: 'unlinked-member', display_name: 'Unlinked Member', user_id: null },
      ] }, loading: false }
      : options.variables?.kind
        ? { data: { project_catalog_items: mockCatalogItems.filter((item) => item.kind === options.variables?.kind) }, loading: false, refetch: jest.fn() }
        : { data: { task_tree_rows: mockTreeRows }, loading: false, refetch: jest.fn() }
  ));
});

describe('TaskListView canonical assignment source wiring', () => {
  it('creates multiple nested drafts, retains only partial failures, and retries without duplicating successes', async () => {
    const store = renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Add subtask to Parent task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add another row' }));
    const parentTitles = screen.getAllByLabelText('Subtask title for parent');
    fireEvent.change(parentTitles[0], { target: { value: 'Parent child' } });
    fireEvent.change(parentTitles[1], { target: { value: 'Second parent child' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add subtask to Deep child' }));
    fireEvent.change(screen.getByLabelText('Subtask title for child'), { target: { value: 'Grandchild' } });

    mockCreateTask
      .mockResolvedValueOnce({ data: { create_task: { ...child, task_id: 'created-one', parent_task_id: 'parent', title: 'Parent child' } } })
      .mockResolvedValueOnce({ data: { create_task: { ...child, task_id: 'created-three', parent_task_id: 'parent', title: 'Second parent child' } } })
      .mockRejectedValueOnce(new Error('temporary failure'));
    fireEvent.click(screen.getAllByRole('button', { name: 'OK / Create all' })[0]);

    await waitFor(() => expect(screen.queryByLabelText('Subtask title for parent')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Subtask title for child')).toHaveValue('Grandchild');
    expect(screen.getByRole('alert')).toHaveTextContent('temporary failure');
    expect(taskFromStore(store, 'parent')?.child_tasks?.filter((task) => ['created-one', 'created-three'].includes(task.task_id))).toHaveLength(2);
    expect(mockCreateTask.mock.calls[0][0].variables.input.priority_order).toBe(3);
    expect(mockCreateTask.mock.calls[1][0].variables.input.priority_order).toBe(4);
    expect(mockCreateTask.mock.calls[2][0].variables.input.priority_order).toBe(0);

    mockCreateTask.mockResolvedValueOnce({ data: { create_task: { ...child, task_id: 'created-two', parent_task_id: 'child', title: 'Grandchild' } } });
    fireEvent.click(screen.getByRole('button', { name: 'OK / Create all' }));
    await waitFor(() => expect(screen.queryByLabelText('Subtask title for child')).not.toBeInTheDocument());
    expect(mockCreateTask).toHaveBeenCalledTimes(4);
    expect(taskFromStore(store, 'child')?.child_tasks?.filter((task) => task.task_id === 'created-two')).toHaveLength(1);
  });
  it('uses catalog display order for the same child grouping in Normal and Excel', () => {
    const review = { ...child, task_id: 'review-old', title: 'Review old', priority_order: 8, progressCatalogItemId: 'progress-review' };
    const design = { ...child, task_id: 'design-old', title: 'Design old', priority_order: 2, progressCatalogItemId: 'progress-design' };
    const designNew = { ...child, task_id: 'design-new', title: 'Design new', priority_order: 12, progressCatalogItemId: 'progress-design' };
    const unset = { ...child, task_id: 'unset', title: 'Unset progress', priority_order: 1, progressCatalogItemId: undefined };
    const root = { ...parent, child_tasks: [design, unset, designNew, review] };
    mockCatalogItems = [
      ...catalogItems.filter((item) => item.kind !== 'PROGRESS_TYPE'),
      { ...catalogItems[0], catalog_item_id: 'progress-review', display_order: 0 },
      { ...catalogItems[0], catalog_item_id: 'progress-design', display_order: 1 },
    ];
    mockTreeRows = [{ ...root, child_tasks: undefined }, design, unset, designNew, review];

    renderList([root]);
    fireEvent.click(screen.getByRole('button', { name: 'Mở rộng task con' }));
    const normalRows = Array.from(document.querySelectorAll('tbody tr')).map((row) => row.textContent ?? '');
    expect(['Review old', 'Design old', 'Design new', 'Unset progress'].map((title) =>
      normalRows.findIndex((row) => row.includes(title))
    )).toEqual([1, 2, 3, 4]);

    fireEvent.click(screen.getByTestId('mode-excel-btn'));
    const excelIds = Array.from(document.querySelectorAll('[data-field="title"]'))
      .map((cell) => cell.getAttribute('data-task-id'));
    expect(excelIds).toEqual(['parent', 'review-old', 'design-old', 'design-new', 'unset']);
  });

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

    fireEvent.change(within(parentRow).getByRole('combobox', { name: 'Người được giao' }), { target: { value: '' } });

    await waitFor(() => expect(taskFromStore(store, 'parent')?.assignee_resource_member_id).toBeNull());
    expect(taskFromStore(store, 'parent')?.description).toBe('keep parent description');

    fireEvent.click(within(parentRow).getByRole('button', { name: 'Mở rộng task con' }));
    const childRow = screen.getByText('Deep child').closest('tr')!;
    fireEvent.change(within(childRow).getByRole('combobox', { name: 'Người được giao' }), { target: { value: 'resource:unlinked-member' } });

    await waitFor(() => expect(taskFromStore(store, 'child')).toMatchObject({
      assignee_resource_member_id: 'unlinked-member', assignee: undefined,
    }));
    expect(taskFromStore(store, 'child')?.description).toBe('keep child description');
    expect(mockUpdateAssignee).toHaveBeenLastCalledWith('child', {
      assigneeId: null, assigneeResourceMemberId: 'unlinked-member',
    });
  });

  it('edits and explicitly clears Progress, Actual dates, and Tags in Normal mode', async () => {
    const store = renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    for (const label of ['Progress', 'Actual start', 'Actual end', 'Tags']) fireEvent.click(screen.getByLabelText(label));

    for (const [label, field, canonical] of [
      ['Progress', 'progress', null],
      ['Actual start', 'actual_start_date', null],
      ['Actual end', 'actual_end_date', null],
      ['Tags', 'tags', []],
    ] as const) {
      mockUpdateTask.mockResolvedValueOnce({ task_id: 'parent', [field]: canonical });
      fireEvent.click(screen.getByRole('button', { name: `Edit ${label} Parent task` }));
      const input = within(screen.getByText('Parent task').closest('tr')!).getByLabelText(label);
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.click(input.parentElement!.querySelector('button[title="Lưu"]')!);
      await waitFor(() => expect(mockUpdateTask).toHaveBeenCalledWith('parent', field === 'tags' ? { tags: [] } : { [field]: null }));
    }

    expect(taskFromStore(store, 'parent')).toMatchObject({ progress: null, actual_start_date: null, actual_end_date: null, tags: [] });
  });

  it('edits and clears canonical Start date in Normal mode from the authoritative result', async () => {
    mockUpdateTask.mockResolvedValueOnce({ ...parent, start_date: null });
    const store = renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Start date Parent task' }));
    const input = screen.getByLabelText('Start date');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(input.parentElement!.querySelector('button[title="Lưu"]')!);

    await waitFor(() => expect(mockUpdateTask).toHaveBeenCalledWith('parent', { start_date: null }));
    expect(taskFromStore(store, 'parent')?.start_date).toBeNull();
  });

  it('keeps parent effort derived and reflects a canonical leaf save in the normal List total', async () => {
    client.mutate.mockResolvedValue({ data: { update_task: { task_id: 'child', effort: 13 } } });
    const store = renderList();
    expect(screen.getByTestId('task-effort-parent')).toHaveTextContent('4h');
    expect(screen.getByTestId('task-effort-parent')).toHaveAttribute('title', 'Sum of descendant leaf effort');
    fireEvent.click(screen.getByRole('button', { name: 'Mở rộng task con' }));
    fireEvent.click(screen.getByTestId('task-effort-child'));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Công sức' }), { target: { value: '13' } });
    fireEvent.click(screen.getByText('Deep child').closest('tr')!.querySelector('button[title="Lưu"]')!);

    await waitFor(() => expect(screen.getByTestId('task-effort-parent')).toHaveTextContent('13h'));
    expect(taskFromStore(store, 'child')?.effort).toBe(13);
    expect(taskFromStore(store, 'parent')?.effort).toBe(8);
    expect(client.mutate).toHaveBeenCalledWith(expect.objectContaining({ variables: { input: { task_id: 'child', effort: 13 } } }));
  });

  it('keeps normal leaf effort editor and error after a rejected or incomplete save', async () => {
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
    client.mutate.mockResolvedValue({ data: { update_task: { task_id: 'child' } } });
    const store = renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Mở rộng task con' }));
    fireEvent.click(screen.getByTestId('task-effort-child'));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Công sức' }), { target: { value: '13' } });
    fireEvent.click(screen.getByText('Deep child').closest('tr')!.querySelector('button[title="Lưu"]')!);

    await waitFor(() => expect(alert).toHaveBeenCalledWith(expect.stringContaining('Effort update returned no complete task result.')));
    expect(screen.getByRole('spinbutton', { name: 'Công sức' })).toHaveValue(13);
    expect(taskFromStore(store, 'child')?.effort).toBe(4);
    alert.mockRestore();
  });

  it('clears canonical Start date in Excel and applies the authoritative result immediately', async () => {
    mockUpdateTask.mockResolvedValueOnce({ ...parent, start_date: null });
    const store = renderList();
    fireEvent.click(screen.getByTestId('mode-excel-btn'));
    fireEvent.doubleClick(screen.getByTestId('excel-cell-0-9'));
    fireEvent.change(screen.getByLabelText('Excel start date'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('excel-save-btn'));

    await waitFor(() => expect(mockUpdateTask).toHaveBeenCalledWith('parent', { start_date: null }));
    expect(taskFromStore(store, 'parent')?.start_date).toBeNull();
  });

  it('reflects staged and confirmed Excel leaf effort in its read-only parent total', async () => {
    client.mutate.mockResolvedValue({ data: { update_task: { task_id: 'child', effort: 14 } } });
    const store = renderList();
    fireEvent.click(screen.getByTestId('mode-excel-btn'));
    expect(screen.getByTestId('excel-cell-0-3')).toHaveTextContent('4');
    fireEvent.mouseDown(screen.getByTestId('excel-cell-1-3'));
    fireEvent.change(screen.getByTestId('excel-typing-input'), { target: { value: '14' } });
    fireEvent.keyDown(screen.getByTestId('excel-typing-input'), { key: 'Enter' });
    expect(screen.getByTestId('excel-cell-0-3')).toHaveTextContent('14');
    fireEvent.click(screen.getByTestId('excel-save-btn'));

    await waitFor(() => expect(screen.getByTestId('excel-cell-1-3')).toHaveTextContent('14'));
    expect(taskFromStore(store, 'child')?.effort).toBe(14);
    expect(taskFromStore(store, 'parent')?.effort).toBe(8);
  });

  it('clears Excel leaf effort through the backend zero contract and updates its parent total', async () => {
    client.mutate.mockResolvedValue({ data: { update_task: { task_id: 'child', effort: 0 } } });
    const store = renderList();
    fireEvent.click(screen.getByTestId('mode-excel-btn'));
    fireEvent.doubleClick(screen.getByTestId('excel-cell-1-3'));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Excel effort' }), { target: { value: '' } });
    expect(screen.getByTestId('excel-cell-0-3')).toHaveTextContent('0');
    fireEvent.click(screen.getByTestId('excel-save-btn'));

    await waitFor(() => expect(screen.getByTestId('excel-cell-1-3')).toHaveTextContent('0'));
    expect(taskFromStore(store, 'child')?.effort).toBe(0);
    expect(client.mutate).toHaveBeenCalledWith(expect.objectContaining({ variables: { input: { task_id: 'child', effort: 0 } } }));
  });

  it('applies an authoritative null to every saved Excel row without a reload', async () => {
    mockUseQuery.mockImplementation((_document, options: { variables?: { only_assignable?: boolean; kind?: string } }) => (
      options.variables?.only_assignable
        ? { data: { resource_members: [] }, loading: false }
        : options.variables?.kind
          ? { data: { project_catalog_items: catalogItems.filter((item) => item.kind === options.variables?.kind) }, loading: false, refetch: jest.fn() }
          : { data: { task_tree_rows: [{ ...parent, due_date: '2026-09-10T00:00:00Z' }, { ...child, due_date: '2026-09-11T00:00:00Z' }] }, loading: false, refetch: jest.fn() }
    ));
    client.mutate
      .mockResolvedValueOnce({ data: { update_task: { task_id: 'parent', due_date: null } } })
      .mockResolvedValueOnce({ data: { update_task: { task_id: 'child', due_date: null } } });
    const store = renderList();
    fireEvent.click(screen.getByTestId('mode-excel-btn'));
    for (const row of [0, 1]) {
      fireEvent.mouseDown(screen.getByTestId(`excel-cell-${row}-4`));
      fireEvent.keyDown(screen.getByTestId('excel-typing-input'), { key: 'Delete' });
    }
    fireEvent.click(screen.getByTestId('excel-save-btn'));

    await waitFor(() => expect(screen.queryByTestId('excel-dirty-count')).not.toBeInTheDocument());
    expect(screen.getByTestId('excel-cell-0-4')).toHaveTextContent('');
    expect(screen.getByTestId('excel-cell-1-4')).toHaveTextContent('');
    expect(taskFromStore(store, 'parent')?.due_date).toBeNull();
    expect(taskFromStore(store, 'child')?.due_date).toBeNull();
  });

  it('keeps title editable in Normal mode and upserts the authoritative result', async () => {
    const store = renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Mở rộng task con' }));
    expect(screen.getByText('Deep child')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit title Parent task' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Task title' }), { target: { value: 'Renamed parent' } });
    fireEvent.click(screen.getByTitle('Lưu'));
    await waitFor(() => expect(mockUpdateTask).toHaveBeenCalledWith('parent', { title: 'Renamed parent' }));
    expect(taskFromStore(store, 'parent')).toMatchObject({ title: 'Renamed parent', description: 'keep parent description' });
    expect(taskFromStore(store, 'parent')?.child_tasks).toHaveLength(1);
    expect(screen.getByText('Deep child')).toBeInTheDocument();
  });

  it('saves normal catalog selection and explicit clear from authoritative task results', async () => {
    const store = renderList();
    const row = screen.getByText('Parent task').closest('tr')!;
    fireEvent.change(within(row).getByRole('combobox', { name: 'Progress type' }), { target: { value: '' } });
    await waitFor(() => expect(mockUpdateTask).toHaveBeenCalledWith('parent', { progressCatalogItemId: null }));
    expect(taskFromStore(store, 'parent')?.progressCatalogItemId).toBeNull();

    fireEvent.change(within(row).getByRole('combobox', { name: 'Category' }), { target: { value: 'category-ui' } });
    await waitFor(() => expect(mockUpdateTask).toHaveBeenCalledWith('parent', { categoryCatalogItemId: 'category-ui' }));
    expect(taskFromStore(store, 'parent')?.description).toBe('keep parent description');
  });

  it('renders stable catalog IDs as selected-locale labels in normal and Excel views', () => {
    const store = makeStore();
    const view = render(<Provider store={store}><TaskSource /></Provider>);
    const row = screen.getByText('Parent task').closest('tr')!;
    expect(row).toHaveTextContent('Create');
    expect(row).toHaveTextContent('UI');
    expect(row).toHaveTextContent('Feature');

    mockLocale = 'ja';
    view.rerender(<Provider store={store}><TaskSource /></Provider>);
    expect(row).toHaveTextContent('作成');
    expect(row).toHaveTextContent('UI日本語');
    expect(row).toHaveTextContent('機能');
    expect(taskFromStore(store, 'parent')).toMatchObject({
      progressCatalogItemId: 'progress-create', categoryCatalogItemId: 'category-ui', taskTypeCatalogItemId: 'type-feature',
    });

    fireEvent.click(screen.getByTestId('mode-excel-btn'));
    expect(screen.getByTestId('excel-cell-0-6')).toHaveTextContent('作成');
    expect(screen.getByTestId('excel-cell-0-7')).toHaveTextContent('UI日本語');
    expect(screen.getByTestId('excel-cell-0-8')).toHaveTextContent('機能');
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
