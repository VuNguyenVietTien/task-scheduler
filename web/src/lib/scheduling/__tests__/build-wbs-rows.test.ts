import {
  buildWbsRows,
  wbsRowsFromProjection,
  type ProjectionWbsRowInput,
} from '../build-wbs-rows';
import type { TaskScheduleItem } from '@/types/schedule-projection';
import type { WbsSourceHeading } from '@/types/taxonomy';

const task = (overrides: Partial<TaskScheduleItem> & { task_id: string }): TaskScheduleItem => ({
  parent_task_id: null,
  phase_id: null,
  title: overrides.task_id,
  status: 'TODO',
  priority_order: 0,
  ...overrides,
});

describe('wbsRowsFromProjection (GraphQL project_schedule_projection contract)', () => {
  // Mirrors the Task 1.3 handoff fixture (§5 of pm-graphql-impl-1.md).
  const projectionRows: ProjectionWbsRowInput[] = [
    { __typename: 'ScheduleSourceHeading', heading_id: 'h-1115', source_system: 'redmine', external_id: '1115', title: 'Detailed Design', depth: 0 },
    { __typename: 'ScheduleSourceHeading', heading_id: 'h-1116', source_system: 'redmine', external_id: '1116', title: 'Sub heading', depth: 1 },
    { __typename: 'ScheduleTaskEntry', task_id: 't-grandchild', title: 'Nested task', phase_id: '3c1d...05', start_date: null, end_date: null, effort_hours: '6.00', progress: null, depth: 2 },
    { __typename: 'ScheduleTaskEntry', task_id: 't-root', title: 'Root task', phase_id: '3c1d...01', start_date: '2026-09-01T00:00:00Z', end_date: '2026-09-08T00:00:00Z', effort_hours: '10.00', progress: 100, depth: 0 },
    { __typename: 'ScheduleTaskEntry', task_id: 't-child', title: 'Child task', phase_id: '3c1d...01', start_date: '2026-09-02T00:00:00Z', end_date: '2026-09-10T00:00:00Z', effort_hours: '20.00', progress: 50, depth: 1 },
  ];

  it('maps the union in exact server order preserving server depths (flat pre-order)', () => {
    const rows = wbsRowsFromProjection(projectionRows);

    expect(rows.map((r) => r.row_id)).toEqual([
      'heading:h-1115',
      'heading:h-1116',
      'task:t-grandchild',
      'task:t-root',
      'task:t-child',
    ]);
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 2, 0, 1]);
  });

  it('renders non-task source headings as rows with NO task identity or bar data', () => {
    const rows = wbsRowsFromProjection(projectionRows);
    const headingRows = rows.filter((r) => r.kind === 'SOURCE_HEADING');

    expect(headingRows).toHaveLength(2);
    const asAny = headingRows as unknown as Array<Record<string, unknown>>;
    for (const row of asAny) {
      expect(row.task_id).toBeUndefined();
      expect(row.task).toBeUndefined();
      expect(row.effort_hours).toBeUndefined();
      expect(row.progress).toBeUndefined();
      expect(row.start).toBeUndefined();
      expect(row.end).toBeUndefined();
      expect(row.onClick).toBeUndefined();
      expect(row.onBarMouseDown).toBeUndefined();
    }
    const first = headingRows[0];
    if (first.kind === 'SOURCE_HEADING') {
      expect(first.heading.source_heading_id).toBe('h-1115');
      expect(first.heading.title).toBe('Detailed Design');
      expect(first.heading.depth).toBe(0);
    }
  });

  it('parses task-entry effort display strings and passes current fields through', () => {
    const rows = wbsRowsFromProjection(projectionRows);
    const taskRows = rows.filter((r) => r.kind === 'TASK') as Array<
      Extract<(typeof rows)[number], { kind: 'TASK' }>
    >;

    const byId = new Map(taskRows.map((r) => [r.task.task_id, r.task]));
    expect(byId.get('t-root')?.effort_hours).toBe(10);
    expect(byId.get('t-child')?.effort_hours).toBe(20);
    expect(byId.get('t-grandchild')?.effort_hours).toBe(6);
    expect(byId.get('t-root')?.progress_percent).toBe(100);
    expect(byId.get('t-child')?.progress_percent).toBe(50);
    expect(byId.get('t-grandchild')?.progress_percent).toBeUndefined();
    expect(byId.get('t-root')?.start).toBe('2026-09-01T00:00:00Z');
    expect(byId.get('t-root')?.end).toBe('2026-09-08T00:00:00Z');
    expect(byId.get('t-grandchild')?.phase_id).toBe('3c1d...05');
  });

  it('renders exactly what the projection provides (never assumes wbs_rows count == totals.task_count)', () => {
    // Cycle members omitted by the backend (known limitation) must not be
    // fabricated client-side: 2 of 3 totals-counted tasks provided → 2 rows.
    const rows = wbsRowsFromProjection(projectionRows.slice(0, 4));
    expect(rows).toHaveLength(4);
    expect(rows.filter((r) => r.kind === 'TASK').map((r) => (r.kind === 'TASK' ? r.task.task_id : ''))).toEqual([
      't-grandchild',
      't-root',
    ]);
  });

  it('does not mutate the projection rows', () => {
    const snapshot = JSON.parse(JSON.stringify(projectionRows));
    wbsRowsFromProjection(projectionRows);
    expect(projectionRows).toEqual(snapshot);
  });
});

describe('buildWbsRows', () => {
  it('preserves arbitrary-depth real task hierarchy', () => {
    const tasks: TaskScheduleItem[] = [
      task({ task_id: 't1' }),
      task({ task_id: 't1-1', parent_task_id: 't1' }),
      task({ task_id: 't1-1-1', parent_task_id: 't1-1' }),
      task({ task_id: 't1-1-1-1', parent_task_id: 't1-1-1' }),
      task({ task_id: 't2' }),
    ];

    const rows = buildWbsRows(tasks);

    expect(rows.map((r) => (r.kind === 'TASK' ? r.task.task_id : r.heading.source_heading_id))).toEqual([
      't1',
      't1-1',
      't1-1-1',
      't1-1-1-1',
      't2',
    ]);
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 2, 3, 0]);
    rows.forEach((r) => expect(r.kind).toBe('TASK'));
  });

  it('includes non-task source headings with no task semantics', () => {
    const tasks: TaskScheduleItem[] = [task({ task_id: 't1' })];
    const headings: WbsSourceHeading[] = [
      { source_heading_id: 'h1', title: 'Tracker Phase 1', depth: 0 },
      { source_heading_id: 'h2', title: 'Tracker Phase 2', depth: 1 },
    ];

    const rows = buildWbsRows(tasks, headings);

    const headingRows = rows.filter((r) => r.kind === 'SOURCE_HEADING');
    expect(headingRows).toHaveLength(2);
    expect(headingRows.map((r) => (r.kind === 'SOURCE_HEADING' ? r.depth : -1))).toEqual([0, 1]);
    // Heading rows never expose task fields
    const asAny = headingRows as unknown as Array<Record<string, unknown>>;
    for (const row of asAny) {
      expect(row.task_id).toBeUndefined();
      expect(row.task).toBeUndefined();
      expect(row.effort_hours).toBeUndefined();
      expect(row.progress_percent).toBeUndefined();
      expect(row.assignments).toBeUndefined();
      expect(row.predecessor_ids).toBeUndefined();
      expect(row.onBarMouseDown).toBeUndefined();
    }
    // Real tasks still present exactly once
    const taskRows = rows.filter((r) => r.kind === 'TASK');
    expect(taskRows.map((r) => (r.kind === 'TASK' ? r.task.task_id : ''))).toEqual(['t1']);
  });

  it('treats tasks with missing parents as roots instead of dropping them', () => {
    const tasks: TaskScheduleItem[] = [
      task({ task_id: 'orphan', parent_task_id: 'missing-parent' }),
      task({ task_id: 'root' }),
    ];

    const rows = buildWbsRows(tasks);

    expect(rows.map((r) => r.depth)).toEqual([0, 0]);
  });

  it('is safe against cyclic parent references', () => {
    const tasks: TaskScheduleItem[] = [
      task({ task_id: 'a', parent_task_id: 'b' }),
      task({ task_id: 'b', parent_task_id: 'a' }),
    ];

    const rows = buildWbsRows(tasks);

    expect(rows).toHaveLength(2);
    rows.forEach((r) => expect(r.depth).toBe(0));
  });

  it('does not mutate input tasks or headings', () => {
    const tasks: TaskScheduleItem[] = [
      task({ task_id: 't1' }),
      task({ task_id: 't1-1', parent_task_id: 't1' }),
    ];
    const headings: WbsSourceHeading[] = [{ source_heading_id: 'h1', title: 'H', depth: 0 }];
    const tasksSnapshot = JSON.parse(JSON.stringify(tasks));
    const headingsSnapshot = JSON.parse(JSON.stringify(headings));

    buildWbsRows(tasks, headings);

    expect(tasks).toEqual(tasksSnapshot);
    expect(headings).toEqual(headingsSnapshot);
  });
});
