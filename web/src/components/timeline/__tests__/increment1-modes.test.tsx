/**
 * Increment 1 — Task 1.4 shaping tests.
 *
 * Covers: mode switch performs no mutation, both schedule modes render from
 * projectScheduleProjection (WBS rows incl. non-task headings; Master rows in
 * exact phase order + Unphased last), heading/phase rows are never draggable
 * and never reach task callbacks, existing Timeline controls and the task
 * modal are preserved, en/vi/ja scheduling label keys exist, and the phase
 * selector/filter components behave per contract.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { Provider } from 'react-redux';
import { act } from 'react-dom/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// i18n must be initialized before any t()-using component renders.
import '@/i18n/i18n-config';

import { Timeline } from '../Timeline';
import { ScheduleModeControl } from '../ScheduleModeControl';
import {
  GET_PROJECT_SCHEDULE_PROJECTION,
  type GqlProjectScheduleProjection,
} from '@/graphql/queries/scheduleProjection';
import { GET_PROJECT_PHASES } from '@/graphql/queries/taxonomies';
import { CAPACITY_SETTINGS_QUERY, RESOURCE_GROUPS_QUERY, RECURRING_COMMITMENTS_QUERY, RESOURCE_MEMBERS_QUERY } from '@/graphql/scheduling';
import { TaskPhaseSelect, PhaseFilterSelect, applyPhaseFilter } from '@/components/projects/phase-controls';
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
      data-draggable="false-role-bar"
      onClick={(e) => onClick?.(task.task_id, e)}
    >
      {task.title}
    </button>
  ),
}));

jest.mock('../PriorityTaskList', () => ({
  PriorityTaskList: ({ title }: { title: string }) => (
    <div data-testid="priority-task-list">{title}</div>
  ),
}));

jest.mock('../../tasks/TaskDetail', () => ({
  TaskDetail: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="task-detail-modal" role="dialog" /> : null,
}));

import { store as reduxStore } from '@/redux/store';
import { fetchProjectTasks } from '@/redux/features/tasksSlice';

const apiTasks = [
  {
    task_id: 't-root',
    project_id: 'proj-1',
    title: 'Root task',
    status: 'TODO',
    priority: 'MEDIUM',
    priority_order: 1,
    effort: 10,
    progress: 100,
    start_date: '2026-09-01',
    due_date: '2026-09-08',
  },
  {
    task_id: 't-child',
    project_id: 'proj-1',
    parent_task_id: 't-root',
    title: 'Child task',
    status: 'TODO',
    priority: 'MEDIUM',
    priority_order: 2,
    effort: 20,
    progress: 50,
    start_date: '2026-09-02',
    due_date: '2026-09-10',
  },
];

const phasesMock = [
  {
    project_phases: [
      {
        phase_id: 'p1',
        project_id: 'proj-1',
        phase_key: 'creation',
        display_order: 1,
        is_active: true,
        translations: [{ locale: 'en', name: 'Creation' }, { locale: 'vi', name: 'Khởi tạo' }, { locale: 'ja', name: '作成' }],
      },
      {
        phase_id: 'p2',
        project_id: 'proj-1',
        phase_key: 'review',
        display_order: 2,
        is_active: true,
        translations: [{ locale: 'en', name: 'Review' }, { locale: 'vi', name: 'Xem xét' }, { locale: 'ja', name: 'レビュー' }],
      },
    ],
  },
];

const projectionResult: { project_schedule_projection: GqlProjectScheduleProjection } = {
  project_schedule_projection: {
    project_id: 'proj-1',
    source: 'CURRENT_TASK_FIELDS',
    phase_groups: [
      { phase_id: 'p1', phase_key: 'creation', is_unphased: false, task_ids: ['t-root', 't-child'], totals: { task_count: 2, effort_hours: '30.00', progress: 66.67, start_date: '2026-09-01T00:00:00Z', end_date: '2026-09-10T00:00:00Z' } },
      { phase_id: 'p2', phase_key: 'review', is_unphased: false, task_ids: [], totals: { task_count: 0, effort_hours: '0.00', progress: null, start_date: null, end_date: null } },
      { phase_id: null, phase_key: 'unphased', is_unphased: true, task_ids: [], totals: { task_count: 0, effort_hours: '0.00', progress: null, start_date: null, end_date: null } },
    ],
    wbs_rows: [
      { __typename: 'ScheduleSourceHeading', heading_id: 'h-1115', source_system: 'redmine', external_id: '1115', title: 'Detailed Design', depth: 0 },
      { __typename: 'ScheduleTaskEntry', task_id: 't-root', title: 'Root task', phase_id: 'p1', start_date: '2026-09-01T00:00:00Z', end_date: '2026-09-08T00:00:00Z', effort_hours: '10.00', progress: 100, depth: 0 },
      { __typename: 'ScheduleTaskEntry', task_id: 't-child', title: 'Child task', phase_id: 'p1', start_date: '2026-09-02T00:00:00Z', end_date: '2026-09-10T00:00:00Z', effort_hours: '20.00', progress: 50, depth: 1 },
    ],
    totals: { task_count: 2, effort_hours: '30.00', progress: 66.67, start_date: '2026-09-01T00:00:00Z', end_date: '2026-09-10T00:00:00Z' },
  },
};

const apolloMocks = [
  ...[
    [CAPACITY_SETTINGS_QUERY, { capacity_settings: [], day_offs: [] }],
    [RESOURCE_GROUPS_QUERY, { resource_groups: [] }],
    [RECURRING_COMMITMENTS_QUERY, { recurring_commitments: [] }],
    [RESOURCE_MEMBERS_QUERY, { resource_members: [] }],
  ].map(([query, data]) => ({ request: { query: query as import('graphql').DocumentNode, variables: { project_id: 'proj-1' } }, result: { data } })),
  { request: { query: GET_PROJECT_PHASES, variables: { projectId: 'proj-1', includeArchived: false } }, result: { data: phasesMock[0] } },
  { request: { query: GET_PROJECT_SCHEDULE_PROJECTION, variables: { projectId: 'proj-1' } }, result: { data: projectionResult } },
  // NOTE: no mutation mocks on purpose — any mutation fired by mode switching
  // would surface as an Apollo "No more mocked responses" error and fail below.
];

function renderTimeline() {
  const store = reduxStore;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  act(() => {
    store.dispatch({ type: fetchProjectTasks.fulfilled.type, payload: apiTasks } as never);
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MockedProvider mocks={apolloMocks} addTypename={false}>
          <Timeline />
        </MockedProvider>
      </Provider>
    </QueryClientProvider>
  );
}

describe('Increment 1 — Timeline schedule modes', () => {
  it('preserves existing plan controls, filters, date inputs and left task list', async () => {
    renderTimeline();

    await waitFor(() => {
      expect(screen.getByTestId('task-bar-t-root')).toBeInTheDocument();
    });

    // Plan controls preserved
    expect(screen.getByTestId('plan-select')).toBeInTheDocument();
    expect(screen.getByTestId('new-plan-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('save-plan-btn')).not.toBeInTheDocument(); // Save requires an explicit draft.
    expect(screen.getByTitle('Auto sort tasks by priority')).toBeInTheDocument();

    // Date range + filters preserved
    expect(screen.getByLabelText('Start date')).toBeInTheDocument();
    expect(screen.getByLabelText('End date')).toBeInTheDocument();
    expect(screen.getByTestId('gantt-name-column')).toBeInTheDocument();
    expect(screen.queryByTestId('priority-task-list')).not.toBeInTheDocument();

    // Mode control present
    expect(screen.getByTestId('schedule-mode-control')).toBeInTheDocument();
  });

  it('WBS_DETAIL (default) renders source headings as non-draggable rows with no task identity', async () => {
    renderTimeline();

    await waitFor(() => {
      expect(screen.getByTestId('task-bar-t-root')).toBeInTheDocument();
    });

    // The heading title now also appears in the gantt task-name column
    // (requirement 1); assert at least one instance is the WBS heading row.
    const headingRows = await screen.findAllByText('Detailed Design');
    const headingRow = headingRows.find(
      (el) => el.closest('[data-source-heading="true"]') !== null
    );
    expect(headingRow).toBeDefined();
    const row = headingRow!.closest('[data-source-heading="true"]') as HTMLElement;
    expect(row).toHaveAttribute('data-nondraggable', 'true');
    expect(row.getAttribute('draggable')).not.toBe('true');
    // No task semantics leak into the heading row
    expect(row.querySelector('[data-task-id]')).toBeNull();
  });

  it('MASTER_SCHEDULE renders phase groups in exact display order with Unphased ALWAYS last, all non-draggable', async () => {
    renderTimeline();

    await waitFor(() => {
      expect(screen.getByTestId('task-bar-t-root')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /master/i }));

    // Phase titles also appear in the task-name column (requirement 1);
    // pick the instances that are the phase summary rows.
    const creation = (await screen.findAllByText('Creation')).find(
      (el) => el.closest('[data-phase-summary="true"]') !== null
    )!;
    const review = (await screen.findAllByText('Review')).find(
      (el) => el.closest('[data-phase-summary="true"]') !== null
    )!;
    const unphased = await screen.getAllByText(/unphased/i).at(-1)!;

    const rows = [creation, review, unphased].map(
      (el) => el.closest('[data-phase-summary="true"]') as HTMLElement
    );
    for (const row of rows) {
      expect(row).not.toBeNull();
      expect(row).toHaveAttribute('data-nondraggable', 'true');
      expect(row.getAttribute('draggable')).not.toBe('true');
    }
    // DOM order: configured phases first, Unphased last
    expect(rows[0].compareDocumentPosition(rows[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rows[1].compareDocumentPosition(rows[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Rollups rendered from current fields
    expect(screen.getAllByText('30h').length).toBeGreaterThan(0);
    expect(screen.getAllByText('67%').length).toBeGreaterThan(0);
  });

  it('switching modes performs no mutation (queries only; no GraphQL write errors)', async () => {
    renderTimeline();

    await waitFor(() => {
      expect(screen.getByTestId('task-bar-t-root')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /master/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Creation').length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByRole('button', { name: /wbs/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Detailed Design').length).toBeGreaterThan(0);
    });

    // Still healthy — no crash, no error UI, task bars intact
    expect(screen.getByTestId('task-bar-t-root')).toBeInTheDocument();
    expect(screen.getByTestId('task-bar-t-child')).toBeInTheDocument();
  });

  it('opens the existing task modal when a task bar is clicked in a schedule mode', async () => {
    renderTimeline();

    await waitFor(() => {
      expect(screen.getByTestId('task-bar-t-root')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('task-bar-t-root'));
    await waitFor(() => {
      expect(screen.getByTestId('task-detail-modal')).toBeInTheDocument();
    });
  });
});

describe('ScheduleModeControl — presentation only', () => {
  it('reports the new mode and performs no writes itself', () => {
    const onModeChange = jest.fn();
    render(<ScheduleModeControl mode="WBS_DETAIL" onModeChange={onModeChange} />);

    fireEvent.click(screen.getByRole('button', { name: /master/i }));
    expect(onModeChange).toHaveBeenCalledTimes(1);
    expect(onModeChange).toHaveBeenCalledWith('MASTER_SCHEDULE');
    expect(onModeChange).not.toHaveBeenCalledWith('WBS_DETAIL');
  });
});

describe('Phase selector and filter', () => {
  const uiPhases = [
    { phase_id: 'p1', project_id: 'proj-1', phase_key: 'creation', display_order: 1, is_active: true, name: 'Creation', translations: [{ locale: 'en', name: 'Creation' }] },
    { phase_id: 'p2', project_id: 'proj-1', phase_key: 'review', display_order: 2, is_active: true, name: 'Review', translations: [{ locale: 'en', name: 'Review' }] },
  ];

  it('TaskPhaseSelect shows current phase and reports selection incl. Unphased (null)', () => {
    const onSetPhase = jest.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <TaskPhaseSelect taskId="t-1" value="p1" phases={uiPhases} onSetPhase={onSetPhase} />
    );

    const select = screen.getByTestId('task-phase-select') as HTMLSelectElement;
    expect(select.value).toBe('p1');

    fireEvent.change(select, { target: { value: 'p2' } });
    expect(onSetPhase).toHaveBeenCalledWith('t-1', 'p2');

    rerender(<TaskPhaseSelect taskId="t-1" value={null} phases={uiPhases} onSetPhase={onSetPhase} />);
    fireEvent.change(screen.getByTestId('task-phase-select'), { target: { value: '' } });
    expect(onSetPhase).toHaveBeenLastCalledWith('t-1', null);
  });

  it('PhaseFilterSelect reports ALL / specific phase / UNPHASED filter values', () => {
    const onChange = jest.fn();
    render(<PhaseFilterSelect phases={uiPhases} value="ALL" onChange={onChange} />);

    const select = screen.getByTestId('phase-filter-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'p1' } });
    expect(onChange).toHaveBeenCalledWith('p1');

    fireEvent.change(select, { target: { value: 'UNPHASED' } });
    expect(onChange).toHaveBeenCalledWith('UNPHASED');

    fireEvent.change(select, { target: { value: 'ALL' } });
    expect(onChange).toHaveBeenCalledWith('ALL');
  });

  it('applyPhaseFilter filters by phase id, unphased, or all', () => {
    const tasks = [
      { task_id: 'a', phase_id: 'p1' },
      { task_id: 'b', phase_id: 'p2' },
      { task_id: 'c', phase_id: null },
    ] as unknown as Task[];

    expect(applyPhaseFilter(tasks, 'ALL')).toHaveLength(3);
    expect(applyPhaseFilter(tasks, 'p1').map((t) => t.task_id)).toEqual(['a']);
    expect(applyPhaseFilter(tasks, 'UNPHASED').map((t) => t.task_id)).toEqual(['c']);
  });
});

describe('Scheduling i18n labels — en/vi/ja all present', () => {
  const REQUIRED_KEYS = [
    'modeWbs',
    'modeMaster',
    'modeLabel',
    'unphased',
    'taskPhase',
    'filterAllPhases',
    'filterUnphased',
    'phaseSettings',
  ];

  it.each(['en', 'vi', 'ja'])('%s scheduling section contains all required keys', (locale) => {
    // Runtime require needs a relative path (moduleNameMapper covers only
    // components/lib/hooks/types prefixes; static imports get babel-rewritten).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const resources = require(`../../../i18n/locales/${locale}.json`);
    const scheduling = resources.scheduling;
    expect(scheduling).toBeDefined();
    for (const key of REQUIRED_KEYS) {
      expect(typeof scheduling[key]).toBe('string');
      expect(scheduling[key].length).toBeGreaterThan(0);
    }
  });
});
