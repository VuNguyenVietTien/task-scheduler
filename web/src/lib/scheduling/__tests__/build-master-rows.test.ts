import {
  buildMasterPhaseRows,
  buildMasterRows,
  masterRowsFromProjection,
  type ProjectionWbsRowInput,
} from '../build-master-rows';
import type { TaskScheduleItem } from '@/types/schedule-projection';
import type { PhaseDescriptor } from '@/types/taxonomy';

const phases: PhaseDescriptor[] = [
  { phase_id: 'p2', name: 'Phase 2', display_order: 2 },
  { phase_id: 'p1', name: 'Phase 1', display_order: 1 },
];

const task = (overrides: Partial<TaskScheduleItem> & { task_id: string }): TaskScheduleItem => ({
  parent_task_id: null,
  phase_id: null,
  title: overrides.task_id,
  status: 'TODO',
  priority_order: 0,
  ...overrides,
});

describe('masterRowsFromProjection (GraphQL project_schedule_projection contract)', () => {
  const projectionRows: ProjectionWbsRowInput[] = [
    { __typename: 'ScheduleSourceHeading', heading_id: 'h-1115', source_system: 'redmine', external_id: '1115', title: 'Detailed Design', depth: 0 },
    { __typename: 'ScheduleTaskEntry', task_id: 't-root', title: 'Root task', phase_id: 'p1', start_date: '2026-09-01T00:00:00Z', end_date: '2026-09-08T00:00:00Z', effort_hours: '10.00', progress: 100, depth: 0 },
    { __typename: 'ScheduleTaskEntry', task_id: 't-child', title: 'Child task', phase_id: 'p1', start_date: '2026-09-02T00:00:00Z', end_date: '2026-09-10T00:00:00Z', effort_hours: '20.00', progress: 50, depth: 1 },
    { __typename: 'ScheduleTaskEntry', task_id: 't-other', title: 'Other phase task', phase_id: 'p2', start_date: null, end_date: null, effort_hours: '4.00', progress: null, depth: 0 },
    { __typename: 'ScheduleTaskEntry', task_id: 't-none', title: 'Unphased task', phase_id: null, start_date: null, end_date: null, effort_hours: '2.50', progress: null, depth: 0 },
    { __typename: 'ScheduleTaskEntry', task_id: 't-archived', title: 'Archived-phase task', phase_id: 'p-archived', start_date: null, end_date: null, effort_hours: '1.00', progress: null, depth: 0 },
  ];

  it('produces exact configured phase display order plus explicit Unphased ALWAYS LAST (even empty)', () => {
    const unordered: PhaseDescriptor[] = [
      { phase_id: 'p2', name: 'Review', display_order: 2 },
      { phase_id: 'p1', name: 'Creation', display_order: 1 },
      { phase_id: 'p-empty', name: 'Empty', display_order: 3 },
    ];

    const { phase_groups, unphased_group } = masterRowsFromProjection(projectionRows, unordered);

    expect(phase_groups.map((g) => g.phase_id)).toEqual(['p1', 'p2', 'p-empty']);
    expect(phase_groups.map((g) => g.name)).toEqual(['Creation', 'Review', 'Empty']);
    expect(unphased_group.phase_id).toBeNull();
    expect(unphased_group.is_unphased).toBe(true);
  });

  it('contributes each provided task exactly once; unknown phases fall to Unphased, never dropped', () => {
    const { phase_groups, unphased_group } = masterRowsFromProjection(projectionRows, phases);

    const allIds = [
      ...phase_groups.flatMap((g) => g.task_ids),
      ...unphased_group.task_ids,
    ];
    expect(allIds.sort()).toEqual(['t-archived', 't-child', 't-none', 't-other', 't-root']);
    expect(new Set(allIds).size).toBe(allIds.length);
    expect(unphased_group.task_ids.sort()).toEqual(['t-archived', 't-none']);
  });

  it('derives current-field rollups: min/max scheduled dates, direct-effort sum, weighted progress 2dp', () => {
    const { phase_groups } = masterRowsFromProjection(projectionRows, phases);
    const p1 = phase_groups.find((g) => g.phase_id === 'p1');

    expect(p1?.total_effort_hours).toBe(30);
    expect(p1?.start).toBe('2026-09-01T00:00:00Z');
    expect(p1?.end).toBe('2026-09-10T00:00:00Z');
    expect(p1?.progress_percent).toBe(66.67);
    expect(p1?.task_count).toBe(2);

    const p2 = phase_groups.find((g) => g.phase_id === 'p2');
    expect(p2?.start).toBeUndefined();
    expect(p2?.end).toBeUndefined();
    expect(p2?.progress_percent).toBeUndefined();
  });

  it('renders only what the projection provides (no fabricated cycle members)', () => {
    const { phase_groups, unphased_group } = masterRowsFromProjection(projectionRows.slice(0, 3), phases);
    const count = phase_groups.reduce((n, g) => n + g.task_count, 0) + unphased_group.task_count;
    expect(count).toBe(2);
  });

  it('ignores source headings for rollups (they are not tasks)', () => {
    const { phase_groups, unphased_group } = masterRowsFromProjection(projectionRows, phases);
    const names = phase_groups.map((g) => g.name);
    expect(names).not.toContain('Detailed Design');
    const total = phase_groups.reduce((n, g) => n + g.task_count, 0) + unphased_group.task_count;
    expect(total).toBe(5);
  });
});

describe('buildMasterRows', () => {
  it('groups each real task exactly once by phase_id in configured display order plus explicit Unphased', () => {
    const tasks: TaskScheduleItem[] = [
      task({ task_id: 'a', phase_id: 'p2', effort_hours: 2 }),
      task({ task_id: 'b', phase_id: 'p1', effort_hours: 3 }),
      task({ task_id: 'c', effort_hours: 4 }),
      task({ task_id: 'child', phase_id: 'p1', parent_task_id: 'b', effort_hours: 1 }),
    ];

    const result = buildMasterRows(tasks, phases);

    expect(result.phase_groups.map((g) => g.phase_id)).toEqual(['p1', 'p2']);
    expect(result.unphased_group.phase_id).toBeNull();
    expect(result.unphased_group.is_unphased).toBe(true);

    const allTaskIds = [
      ...result.phase_groups.flatMap((g) => g.task_ids),
      result.unphased_group.task_ids,
    ].flat();
    expect(allTaskIds.sort()).toEqual(['a', 'b', 'c', 'child']);
  });

  it('sums direct effort once per task regardless of hierarchy', () => {
    const tasks: TaskScheduleItem[] = [
      task({ task_id: 'parent', phase_id: 'p1', effort_hours: 5 }),
      task({ task_id: 'child', phase_id: 'p1', parent_task_id: 'parent', effort_hours: 2 }),
      task({ task_id: 'no-effort', phase_id: 'p1' }),
    ];

    const { phase_groups } = buildMasterRows(tasks, phases);
    expect(phase_groups[0].total_effort_hours).toBe(7);
    expect(phase_groups[0].task_count).toBe(3);
  });

  it('derives min/max dates only from scheduled real tasks', () => {
    const tasks: TaskScheduleItem[] = [
      task({ task_id: 's1', phase_id: 'p1', start: '2026-01-05', end: '2026-01-10' }),
      task({ task_id: 's2', phase_id: 'p1', start: '2026-01-02', end: '2026-01-20' }),
      task({ task_id: 'unscheduled', phase_id: 'p1', effort_hours: 3 }),
    ];

    const { phase_groups } = buildMasterRows(tasks, phases);
    expect(phase_groups[0].start).toBe('2026-01-02');
    expect(phase_groups[0].end).toBe('2026-01-20');
  });

  it('creates no fabricated dates when no task in a group is scheduled', () => {
    const tasks: TaskScheduleItem[] = [
      task({ task_id: 'u1', phase_id: 'p1', effort_hours: 2 }),
      task({ task_id: 'u2', phase_id: 'p1' }),
    ];

    const { phase_groups } = buildMasterRows(tasks, phases);
    expect(phase_groups[0].start).toBeUndefined();
    expect(phase_groups[0].end).toBeUndefined();
  });

  it('places tasks with unknown/unconfigured phase_id exactly once in explicit Unphased', () => {
    const tasks: TaskScheduleItem[] = [
      task({ task_id: 'archived-phase', phase_id: 'p-archived', effort_hours: 2 }),
      task({ task_id: 'known', phase_id: 'p1', effort_hours: 1 }),
      task({ task_id: 'none', effort_hours: 3 }),
    ];

    const result = buildMasterRows(tasks, phases);

    // Unknown phase is not fabricated as its own group
    expect(result.phase_groups.map((g) => g.phase_id)).toEqual(['p1', 'p2']);
    expect(result.unphased_group.task_ids.sort()).toEqual(['archived-phase', 'none']);
    expect(result.unphased_group.task_count).toBe(2);

    // Every live task id appears exactly once across all rows
    const allIds = [
      ...result.phase_groups.flatMap((g) => g.task_ids),
      ...result.unphased_group.task_ids,
 ];
    expect(allIds.sort()).toEqual(['archived-phase', 'known', 'none']);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('computes weighted progress per the backend contract rule (contributors = tasks with progress; weight = effort>0 else 1.0)', () => {
    const tasks: TaskScheduleItem[] = [
      task({ task_id: 'a', phase_id: 'p1', effort_hours: 8, progress_percent: 50 }),
      task({ task_id: 'b', phase_id: 'p1', effort_hours: 2, progress_percent: 100 }),
      // zero-effort contributor still counts with weight 1.0
      task({ task_id: 'zero-effort', phase_id: 'p1', effort_hours: 0, progress_percent: 100 }),
      // positive effort but no progress: NOT a contributor (excluded entirely)
      task({ task_id: 'no-progress', phase_id: 'p1', effort_hours: 4 }),
    ];

    const { phase_groups } = buildMasterRows(tasks, phases);
    // (8*50 + 2*100 + 1.0*100) / (8 + 2 + 1.0) = 700/11 = 63.64
    expect(phase_groups[0].progress_percent).toBe(63.64);
  });

  it('excludes tasks without progress from both numerator and denominator (contract fixture 66.67)', () => {
    // Task 1.3 handoff fixture: (10×100 + 20×50)/30 = 66.67; grandchild (no progress) excluded.
    const tasks: TaskScheduleItem[] = [
      task({ task_id: 't-root', phase_id: 'p1', effort_hours: 10, progress_percent: 100 }),
      task({ task_id: 't-child', phase_id: 'p1', effort_hours: 20, progress_percent: 50 }),
      task({ task_id: 't-grandchild', phase_id: 'p1', effort_hours: 6 }),
    ];

    const { phase_groups } = buildMasterRows(tasks, phases);
    expect(phase_groups[0].progress_percent).toBe(66.67);
    expect(phase_groups[0].total_effort_hours).toBe(36);
  });

  it('treats negative or invalid effort as zero in rollups', () => {
    const tasks: TaskScheduleItem[] = [
      task({ task_id: 'neg', phase_id: 'p1', effort_hours: -5, progress_percent: 100 }),
      task({ task_id: 'ok', phase_id: 'p1', effort_hours: 2, progress_percent: 100 }),
    ];

    const { phase_groups } = buildMasterRows(tasks, phases);
    expect(phase_groups[0].total_effort_hours).toBe(2);
    // Negative-effort task is excluded from weighting entirely
    expect(phase_groups[0].progress_percent).toBeCloseTo(100, 10);
  });

  it('omits progress when no task has a progress value', () => {
    const tasks: TaskScheduleItem[] = [task({ task_id: 'a', phase_id: 'p1', effort_hours: 7 })];

    const { phase_groups } = buildMasterRows(tasks, phases);
    expect(phase_groups[0].progress_percent).toBeUndefined();
  });

  it('rounds weighted progress to 2 decimal places', () => {
    const tasks: TaskScheduleItem[] = [
      task({ task_id: 'a', phase_id: 'p1', effort_hours: 3, progress_percent: 33 }),
      task({ task_id: 'b', phase_id: 'p1', effort_hours: 7, progress_percent: 0 }),
    ];

    const { phase_groups } = buildMasterRows(tasks, phases);
    // 99/10 = 9.9 exact; use a repeating case too: 1/3 weight
    expect(phase_groups[0].progress_percent).toBe(9.9);

    const repeating: TaskScheduleItem[] = [
      task({ task_id: 'x', phase_id: 'p1', effort_hours: 1, progress_percent: 0 }),
      task({ task_id: 'y', phase_id: 'p1', effort_hours: 1, progress_percent: 0 }),
      task({ task_id: 'z', phase_id: 'p1', effort_hours: 1, progress_percent: 100 }),
    ];
    expect(buildMasterRows(repeating, phases).phase_groups[0].progress_percent).toBe(33.33);
  });

  it('surfaces allocated/remaining hours only when supplied', () => {
    const withAlloc: TaskScheduleItem[] = [
      task({ task_id: 'a', phase_id: 'p1', allocated_hours: 6, remaining_hours: 2 }),
      task({ task_id: 'b', phase_id: 'p1', allocated_hours: 4, remaining_hours: 1 }),
    ];
    const withoutAlloc: TaskScheduleItem[] = [task({ task_id: 'a', phase_id: 'p1' })];

    const withResult = buildMasterRows(withAlloc, phases);
    expect(withResult.phase_groups[0].allocated_hours).toBe(10);
    expect(withResult.phase_groups[0].remaining_hours).toBe(3);

    const withoutResult = buildMasterRows(withoutAlloc, phases);
    expect(withoutResult.phase_groups[0].allocated_hours).toBeUndefined();
    expect(withoutResult.phase_groups[0].remaining_hours).toBeUndefined();
  });

  it('ignores deleted tasks everywhere', () => {
    const tasks: TaskScheduleItem[] = [
      task({ task_id: 'live', phase_id: 'p1', effort_hours: 2, deleted: false }),
      task({ task_id: 'gone', phase_id: 'p1', effort_hours: 9, deleted: true }),
    ];

    const { phase_groups } = buildMasterRows(tasks, phases);
    expect(phase_groups[0].task_count).toBe(1);
    expect(phase_groups[0].total_effort_hours).toBe(2);
  });

  it('includes empty configured phases and always an explicit Unphased group', () => {
    const tasks: TaskScheduleItem[] = [task({ task_id: 'a' })];

    const result = buildMasterRows(tasks, phases);
    expect(result.phase_groups.map((g) => g.name)).toEqual(['Phase 1', 'Phase 2']);
    expect(result.phase_groups.map((g) => g.task_count)).toEqual([0, 0]);
    expect(result.unphased_group.task_count).toBe(1);
  });

  it('does not mutate input tasks or phase descriptors', () => {
    const tasks: TaskScheduleItem[] = [task({ task_id: 'a', phase_id: 'p1', effort_hours: 1 })];
    const tasksSnapshot = JSON.parse(JSON.stringify(tasks));
    const phasesSnapshot = JSON.parse(JSON.stringify(phases));

    buildMasterRows(tasks, phases);

    expect(tasks).toEqual(tasksSnapshot);
    expect(phases).toEqual(phasesSnapshot);
  });
});

describe('buildMasterPhaseRows (selected-plan allocation authority)', () => {
  const catalog = [
    { catalog_item_id: 'catalog-build', project_id: 'project', kind: 'PROGRESS_TYPE' as const, display_order: 1, labels: [{ locale: 'en', name: 'Build' }] },
    { catalog_item_id: 'catalog-review', project_id: 'project', kind: 'PROGRESS_TYPE' as const, display_order: 2, labels: [{ locale: 'en', name: 'Review' }] },
  ];

  it('sums each direct positive allocation once, keeps gaps blank, and omits empty configured phases', () => {
    const rows = buildMasterPhaseRows([
      { taskId: 'parent', progressCatalogItemId: 'catalog-build', hoursPerDay: { '2026-09-07': 8, '2026-09-09': 2 } },
      { taskId: 'child', progressCatalogItemId: 'catalog-build', hoursPerDay: { '2026-09-07': 3 } },
      { taskId: 'child', progressCatalogItemId: 'catalog-review', hoursPerDay: { '2026-09-07': 99 } },
    ], catalog, 'en');

    expect(rows.map((row) => row.name)).toEqual(['Build']);
    expect(rows[0]).toMatchObject({
      task_ids: ['parent', 'child'], total_hours: 13,
      hours_per_day: { '2026-09-07': 11, '2026-09-09': 2 },
      start: '2026-09-07', end: '2026-09-09',
    });
    expect(rows[0].hours_per_day['2026-09-08']).toBeUndefined();
  });

  it('accounts null, missing, and foreign IDs in a truthful Unclassified row', () => {
    const rows = buildMasterPhaseRows([
      { taskId: 'known-null', progressCatalogItemId: null, hoursPerDay: { '2026-09-07': 2 } },
      { taskId: 'missing', hoursPerDay: { '2026-09-08': 3 } },
      { taskId: 'foreign', progressCatalogItemId: 'other-project', hoursPerDay: { '2026-09-09': 4 } },
      { taskId: 'legacy-hours', progressCatalogItemId: 'catalog-build', hoursPerDay: {}, allocationKnown: false },
      { taskId: 'legacy-span', progressCatalogItemId: 'catalog-build', hoursPerDay: {}, start: '2026-09-06', end: '2026-09-10', allocationKnown: false },
      { taskId: 'rejected', progressCatalogItemId: null, hoursPerDay: { '2026-09-08': 2 }, eligible: false },
      { taskId: 'zero-hours', progressCatalogItemId: null, hoursPerDay: { '2026-09-08': 0 } },
    ], catalog, 'en');

    const unclassified = rows.at(-1)!;
    expect(unclassified).toMatchObject({
      phase_id: null,
      task_ids: ['known-null', 'missing', 'foreign'],
      total_hours: 9,
      history_incomplete: true,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ task_ids: ['legacy-span'], start: '2026-09-06', end: '2026-09-10', history_incomplete: true });
    expect(rows[0].total_hours).toBeUndefined();
    expect(unclassified.task_ids).not.toEqual(expect.arrayContaining(['legacy-hours', 'rejected', 'zero-hours']));
  });

  it('uses stable catalog IDs for allocations while labels and display order change', () => {
    const allocation = [{ taskId: 'task', progressCatalogItemId: 'catalog-build', hoursPerDay: { '2026-09-07': 5 } }];
    const renamed = [
      { ...catalog[1], display_order: 0, labels: [{ locale: 'en', name: 'Review renamed' }] },
      { ...catalog[0], display_order: 1, labels: [{ locale: 'en', name: 'Build renamed' }] },
    ];

    expect(buildMasterPhaseRows(allocation, renamed, 'en')).toEqual(expect.arrayContaining([
      expect.objectContaining({ phase_id: 'catalog-build', name: 'Build renamed', hours_per_day: { '2026-09-07': 5 } }),
    ]));
    expect(buildMasterPhaseRows(allocation, renamed, 'en').map((row) => row.name)).toEqual(['Build renamed']);
  });
});
