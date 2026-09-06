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
import type { Task } from '@/types/task';

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'proj-1' }),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

jest.mock('../TaskBar', () => ({
  TaskBar: ({ task, onClick }: { task: { task_id: string }; onClick?: (id: string, e?: React.MouseEvent) => void }) => (
    <button
      type="button"
      data-testid={`task-bar-${task.task_id}`}
      onClick={(e) => onClick?.(task.task_id, e)}
    >
      {task.title}
    </button>
  ),
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

// Parent with two children; 10h effort on the parent exercises the 8h+2h
// per-day split (default weekday capacity 8h, weekend 0h).
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

function renderTimeline() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  act(() => {
    reduxStore.dispatch({ type: fetchProjectTasks.fulfilled.type, payload: tasks } as never);
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={reduxStore}>
        <MockedProvider mocks={[]} addTypename={false}>
          <Timeline />
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

    // Only the parent has an expand/collapse toggle.
    expect(rootRow!.querySelector('[data-testid="gantt-row-toggle"]')).not.toBeNull();
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
  it('effort 10h renders 8h + 2h day segments; zero-hour days are blank', async () => {
    renderTimeline();
    await screen.findByTestId('gantt-name-column');

    const segments = await screen.findAllByTestId('task-day-segment');
    const rootSegments = segments.filter((s) => s.dataset.taskId === 't-root');
    // 10h effort starting Monday 2026-09-07 → Mon 8h + Tue 2h
    const hours = rootSegments.map((s) => Number(s.dataset.hours));
    expect(hours).toContain(8);
    expect(hours).toContain(2);
    const total = hours.reduce((a, b) => a + b, 0);
    expect(total).toBe(10);

    // Segment labels show the per-day hours ("8h", "2h")
    expect(rootSegments.map((s) => s.textContent)).toEqual(expect.arrayContaining(['8h', '2h']));

    // Zero-hour days (weekend default 2026-09-12/13 Sat/Sun) get no segments
    const segmentDates = segments.map((s) => s.dataset.date);
    expect(segmentDates).not.toContain('2026-09-12');
    expect(segmentDates).not.toContain('2026-09-13');
  });
});
