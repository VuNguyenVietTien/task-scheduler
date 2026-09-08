import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/i18n/i18n-config';
import { Timeline } from '@/components/timeline/Timeline';
import { store } from '@/redux/store';
import { fetchProjectTasks } from '@/redux/features/tasksSlice';
import { updateAutoSort } from '@/redux/features/taskOrderStore';
import type { Task } from '@/types/task';

const mockReorder = jest.fn();
let mockRows: any[] = [];
let mockPhaseGroups: any[] = [];
const mockConfig = {
  loading: false, error: undefined, resourceMembers: [], memberGroups: {}, memberCapacity: {},
  defaultCapacity: { weekdayHours: 8, weekendHours: 0, dateOverrides: {} }, daysOff: [], commitments: [], groups: [],
  capacityFor: () => () => 8, configFor: () => ({ weekdayHours: 8, weekendHours: 0, dateOverrides: {} }),
  groupIdsFor: () => [], reservedFor: () => ({}), truncatedCommitmentRules: new Set<string>(),
  memberKeyFor: (id?: string | null) => id || 'unassigned',
};
const mockLifecycle = {
  mode: 'live', draft: null, draftSource: null, basePlanId: null, loadedPlan: null, savedBars: {},
  overrideBars: null, loadedSnapshot: null, plans: [], plansLoading: false, saving: false, error: null, defaultPlanFallback: false,
  exhaustedTaskIds: [], newPlan: jest.fn(), recalculate: jest.fn(), loadPlan: jest.fn(), savePlan: jest.fn(),
  reorderDraft: jest.fn(), backToLive: jest.fn(), deletePlan: jest.fn(), setActivePlan: jest.fn(),
};
jest.mock('@/hooks/usePlanLifecycle', () => ({ usePlanLifecycle: () => mockLifecycle }));
jest.mock('@/hooks/useProjectSchedulingConfig', () => ({ useProjectSchedulingConfig: () => mockConfig }));
jest.mock('@/hooks/useProjectTaxonomies', () => ({ useProjectTaxonomies: () => ({ phases: [] }) }));
jest.mock('@/hooks/useScheduleProjection', () => ({ useScheduleProjection: () => ({
  wbsRows: mockRows, masterRows: { phase_groups: mockPhaseGroups, unphased_group: { phase_id: null, name: 'Unphased', task_ids: [], task_count: 0 } }, loading: false,
}) }));
jest.mock('@/hooks/useTasks', () => ({ useReorderTasks: () => ({ mutateAsync: mockReorder }) }));
jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'proj-1' }) }));
jest.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('@/components/tasks/TaskDetail', () => ({ TaskDetail: () => null }));

function task(id: string, priorityOrder: number, parent?: string, priority = 'MEDIUM'): Task {
  return { task_id: id, id, project_id: 'proj-1', title: id, priority_order: priorityOrder,
    parent_task_id: parent, priority, status: 'TODO', start_date: '2026-09-07', effort: 2, created_by: 'owner' } as Task;
}
function mount(tasks: Task[]) {
  act(() => { store.dispatch(updateAutoSort(false)); store.dispatch({ type: fetchProjectTasks.fulfilled.type, payload: tasks }); });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><Provider store={store}><MockedProvider mocks={[]} addTypename={false}><Timeline /></MockedProvider></Provider></QueryClientProvider>);
}
function heading(id: string) {
  return { kind: 'SOURCE_HEADING', row_id: `heading:${id}`, heading: { source_heading_id: id, source_system: 'redmine', external_id: id, title: id, depth: 0 } };
}
beforeEach(() => {
  jest.clearAllMocks(); mockRows = []; mockPhaseGroups = [];
  mockConfig.resourceMembers = [];
  mockConfig.capacityFor = () => () => 8;
  localStorage.setItem('ganttChartDateRange', JSON.stringify({ startDate: '2026-09-07T00:00:00', endDate: '2026-09-09T00:00:00' }));
});

test('R6 keeps two source sections associated with their own full task subtrees', async () => {
  const tasks = [task('Section A root', 1), task('A child', 2, 'Section A root'), task('A grandchild', 3, 'A child'), task('Section B root', 4)];
  const entry = (t: Task) => ({ kind: 'TASK', row_id: t.task_id, depth: 0, task: t });
  mockRows = [heading('Heading A'), ...tasks.slice(0, 3).map(entry), heading('Heading B'), entry(tasks[3])];
  mount(tasks);
  await screen.findByRole('button', { name: 'A grandchild' });
  const rows = screen.getAllByTestId('gantt-name-row');
  const labels = rows.map(row => row.querySelector('button.truncate')?.textContent ?? row.querySelector('span.truncate')?.textContent);
  expect(labels).toEqual(['Heading A', 'Section A root', 'A child', 'A grandchild', 'Heading B', 'Section B root']);
});

// Master tree/collapse assertions were superseded by phase-only Master rows.
test.each(['wbs'])('multiple sections retain deep hierarchy and collapse in %s mode', async mode => {
  const tasks = [task('A root', 1), task('A child', 2, 'A root'), task('A grandchild', 3, 'A child'), task('A depth3', 4, 'A grandchild'), task('B root', 5)];
  const entry = (t: Task) => ({ kind: 'TASK', row_id: t.task_id, depth: 0, task: t });
  mockRows = [heading('Heading A'), ...tasks.slice(0, 4).reverse().map(entry), heading('Heading B'), entry(tasks[4])];
  mockPhaseGroups = [{ phase_id: 'creation', name: 'Creation', task_ids: ['B root', 'A child', 'A root'], task_count: 3 }, { phase_id: 'review', name: 'Empty Review', task_ids: [], task_count: 0 }];
  mount(tasks);
  if (mode === 'master') fireEvent.click(screen.getByRole('button', { name: /master/i }));
  const rows = screen.getAllByTestId('gantt-name-row');
  const taskRows = rows.filter(row => row.querySelector('button.truncate'));
  expect(taskRows.map(row => row.querySelector('button.truncate')?.textContent)).toEqual(['A root', 'A child', 'A grandchild', 'A depth3', 'B root']);
  expect(taskRows.map(row => Number(row.dataset.depth))).toEqual(mode === 'wbs' ? [0, 1, 2, 3, 0] : [1, 2, 3, 4, 1]);
  fireEvent.click(taskRows[0].querySelector('[data-testid="gantt-row-toggle"]')!);
  expect(screen.queryByRole('button', { name: 'A depth3' })).not.toBeInTheDocument();
  expect(screen.queryByTestId('task-bar-A depth3')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'B root' })).toBeInTheDocument();
  if (mode === 'wbs') {
    expect(screen.getAllByTestId('gantt-name-row').map(row => row.querySelector('button.truncate')?.textContent ?? row.querySelector('span.truncate')?.textContent)).toEqual(['Heading A', 'A root', 'Heading B', 'B root']);
  } else {
    expect(screen.getAllByText('Empty Review').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Unphased').length).toBeGreaterThan(0);
  }
  fireEvent.click(taskRows[0].querySelector('[data-testid="gantt-row-toggle"]')!);
  expect(screen.getByRole('button', { name: 'A depth3' })).toBeInTheDocument();
  expect(mockReorder).not.toHaveBeenCalled();
});

test('reorder sends the complete pre-edit expected order as well as the complete intended order', async () => {
  const tasks = [{ ...task('Match closed', 1, undefined, 'CRITICAL'), status: 'CLOSE' } as Task, task('Hidden', 2, undefined, 'LOW'), task('Match open', 3, undefined, 'MEDIUM')];
  mount(tasks);
  fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Match' } });
  fireEvent.click(screen.getByTitle('Auto sort tasks by priority'));
  await waitFor(() => expect(mockReorder).toHaveBeenCalledTimes(1));
  const input = mockReorder.mock.calls[0][0];
  expect(input.taskOrders.map((item: any) => item.taskId).sort()).toEqual(tasks.map(t => t.task_id).sort());
  expect(input.expectedOrder).toEqual(tasks.map(t => t.task_id));
});

test('live unlinked resource assignment survives the real Redux API normalizer and drives its 4h capacity', async () => {
  (mockConfig.resourceMembers as any[]) = [{ resource_member_id: 'placeholder', display_name: 'Unlinked member', user_id: null, member_kind: 'MEMBER' }];
  mockConfig.capacityFor = (key?: string) => () => key === 'placeholder' ? 4 : 8;
  const input = { ...task('Unlinked work', 1), effort: 10, assignee_resource_member_id: 'placeholder' };
  mount([input]);
  const cell = (await screen.findAllByTestId('member-effort-cell')).find(c => c.dataset.memberId === 'placeholder' && c.dataset.date === '2026-09-07')!;
  expect({ member: cell.textContent, bars: screen.getAllByTestId('task-day-segment').map(s => s.dataset.hours) }).toEqual({ member: 'A 4h · C 4h · R 0h · B 4h', bars: ['4', '4', '2'] });
});