import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/i18n/i18n-config';
import { Timeline } from '@/components/timeline/Timeline';
import { store } from '@/redux/store';
import { fetchProjectTasks, resetTasks } from '@/redux/features/tasksSlice';
import { updateAutoSort } from '@/redux/features/taskOrderStore';
import { wbsRowsFromProjection, type ProjectionWbsRowInput } from '@/lib/scheduling/build-wbs-rows';
import { masterRowsFromProjection } from '@/lib/scheduling/build-master-rows';

let mockRows: any[] = [];
let mockMasterRows: ReturnType<typeof masterRowsFromProjection> | undefined;
const mockReorder = jest.fn();
jest.mock('@/hooks/usePlanLifecycle', () => ({ usePlanLifecycle: () => ({
  mode: 'live', draft: null, draftSource: null, basePlanId: null, loadedPlan: null, savedBars: {},
  overrideBars: null, loadedSnapshot: null, plans: [], plansLoading: false, saving: false, error: null,
  exhaustedTaskIds: [], newPlan: jest.fn(), recalculate: jest.fn(), loadPlan: jest.fn(), savePlan: jest.fn(),
  reorderDraft: jest.fn(), backToLive: jest.fn(), deletePlan: jest.fn(), setActivePlan: jest.fn(),
}) }));
jest.mock('@/hooks/useProjectSchedulingConfig', () => ({ useProjectSchedulingConfig: () => ({
  loading: false, error: undefined, resourceMembers: [], memberGroups: {}, memberCapacity: {},
  defaultCapacity: { weekdayHours: 8, weekendHours: 0, dateOverrides: {} }, daysOff: [], commitments: [], groups: [],
  capacityFor: () => () => 8, configFor: () => ({ weekdayHours: 8, weekendHours: 0, dateOverrides: {} }),
  groupIdsFor: () => [], reservedFor: () => ({}), truncatedCommitmentRules: new Set(), memberKeyFor: () => 'unassigned',
}) }));
jest.mock('@/hooks/useProjectTaxonomies', () => ({ useProjectTaxonomies: () => ({ phases: [] }) }));
jest.mock('@/hooks/useScheduleProjection', () => ({ useScheduleProjection: () => ({
  wbsRows: mockRows, masterRows: mockMasterRows ?? { phase_groups: [], unphased_group: { phase_id: null, name: 'Unphased', task_ids: [], task_count: 0 } }, loading: false,
}) }));
jest.mock('@/hooks/useTasks', () => ({ useReorderTasks: () => ({ mutateAsync: mockReorder }) }));
jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'proj-1' }) }));
jest.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('@/components/tasks/TaskDetail', () => ({ TaskDetail: () => null }));

const task = (id: string, rank: number, parent?: string) => ({ task_id: id, project_id: 'proj-1',
  title: id, priority_order: rank, parent_task_id: parent, status: 'TODO', priority: 'MEDIUM',
  start_date: '2026-09-07', effort: 2, created_by: 'owner' });
const labels = () => screen.getAllByTestId('gantt-name-row').map(row =>
  row.querySelector('button.truncate')?.textContent ?? row.querySelector('span.truncate')?.textContent);

test('collapsing a task subtree preserves the following sibling source heading', () => {
  const tasks = [task('A root', 1), task('A child', 2, 'A root'), task('B root', 3)];
  const heading = (id: string, depth: number): any => ({ __typename: 'ScheduleSourceHeading',
    heading_id: id, source_system: 'redmine', external_id: id, title: id, depth });
  const entry = (t: any, depth: number): any => ({ __typename: 'ScheduleTaskEntry',
    task_id: t.task_id, title: t.title, effort_hours: '2.00', depth });
  // Actual backend projection supports sibling subheadings (depth 1), with
  // tasks at depth 2+; the task hierarchy remains authoritative in Redux.
  mockRows = wbsRowsFromProjection([heading('Project heading', 0), heading('Section A', 1),
    entry(tasks[0], 2), entry(tasks[1], 3), heading('Section B', 1), entry(tasks[2], 2)]);
  act(() => {
    store.dispatch(resetTasks()); store.dispatch(updateAutoSort(false));
    store.dispatch({ type: fetchProjectTasks.fulfilled.type, payload: tasks });
  });
  localStorage.setItem('ganttChartDateRange', JSON.stringify({ startDate: '2026-09-07T00:00:00', endDate: '2026-09-09T00:00:00' }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><Provider store={store}><MockedProvider mocks={[]}><Timeline /></MockedProvider></Provider></QueryClientProvider>);
  expect(labels()).toEqual(['Project heading', 'Section A', 'A root', 'A child', 'Section B', 'B root']);
  const root = screen.getByRole('button', { name: 'A root' }).closest('[data-testid="gantt-name-row"]')!;
  fireEvent.click(root.querySelector('[data-testid="gantt-row-toggle"]')!);
  expect(screen.queryByRole('button', { name: 'A child' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'B root' })).toBeInTheDocument();
  expect(labels()).toEqual(['Project heading', 'Section A', 'A root', 'Section B', 'B root']);
  expect(mockReorder).not.toHaveBeenCalled();
});

// Both modes use the real projection adapters and Redux normalizer, not
// hand-built presentation rows. Source depth and task depth are independent.
test.each(['wbs', 'master'])('mixed ancestry collapse/expand boundaries in %s', mode => {
  jest.clearAllMocks();
  const tasks = [task('A root', 1), task('A child', 2, 'A root'),
    task('A grandchild', 3, 'A child'), task('A depth3', 4, 'A grandchild'),
    task('B root', 5), task('B child', 6, 'B root'), task('C root', 7)];
  const heading = (title: string, depth: number): ProjectionWbsRowInput => ({
    __typename: 'ScheduleSourceHeading', heading_id: title, source_system: 'redmine', external_id: title, title, depth,
  });
  const entry = (index: number, depth: number, phase_id: string | null): ProjectionWbsRowInput => ({
    __typename: 'ScheduleTaskEntry', task_id: tasks[index].task_id, title: tasks[index].title,
    effort_hours: '2.00', depth, phase_id, start_date: null, end_date: null, progress: null,
  });
  const projection = [heading('Project heading', 0), heading('Section A', 1), heading('Nested A', 2),
    entry(0, 3, 'a'), entry(1, 4, 'a'), entry(2, 5, 'a'), entry(3, 6, 'a'),
    heading('Section B', 1), entry(4, 2, 'b'), entry(5, 3, 'b'),
    heading('Other project', 0), entry(6, 1, null)];
  mockRows = wbsRowsFromProjection(projection);
  mockMasterRows = masterRowsFromProjection(projection, [
    { phase_id: 'a', name: 'Phase A', display_order: 1 },
    { phase_id: 'b', name: 'Phase B', display_order: 2 },
    { phase_id: 'empty', name: 'Empty Review', display_order: 3 },
  ]);
  act(() => {
    store.dispatch(resetTasks()); store.dispatch(updateAutoSort(false));
    store.dispatch({ type: fetchProjectTasks.fulfilled.type, payload: tasks });
  });
  localStorage.setItem('ganttChartDateRange', JSON.stringify({ startDate: '2026-09-07T00:00:00', endDate: '2026-09-09T00:00:00' }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><Provider store={store}><MockedProvider mocks={[]}><Timeline /></MockedProvider></Provider></QueryClientProvider>);
  if (mode === 'master') fireEvent.click(screen.getByRole('button', { name: /master/i }));
  const all = mode === 'wbs'
    ? ['Project heading', 'Section A', 'Nested A', 'A root', 'A child', 'A grandchild', 'A depth3', 'Section B', 'B root', 'B child', 'Other project', 'C root']
    : ['Phase A', 'A root', 'A child', 'A grandchild', 'A depth3', 'Phase B', 'B root', 'B child', 'Empty Review', 'Unphased', 'C root'];
  const assertRows = (expected: string[]) => {
    expect(labels()).toEqual(expected);
    screen.getAllByTestId('gantt-name-row').forEach((row, index) => {
      const label = expected[index];
      const taskButton = row.querySelector('button.truncate');
      const phaseIds: Record<string, string> = { 'Phase A': 'a', 'Phase B': 'b', 'Empty Review': 'empty', Unphased: 'unphased' };
      const key = mode === 'wbs' ? `heading:${label}` : `phase:${phaseIds[label]}`;
      const timelineRow = taskButton ? screen.getByTestId(`task-bar-${label}`)
        : screen.getByTestId('gantt-scroll').querySelector(`[data-row-id="${key}"]`);
      // Task bars and heading/phase wrappers must occupy the same row slot.
      const rendered = taskButton ? timelineRow : timelineRow?.parentElement;
      expect(rendered).not.toBeNull();
      expect((rendered as HTMLElement).style.top).toBe(`${index * 48}px`);
      expect(row.style.top).toBe(`${index * 48}px`);
    });
  };
  const toggleTask = (name: string) => fireEvent.click(screen.getByRole('button', { name }).closest('[data-testid="gantt-name-row"]')!.querySelector('[data-testid="gantt-row-toggle"]')!);
  assertRows(all);
  expect(screen.getAllByTestId('gantt-name-row').filter(row => row.querySelector('button.truncate')).map(row => Number(row.dataset.depth)))
    .toEqual(mode === 'wbs' ? [0, 1, 2, 3, 0, 1, 0] : [1, 2, 3, 4, 1, 2, 1]);
  toggleTask('A root');
  const withoutDescendants = all.filter(label => !['A child', 'A grandchild', 'A depth3'].includes(label));
  assertRows(withoutDescendants);
  for (const name of ['A child', 'A grandchild', 'A depth3']) expect(screen.queryByTestId(`task-bar-${name}`)).not.toBeInTheDocument();
  const section = mode === 'wbs' ? 'Section A' : 'Phase A';
  fireEvent.click(screen.getByRole('button', { name: `Collapse ${section}` }));
  assertRows(all.filter(label => !['Nested A', 'A root', 'A child', 'A grandchild', 'A depth3'].includes(label)));
  expect(screen.queryByTestId('task-bar-A root')).not.toBeInTheDocument();
  if (mode === 'wbs') expect(screen.queryByRole('heading', { name: 'Nested A' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: `Expand ${section}` }));
  assertRows(withoutDescendants); // the task's own collapsed state survives
  toggleTask('A root');
  assertRows(all);
  if (mode === 'wbs') {
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Nested A' }));
    assertRows(all.filter(label => !['A root', 'A child', 'A grandchild', 'A depth3'].includes(label)));
    fireEvent.click(screen.getByRole('button', { name: 'Expand Nested A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Project heading' }));
    assertRows(['Project heading', 'Other project', 'C root']);
    fireEvent.click(screen.getByRole('button', { name: 'Expand Project heading' }));
    assertRows(all);
  } else {
    const empty = screen.getAllByTestId('gantt-name-row').find(row => row.textContent?.includes('Empty Review'))!;
    expect(empty.querySelector('[data-testid="gantt-row-toggle"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Unphased' }));
    assertRows(all.filter(label => label !== 'C root'));
    fireEvent.click(screen.getByRole('button', { name: 'Expand Unphased' }));
    assertRows(all);
  }
  expect(mockReorder).not.toHaveBeenCalled();
  view.unmount(); client.clear(); mockMasterRows = undefined;
});
