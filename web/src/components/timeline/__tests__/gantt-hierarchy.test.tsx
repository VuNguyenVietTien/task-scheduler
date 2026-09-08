/**
 * Requirement 1 & 5 — Gantt right-side task-name column: parent/child
 * hierarchy with indent + expand/collapse; per-day hour segments on bars
 * (effort 10h → 8h + 2h).
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { Provider } from 'react-redux';
import { act } from 'react-dom/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import '@/i18n/i18n-config';
import { Timeline } from '../Timeline';
import { store as reduxStore } from '@/redux/store';
import { fetchProjectTasks } from '@/redux/features/tasksSlice';
import { CAPACITY_SETTINGS_QUERY, RESOURCE_GROUPS_QUERY, RECURRING_COMMITMENTS_QUERY, RESOURCE_MEMBERS_QUERY } from '@/graphql/scheduling';
const schedulingMocks = [
  [CAPACITY_SETTINGS_QUERY, { capacity_settings: [], day_offs: [] }],
  [RESOURCE_GROUPS_QUERY, { resource_groups: [] }],
  [RECURRING_COMMITMENTS_QUERY, { recurring_commitments: [] }],
  [RESOURCE_MEMBERS_QUERY, { resource_members: [] }],
].map(([query, data]) => ({ request: { query: query as import('graphql').DocumentNode, variables: { project_id: 'proj-1' } }, result: { data } }));
import type { Task } from '@/types/task';

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'proj-1' }),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

jest.mock('../TaskBar', () => ({
  TaskBar: () => <div data-testid="legacy-continuous-task-bar" />,
}));

jest.mock('../PriorityTaskList', () => ({
  PriorityTaskList: ({ title }: { title?: string }) => (
    <div data-testid="priority-task-list">{title}</div>
  ),
}));

jest.mock('../../tasks/TaskDetail', () => ({
  TaskDetail: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="task-detail-modal" role="dialog" /> : null,
}));

// Parent effort is stored but ignored: its two executable children own 6h.
// 2026-09-07 = Monday, 2026-09-08 = Tuesday.
const tasks: Task[] = [
  {
    task_id: 't-root',
    id: 't-root',
    project_id: 'proj-1',
    title: 'Root task',
    status: 'TODO',
    priority: 'MEDIUM',
    priority_order: 1,
    effort: 10,
    start_date: '2026-09-07',
    due_date: '2026-09-08',
    created_by: 'u0',
  } as Task,
  {
    task_id: 't-child-a',
    id: 't-child-a',
    project_id: 'proj-1',
    parent_task_id: 't-root',
    title: 'Child A',
    status: 'TODO',
    priority: 'MEDIUM',
    priority_order: 2,
    effort: 4,
    start_date: '2026-09-09',
    created_by: 'u0',
  } as Task,
  {
    task_id: 't-child-b',
    id: 't-child-b',
    project_id: 'proj-1',
    parent_task_id: 't-root',
    title: 'Child B',
    status: 'TODO',
    priority: 'LOW',
    priority_order: 3,
    effort: 2,
    start_date: '2026-09-10',
    created_by: 'u0',
  } as Task,
];

function renderTimeline(barsOverride?: Record<string, { start: string; end: string; hoursPerDay: Record<string, number> }>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  act(() => {
    reduxStore.dispatch({ type: fetchProjectTasks.fulfilled.type, payload: tasks } as never);
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={reduxStore}>
        <MockedProvider mocks={schedulingMocks} addTypename={false}>
          <Timeline barsOverride={barsOverride} />
        </MockedProvider>
      </Provider>
    </QueryClientProvider>
  );
};

describe('Gantt task-name column — hierarchy & collapse (requirement 1)', () => {
  it('renders parent/child rows with depth indentation and a toggle on the parent', async () => {
    renderTimeline();

    const nameColumn = await screen.findByTestId('gantt-name-column');
    expect(nameColumn).toBeInTheDocument();

    const rows = screen.getAllByTestId('gantt-name-row');
    const rootRow = rows.find((r) => r.textContent?.includes('Root task'));
    const childARow = rows.find((r) => r.textContent?.includes('Child A'));
    const childBRow = rows.find((r) => r.textContent?.includes('Child B'));

    expect(rootRow).toBeDefined();
    expect(childARow).toBeDefined();
    expect(childBRow).toBeDefined();

    // Children are indented deeper than the parent (requirement 1: indent).
    expect(Number(childARow!.dataset.depth)).toBeGreaterThan(Number(rootRow!.dataset.depth));
    expect(Number(childBRow!.dataset.depth)).toBe(1);

    // Only the parent has an expand/collapse toggle and its effort is derived.
    expect(rootRow!.querySelector('[data-testid="gantt-row-toggle"]')).not.toBeNull();
    expect(rootRow!.querySelector('[data-testid="gantt-summary-effort"]')).toHaveTextContent('6h');
    expect(childARow!.querySelector('[data-testid="gantt-row-toggle"]')).toBeNull();

    // Children render below the parent (row order preserved).
    expect(
      rootRow!.compareDocumentPosition(childARow!) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('collapse hides the subtree; expand restores it', async () => {
    renderTimeline();
    await screen.findByTestId('gantt-name-column');

    expect(screen.getAllByTestId('gantt-name-row').length).toBe(3);

    const rootToggle = screen.getAllByTestId('gantt-row-toggle')[0];
    fireEvent.click(rootToggle);

    let rows = screen.getAllByTestId('gantt-name-row');
    expect(rows.length).toBe(1); // only the parent remains
    expect(rows[0].textContent).toContain('Root task');

    // Bar grid also hides collapsed children: parent bar still present,
    // child bar segments gone.
    expect(screen.queryByText('Child A')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByTestId('gantt-row-toggle')[0]);
    rows = screen.getAllByTestId('gantt-name-row');
    expect(rows.length).toBe(3);
  });
});

describe('Per-day scheduled hours on task bars (requirement 5)', () => {
  it('summary renders combined child hours; parent effort and zero-hour days are ignored', async () => {
    renderTimeline();
    await screen.findByTestId('gantt-name-column');

    const segments = await screen.findAllByTestId('task-day-segment');
    const rootSegments = segments.filter((s) => s.dataset.taskId === 't-root');
    const hours = rootSegments.map((s) => Number(s.dataset.hours));
    expect(hours).toEqual([4, 2]);
    expect(hours.reduce((a, b) => a + b, 0)).toBe(6);
    expect(rootSegments.map((s) => s.textContent)).toEqual(['4h', '2h']);

    // Zero-hour days (weekend default 2026-09-12/13 Sat/Sun) get no segments
    const segmentDates = segments.map((s) => s.dataset.date);
    expect(segmentDates).not.toContain('2026-09-12');
    expect(segmentDates).not.toContain('2026-09-13');
  });

  it('renders saved/discontinuous hours only: a leave-like mid-task zero stays empty', async () => {
    renderTimeline({
      't-root': { start: '2026-09-08', end: '2026-09-08', hoursPerDay: { '2026-09-08': 99 } },
      't-child-a': { start: '2026-09-07', end: '2026-09-09', hoursPerDay: { '2026-09-07': 8, '2026-09-09': 2 } },
      't-child-b': { start: '2026-09-09', end: '2026-09-09', hoursPerDay: { '2026-09-09': 3 } },
    });
    await screen.findByTestId('gantt-name-column');

    const rootSegments = (await screen.findAllByTestId('task-day-segment'))
      .filter((segment) => segment.dataset.taskId === 't-root');
    expect(rootSegments.map((segment) => segment.dataset.date)).toEqual(['2026-09-07', '2026-09-09']);
    expect(rootSegments.map((segment) => segment.textContent)).toEqual(['8h', '5h']);
    expect(rootSegments.map((segment) => segment.dataset.date)).not.toContain('2026-09-08');
    expect(screen.queryByTestId('legacy-continuous-task-bar')).not.toBeInTheDocument();
  });

  it('keeps weekend gaps and does not fall back when an allocation is empty', async () => {
    renderTimeline({
      't-child-a': { start: '2026-09-11', end: '2026-09-14', hoursPerDay: { '2026-09-11': 8, '2026-09-14': 2 } },
      't-child-b': { start: '2026-09-09', end: '2026-09-09', hoursPerDay: {} },
    });
    await screen.findByTestId('gantt-name-column');

    const segments = await screen.findAllByTestId('task-day-segment');
    const rootDates = segments.filter((segment) => segment.dataset.taskId === 't-root').map((segment) => segment.dataset.date);
    expect(rootDates).toEqual(['2026-09-11']);
    expect(rootDates).not.toContain('2026-09-12');
    expect(rootDates).not.toContain('2026-09-13');
    expect(segments.filter((segment) => segment.dataset.taskId === 't-child-b')).toHaveLength(0);
    expect(screen.queryByTestId('legacy-continuous-task-bar')).not.toBeInTheDocument();
  });
});
