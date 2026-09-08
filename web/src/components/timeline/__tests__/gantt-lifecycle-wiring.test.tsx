import React from 'react';
import { act } from 'react-dom/test-utils';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import '@/i18n/i18n-config';
import { Timeline } from '../Timeline';
import { store } from '@/redux/store';
import { fetchProjectTasks } from '@/redux/features/tasksSlice';
import type { Task } from '@/types/task';
import type { UsePlanLifecycleResult } from '@/hooks/usePlanLifecycle';
import { draftFromCurrentTasks, type PlanSnapshot } from '@/utils/planLifecycle';
import { updateAutoSort } from '@/redux/features/taskOrderStore';
import type { WbsRow, PhaseRollupSummary } from '@/types/schedule-projection';

const mockUsePlanLifecycle = jest.fn();
const mockReorderMutation = jest.fn();

jest.mock('@/hooks/usePlanLifecycle', () => ({
  usePlanLifecycle: (...args: unknown[]) => mockUsePlanLifecycle(...args),
}));
jest.mock('@/hooks/useProjectSchedulingConfig', () => ({
  useProjectSchedulingConfig: () => mockSchedulingConfig,
}));
jest.mock('@/hooks/useProjectTaxonomies', () => ({
  useProjectTaxonomies: () => ({ phases: [] }),
}));
jest.mock('@/hooks/useProjectCatalogs', () => ({
  useProjectCatalogs: () => ({ items: [
    { catalog_item_id: '00000000-0000-0000-0000-000000000001', project_id: 'proj-1', kind: 'PROGRESS_TYPE', display_order: 1, labels: [{ locale: 'en', name: 'Creation' }] },
    { catalog_item_id: '00000000-0000-0000-0000-000000000002', project_id: 'proj-1', kind: 'PROGRESS_TYPE', display_order: 2, labels: [{ locale: 'en', name: 'Review' }] },
  ], loading: false, error: undefined, refetch: jest.fn() }),
}));
jest.mock('@/hooks/useScheduleProjection', () => ({
  useScheduleProjection: () => ({
    wbsRows: mockProjectionRows,
    masterRows: { phase_groups: mockPhaseGroups, unphased_group: { phase_id: null, name: 'Unphased', task_ids: [], task_count: 0 } },
    loading: false,
  }),
}));
jest.mock('@/hooks/useTasks', () => ({
  useReorderTasks: () => ({ mutateAsync: mockReorderMutation }),
}));
jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'proj-1' }) }));
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../../tasks/TaskDetail', () => ({
  TaskDetail: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div role="dialog" /> : null,
}));

let mockProjectionRows: WbsRow[] = [];
let mockPhaseGroups: PhaseRollupSummary[] = [];

const members = [
  { resource_member_id: 'rm-current', display_name: 'Current assignee', user_id: 'u-current', member_kind: 'MEMBER' },
  { resource_member_id: 'rm-saved', display_name: 'Saved assignee', user_id: null, member_kind: 'MEMBER' },
  { resource_member_id: 'rm-zero', display_name: 'Zero member', user_id: null, member_kind: 'MEMBER' },
];

const mockSchedulingConfig = {
  loading: false,
  error: undefined,
  resourceMembers: members,
  memberGroups: {},
  memberCapacity: {},
  defaultCapacity: { weekdayHours: 8, weekendHours: 0, dateOverrides: {} },
  daysOff: [],
  commitments: [],
  groups: [],
  capacityFor: () => () => 8,
  configFor: () => ({ weekdayHours: 8, weekendHours: 0, dateOverrides: {} }),
  groupIdsFor: () => [],
  reservedFor: () => ({}),
  truncatedCommitmentRules: new Set<string>(),
  memberKeyFor: (userId?: string | null) => userId === 'u-current' ? 'rm-current' : userId || 'unassigned',
};

const liveTasks = [
  {
    task_id: 'parent', id: 'parent', project_id: 'proj-1', title: 'Live parent',
    status: 'TODO', priority: 'LOW', priority_order: 1, effort: 8,
    start_date: '2026-10-20', due_date: '2026-10-20', created_by: 'u0',
    assignee_resource_member_id: 'rm-current',
    assignee: { userId: 'u-current', username: 'Current assignee' },
  },
  {
    task_id: 'child', id: 'child', project_id: 'proj-1', title: 'Live child',
    parent_task_id: null, status: 'TODO', priority: 'CRITICAL', priority_order: 2,
    effort: 2, start_date: '2026-10-21', due_date: '2026-10-21', created_by: 'u0',
    assignee_resource_member_id: 'rm-current',
    assignee: { userId: 'u-current', username: 'Current assignee' },
  },
  {
    task_id: 'live-only', id: 'live-only', project_id: 'proj-1', title: 'Live only',
    status: 'TODO', priority: 'MEDIUM', priority_order: 3, effort: 4,
    start_date: '2026-09-09', created_by: 'u0',
  },
] as Task[];

function lifecycle(overrides: Partial<UsePlanLifecycleResult> = {}): UsePlanLifecycleResult {
  return {
    mode: 'live', draft: null, draftSource: null, basePlanId: null,
    loadedPlan: null, savedBars: {}, overrideBars: null, loadedSnapshot: null,
    plans: [], plansLoading: false, saving: false, error: null, exhaustedTaskIds: [],
    newPlan: jest.fn(), recalculate: jest.fn(), loadPlan: jest.fn(), savePlan: jest.fn(),
    reorderDraft: jest.fn(), backToLive: jest.fn(), deletePlan: jest.fn(), setActivePlan: jest.fn(),
    ...overrides,
  };
}

function renderTimeline(lc: UsePlanLifecycleResult, tasks: Task[] = liveTasks) {
  mockUsePlanLifecycle.mockReturnValue(lc);
  act(() => {
    store.dispatch({ type: fetchProjectTasks.fulfilled.type, payload: tasks } as never);
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MockedProvider mocks={[]} addTypename={false}>
          <Timeline />
        </MockedProvider>
      </Provider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProjectionRows = []; mockPhaseGroups = [];
  mockSchedulingConfig.loading = false; mockSchedulingConfig.error = undefined;
  mockSchedulingConfig.capacityFor = () => () => 8;
  act(() => { store.dispatch(updateAutoSort(false)); });
  localStorage.setItem('ganttChartDateRange', JSON.stringify({
    startDate: '2026-09-01T00:00:00.000Z',
    endDate: '2026-09-30T00:00:00.000Z',
  }));
});

const savedTask = (assignment: object = {}) => ({ taskId: 'parent', title: 'Historical', startDate: '2026-09-07', endDate: '2026-09-09', hoursPerDay: { '2026-09-08': 8 }, priorityOrder: 1, ...assignment });
function savedLifecycle(assignment: object = {}, legacy = false) {
  const task = savedTask(assignment);
  return lifecycle({ mode: 'saved', loadedPlan: { plan_id: 'B', project_id: 'proj-1', name: 'Displayed B', revision: 1, is_active: false, stale: false, stale_reasons: [], plan_data: {} },
    loadedSnapshot: { version: 2, meta: { savedAt: '', legacyHoursMissing: legacy }, tasks: [{ ...task, hoursPerDay: legacy ? {} : task.hoursPerDay }] },
    overrideBars: { parent: { start: task.startDate, end: task.endDate, hoursPerDay: legacy ? {} : task.hoursPerDay } },
  });
}

describe('Authority regression wiring R1-R11', () => {
  it('R1 New Plan receives matching IDs only before collapse, not ancestor accounting', async () => {
    renderTimeline(lifecycle(), [liveTasks[0], { ...liveTasks[1], parent_task_id: 'parent' }, liveTasks[2]]);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Live child' } });
    fireEvent.click(screen.getByTestId('new-plan-btn'));
    const scheduling = mockUsePlanLifecycle.mock.calls.at(-1)[1];
    expect(Array.from(scheduling.selectedTaskIds ?? [])).toEqual(['child']);
    const draft = draftFromCurrentTasks(scheduling);
    expect(draft.snapshot.tasks.map(t => t.taskId)).toEqual(['child']);
    expect(draft.snapshot.meta.contextTasks?.map(t => t.taskId)).toEqual(['parent']);
  });
  it.each([
    [{ assigneeResourceMemberId: null }, 'diagnostic:unassigned'],
    [{ assigneeUserId: null }, 'diagnostic:unassigned'],
    [{ assigneeResourceMemberId: null, assigneeUserId: null }, 'diagnostic:unassigned'],
    [{ assigneeResourceMemberId: 'rm-saved', assigneeUserId: 'u-current' }, 'rm-saved'],
    [{ assigneeUserId: 'u-current' }, 'rm-current'],
    [{ assigneeResourceMemberId: null, assigneeUserId: 'u-current' }, 'rm-current'],
  ])('R2 snapshot identity %j owns accounting after real API assignee normalization', async (assignment, expected) => {
    renderTimeline(savedLifecycle(assignment), [{ ...liveTasks[0], assignee: { user_id: 'u-current', username: 'Current' } } as unknown as Task]);
    const cells = await screen.findAllByTestId('member-effort-cell');
    expect(cells.find(c => c.dataset.memberId === expected && c.dataset.date === '2026-09-08')).toHaveTextContent('A 8h');
    if (expected !== 'rm-current') expect(cells.find(c => c.dataset.memberId === 'rm-current' && c.dataset.date === '2026-09-08')).toHaveTextContent('A 0h');
  });
  it('R4 one Recalculate and explicit delete/activate operate on selected B', async () => {
    const lc = savedLifecycle(); renderTimeline(lc);
    expect(screen.getAllByRole('button', { name: 'Recalculate' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Recalculate' })); expect(lc.recalculate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('set-active-plan-btn')); expect(lc.setActivePlan).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('delete-plan-btn'));
    expect(screen.getByTestId('delete-plan-confirm')).toHaveTextContent('Displayed B');
    fireEvent.click(screen.getByTestId('confirm-delete-plan-btn')); expect(lc.deletePlan).toHaveBeenCalledTimes(1);
  });
  it('R5 live auto-sort preserves hidden slots and rendered CLOSE-last equals API order', async () => {
    const tasks = [
      { ...liveTasks[0], task_id: 'closed', title: 'Match closed', priority: 'CRITICAL', status: 'CLOSE', priority_order: 1 },
      { ...liveTasks[0], task_id: 'hidden', title: 'Hidden', priority: 'LOW', priority_order: 2 },
      { ...liveTasks[0], task_id: 'open', title: 'Match open', priority: 'MEDIUM', priority_order: 3 },
    ] as Task[];
    renderTimeline(lifecycle(), tasks);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Match' } });
    fireEvent.click(screen.getByTitle('Auto sort tasks by priority'));
    await waitFor(() => expect(mockReorderMutation).toHaveBeenCalled());
    expect(mockReorderMutation.mock.calls.at(-1)[0].taskOrders.map((t: any) => t.taskId)).toEqual(['open', 'hidden', 'closed']);
    expect(screen.getAllByTestId('gantt-name-row').map(r => r.textContent)).toEqual([expect.stringContaining('Match open'), expect.stringContaining('Match closed')]);
  });
  it.each(['live', 'saved'] as const)('Master uses the same single-row continuous layout in %s mode', async mode => {
    const progressCatalogItemId = '00000000-0000-0000-0000-000000000001';
    const task = { ...liveTasks[2], task_id: 'phase-task', id: 'phase-task', title: 'Phase task', effort: 16, start_date: '2026-09-11', progressCatalogItemId } as Task;
    const hoursPerDay = { '2026-09-11': 8, '2026-09-14': 8 };
    const overrideBars = { 'phase-task': { start: '2026-09-11', end: '2026-09-14', hoursPerDay } };
    const selected = mode === 'live' ? lifecycle({ overrideBars }) : lifecycle({
      mode: 'saved',
      loadedSnapshot: { version: 2, meta: { savedAt: '' }, tasks: [{
        taskId: 'phase-task', title: 'Phase task', startDate: '2026-09-11', endDate: '2026-09-14',
        hoursPerDay, priorityOrder: 1, progressCatalogItemId,
      }] },
      overrideBars,
    });

    renderTimeline(selected, [task]);
    fireEvent.click(screen.getByRole('button', { name: /master/i }));

    const rows = await screen.findAllByTestId('gantt-name-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Creation');
    expect(rows[0]).toHaveTextContent('2026-09-11');
    expect(rows[0]).toHaveTextContent('2026-09-14');
    expect(screen.getAllByText('Creation')).toHaveLength(1);
    expect(screen.getByTestId('master-phase-span')).toHaveStyle({ width: '312px' });
    expect(screen.queryByTestId('master-phase-day-segment')).not.toBeInTheDocument();
    expect(screen.queryByText('8h')).not.toBeInTheDocument();
  });

  it('old saved tasks without phase metadata produce one explicit unclassified row', async () => {
    renderTimeline(savedLifecycle());
    fireEvent.click(screen.getByRole('button', { name: /master/i }));
    const rows = await screen.findAllByTestId('gantt-name-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Unclassified / not recorded');
  });

  // Master task-tree assertion was superseded: Master is phase-only; WBS remains hierarchical.
  it.each(['wbs'])('R6 %s uses local authoritative hierarchy/order', async mode => {
    const tasks = [{ ...liveTasks[0], title: 'Parent' }, { ...liveTasks[1], title: 'Child', parent_task_id: 'parent' }];
    mockProjectionRows = tasks.slice().reverse().map(task => ({ kind: 'TASK', row_id: task.task_id, depth: 0, task: { ...task, priority_order: 1 } } as WbsRow));
    mockPhaseGroups = [{ phase_id: 'phase', name: 'Creation', task_ids: ['child', 'parent'], task_count: 2 }, { phase_id: 'empty', name: 'Empty Review', task_ids: [], task_count: 0 }] as PhaseRollupSummary[];
    renderTimeline(lifecycle(), tasks);
    const rows = screen.getAllByTestId('gantt-name-row');
    const parent = rows.find(r => r.textContent?.includes('Parent'))!; const child = rows.find(r => r.textContent?.includes('Child'))!;
    expect(Number(child.dataset.depth)).toBe(Number(parent.dataset.depth) + 1);
    expect(parent.compareDocumentPosition(child) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(parent.querySelector('button')!);
    expect(screen.queryByRole('button', { name: 'Child' })).not.toBeInTheDocument();
  });
  it('R7 saved columns use first/last positive keys rather than padded spans', async () => {
    renderTimeline(savedLifecycle());
    expect(await screen.findByTestId('gantt-row-start')).toHaveTextContent('2026-09-08');
    expect(screen.getByTestId('gantt-row-end')).toHaveTextContent('2026-09-08');
  });
  it('R7 4h/day live task remains visible on its third day, beyond default-8h clipping', async () => {
    mockSchedulingConfig.capacityFor = () => () => 4;
    localStorage.setItem('ganttChartDateRange', JSON.stringify({ startDate: '2026-09-09T00:00:00', endDate: '2026-09-09T00:00:00' }));
    renderTimeline(lifecycle(), [{ ...liveTasks[0], effort: 10, start_date: '2026-09-07' }]);
    expect(await screen.findByTestId('task-day-segment')).toHaveAttribute('data-hours', '2');
  });
  it('R8 grid/header/matrix synchronize both directions with equal date origins', async () => {
    renderTimeline(lifecycle());
    const grid = screen.getByTestId('gantt-scroll'); const header = screen.getByTestId('gantt-header-scroll'); const matrix = screen.getByTestId('matrix-scroll');
    fireEvent.scroll(grid, { target: { scrollLeft: 160 } }); expect(header.scrollLeft).toBe(160); expect(matrix.scrollLeft).toBe(160);
    fireEvent.scroll(matrix, { target: { scrollLeft: 80 } }); expect(grid.scrollLeft).toBe(80); expect(header.scrollLeft).toBe(80);
    expect(screen.getByTestId('gantt-name-column').className).toContain('w-96');
    expect(screen.getByTestId('member-name-column').className).toContain('w-96');
  });
  it.each(['live', 'saved'] as const)('R9 no live tasks retains %s lifecycle/history and canonical zero members', async mode => {
    renderTimeline(mode === 'saved' ? savedLifecycle({ assigneeResourceMemberId: 'rm-saved' }) : lifecycle(), []);
    expect(await screen.findByTestId('plan-select')).toBeInTheDocument(); expect(screen.getByText('Zero member')).toBeInTheDocument();
    if (mode === 'saved') expect(screen.getByText('Historical')).toBeInTheDocument();
  });
  it.each(['loading', 'error'])('R10 %s config is explicitly unavailable in draft inputs', async state => {
    mockSchedulingConfig.loading = state === 'loading';
    if (state === 'error') (mockSchedulingConfig as any).error = 'Query failed';
    renderTimeline(lifecycle());
    expect(mockUsePlanLifecycle.mock.calls.at(-1)[1].unavailableReason).toBeTruthy();
    expect(screen.queryAllByTestId('task-day-segment')).toHaveLength(0);
  });
  it('R11 unknown historical member cells never advertise ordinary zero/under-budget', async () => {
    renderTimeline(savedLifecycle({ assigneeUserId: 'u-current' }, true));
    const cells = await screen.findAllByTestId('member-effort-cell');
    const affected = cells.find(c => c.dataset.memberId === 'rm-current' && c.dataset.date === '2026-09-08')!;
    expect(affected).toHaveAttribute('data-load-status', 'unknown'); expect(affected).toHaveAttribute('aria-label', expect.stringContaining('unknown'));
    expect(cells.find(c => c.dataset.memberId === 'rm-zero' && c.dataset.date === '2026-09-08')).toHaveTextContent('A 0h');
  });
});

describe('canonical member User filter', () => {
  it('lists linked/unlinked/zero members, retains descendant ancestors, and clears without changing totals', () => {
    renderTimeline(lifecycle(), [
      liveTasks[0],
      { ...liveTasks[1], parent_task_id: 'parent', assignee_resource_member_id: 'rm-saved', assignee: undefined },
      { ...liveTasks[2], assignee_resource_member_id: null, assignee: { user_id: 'u-current', username: 'Old account label' } } as unknown as Task,
    ]);
    const totals = screen.getAllByTestId('member-effort-cell').map(cell => cell.textContent);
    fireEvent.click(screen.getByRole('button', { name: 'User', exact: true }));
    const picker = screen.getByRole('combobox', { name: 'Chọn người dùng để lọc task' });
    expect(Array.from(picker.querySelectorAll('option')).map(option => option.value)).toEqual(['', 'rm-current', 'rm-saved', 'rm-zero']);
    fireEvent.change(picker, { target: { value: 'rm-saved' } });
    expect(screen.getAllByTestId('gantt-name-row').map(row => row.dataset.depth)).toEqual(['0', '1']);
    expect(screen.queryByRole('button', { name: 'Live only', exact: true })).not.toBeInTheDocument();
    expect(Array.from(mockUsePlanLifecycle.mock.calls.at(-1)[1].selectedTaskIds)).toEqual(['child']);
    expect(screen.getAllByTestId('member-effort-cell').map(cell => cell.textContent)).toEqual(totals);
    fireEvent.change(picker, { target: { value: 'rm-current' } });
    expect(screen.getAllByTestId('gantt-name-row')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Live child', exact: true })).not.toBeInTheDocument();
    fireEvent.change(picker, { target: { value: 'rm-zero' } });
    expect(screen.queryAllByTestId('gantt-name-row')).toHaveLength(0);
    fireEvent.change(picker, { target: { value: '' } });
    expect(screen.getAllByTestId('gantt-name-row')).toHaveLength(3);
    expect(mockReorderMutation).not.toHaveBeenCalled();
  });

  it.each([
    [{ assigneeResourceMemberId: 'rm-saved', assigneeUserId: 'u-current' }, 'rm-saved'],
    [{ assigneeResourceMemberId: 'removed', assigneeUserId: 'u-current' }, null],
    [{ assigneeResourceMemberId: null }, null],
    [{}, null],
    [{ assigneeUserId: 'u-current' }, 'rm-current'],
  ])('uses saved assignment %j, never current-task/name inference', (assignment, matchingId) => {
    renderTimeline(savedLifecycle(assignment));
    fireEvent.click(screen.getByRole('button', { name: 'User', exact: true }));
    const picker = screen.getByRole('combobox', { name: 'Chọn người dùng để lọc task' });
    for (const id of ['rm-current', 'rm-saved']) {
      fireEvent.change(picker, { target: { value: id } });
      expect(screen.queryAllByTestId('gantt-name-row')).toHaveLength(id === matchingId ? 1 : 0);
    }
    fireEvent.change(picker, { target: { value: '' } });
    expect(screen.getAllByTestId('gantt-name-row')).toHaveLength(1);
  });
});

describe('Timeline selected-plan wiring', () => {
  it('uses saved membership, hierarchy, order, dates, and allocations instead of live fields', async () => {
    const snapshot: PlanSnapshot = {
      version: 2,
      meta: { savedAt: '2026-09-01T00:00:00Z' },
      tasks: [
        { taskId: 'parent', title: 'Saved parent', parentTaskId: null, startDate: '2026-09-07', endDate: '2026-09-07', hoursPerDay: { '2026-09-07': 8 }, assigneeResourceMemberId: 'rm-saved', priorityOrder: 1 },
        { taskId: 'child', title: 'Saved child', parentTaskId: 'parent', startDate: '2026-09-08', endDate: '2026-09-08', hoursPerDay: { '2026-09-08': 2 }, assigneeResourceMemberId: 'rm-saved', priorityOrder: 2 },
      ],
    };
    const bars = {
      parent: { start: '2026-09-07', end: '2026-09-07', hoursPerDay: { '2026-09-07': 8 } },
      child: { start: '2026-09-08', end: '2026-09-08', hoursPerDay: { '2026-09-08': 2 } },
    };
    renderTimeline(lifecycle({ mode: 'saved', loadedSnapshot: snapshot, overrideBars: bars }));

    const rows = await screen.findAllByTestId('gantt-name-row');
    expect(rows.map((row) => row.textContent)).toEqual(expect.arrayContaining([
      expect.stringContaining('Saved parent'), expect.stringContaining('Saved child'),
    ]));
    expect(screen.queryByText('Live only')).not.toBeInTheDocument();
    expect(rows.find((row) => row.textContent?.includes('Saved child'))).toHaveAttribute('data-depth', '1');
    expect((await screen.findAllByTestId('task-day-segment')).map((segment) => [segment.dataset.taskId, segment.dataset.date, segment.dataset.hours])).toEqual([
      ['parent', '2026-09-08', '2'], ['child', '2026-09-08', '2'],
    ]);
  });

  it('does not leak the current assignee when a saved resource assignment is explicitly null', async () => {
    const snapshot: PlanSnapshot = {
      version: 2,
      meta: { savedAt: '2026-09-01T00:00:00Z' },
      tasks: [{
        taskId: 'parent', title: 'Saved unassigned', parentTaskId: null,
        startDate: '2026-09-07', endDate: '2026-09-07', hoursPerDay: { '2026-09-07': 8 },
        assigneeResourceMemberId: null, priorityOrder: 1,
      }],
    };
    renderTimeline(lifecycle({
      mode: 'saved', loadedSnapshot: snapshot,
      overrideBars: { parent: { start: '2026-09-07', end: '2026-09-07', hoursPerDay: { '2026-09-07': 8 } } },
    }), [{ ...liveTasks[0], start_date: '2026-09-07', due_date: '2026-09-07' }]);

    await screen.findByTestId('member-daily-effort-matrix');
    const currentCell = screen.getAllByTestId('member-effort-cell').find(
      (cell) => cell.dataset.memberId === 'rm-current' && cell.dataset.date === '2026-09-07'
    );
    expect(currentCell).toHaveTextContent('A 0h');
    expect(screen.getByText(/Unresolved assignment \(unassigned\)/)).toBeInTheDocument();
  });

  it('exposes one plan selector/new/save lifecycle rather than parallel legacy controls', async () => {
    renderTimeline(lifecycle());
    await screen.findByTestId('plan-lifecycle-bar');
    expect([
      screen.queryByTitle('Select plan'),
      screen.queryByTestId('plan-select'),
    ].filter(Boolean)).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'New Plan' })).toHaveLength(1);
  });

  it('auto-sorts a draft locally without calling the live reorder API', async () => {
    const reorderDraft = jest.fn();
    const draftSnapshot: PlanSnapshot = {
      version: 2,
      meta: { savedAt: '2026-09-01T00:00:00Z', source: 'new-plan' as const },
      tasks: [
        { taskId: 'parent', title: 'Parent', startDate: '2026-09-07', endDate: '2026-09-07', hoursPerDay: { '2026-09-07': 8 }, priorityOrder: 1 },
        { taskId: 'child', title: 'Child', parentTaskId: 'parent', startDate: '2026-09-08', endDate: '2026-09-08', hoursPerDay: { '2026-09-08': 2 }, priorityOrder: 2 },
      ],
    };
    renderTimeline(lifecycle({
      mode: 'draft', draftSource: 'new-plan', reorderDraft,
      draft: { snapshot: draftSnapshot, allocations: {}, exhaustedTaskIds: [] },
    }));
    await screen.findByTestId('gantt-name-column');
    fireEvent.click(screen.getByTitle('Auto sort tasks by priority'));
    await waitFor(() => expect(reorderDraft).toHaveBeenCalled());
    expect(mockReorderMutation).not.toHaveBeenCalled();
  });
});
