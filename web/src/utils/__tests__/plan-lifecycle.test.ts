/**
 * Saved-plan lifecycle acceptance tests (herdr-260906).
 * - New Plan draft = current tasks (priority order) × CURRENT config
 *   (leave honored); a draft never mutates a saved snapshot.
 * - Save snapshot carries per-day hours + assignee/resource member ids.
 * - Saved bars are a PURE function of the snapshot: viewport AND later
 *   config changes cannot move them; only Recalculate (+ explicit save)
 *   produces new bars.
 * - Recalculate uses the SAVED plan's task set with CURRENT config.
 * - Zero capacity → task flagged exhausted/unscheduled (warned, never
 *   silently dropped or faked).
 */
import {
  draftFromCurrentTasks,
  draftFromSavedPlanTasks,
  isSnapshotStale,
  parsePlanSnapshot,
  reorderPlanSnapshot,
  savedBarsAreViewportIndependent,
  snapshotToBars,
  type PlanSnapshot,
  type SnapshotTask,
} from '@/utils/planLifecycle';
import {
  DEFAULT_CAPACITY,
  buildCapacityResolver,
  type DayOffRange,
} from '@/utils/capacity';

// 2026-09-07 is a Monday; 2026-09-08 Tuesday; 2026-09-09 Wednesday.
const TODAY = new Date(2026, 8, 7);
const HORIZON = { from: '2026-09-07', to: '2026-10-07' };

const memberKeyFor = (userId?: string | null) => userId ?? 'unassigned';

function makeConfig(daysOff: DayOffRange[] = [], weekdayHours = 8) {
  return {
    capacityFor: (key: string) =>
      buildCapacityResolver(
        { ...DEFAULT_CAPACITY, weekdayHours, weekendHours: 0 },
        key,
        [],
        daysOff
      ),
    reservedFor: () => ({}),
    memberKeyFor,
  };
}

const tasks = [
  {
    task_id: 't-low',
    title: 'low',
    status: 'TODO',
    effort: 8,
    priority_order: 2,
    assignee_user_id: 'u1',
  },
  {
    task_id: 't-high',
    title: 'high',
    status: 'TODO',
    effort: 8,
    priority_order: 1,
    assignee_user_id: 'u1',
  },
];

describe('New Plan: draft from current tasks with CURRENT leave', () => {
  it('schedules in priority order and skips leave days (current config wins)', () => {
    // Project leave covers Tuesday 2026-09-08 → 8h task lands Mon+Wed.
    const leave: DayOffRange[] = [
      { id: 'd1', scope: 'project', startDate: '2026-09-08', endDate: '2026-09-08' },
    ];
    const draft = draftFromCurrentTasks({
      tasks,
      config: makeConfig(leave),
      horizon: HORIZON,
      today: TODAY,
    });
    expect(draft.snapshot.meta.source).toBe('new-plan');
    const high = draft.snapshot.tasks.find((t) => t.taskId === 't-high')!;
    const low = draft.snapshot.tasks.find((t) => t.taskId === 't-low')!;
    // Priority order in the snapshot.
    expect(high.priorityOrder).toBeLessThan(low.priorityOrder);
    // Leave day gets zero hours; t-high takes Monday, t-low takes Wednesday.
    expect(high.hoursPerDay['2026-09-07']).toBe(8);
    expect(high.hoursPerDay['2026-09-08']).toBeUndefined();
    expect(low.hoursPerDay['2026-09-09']).toBe(8);
    expect(low.hoursPerDay['2026-09-08']).toBeUndefined();
  });

  it('draft does NOT overwrite a saved snapshot (bytes untouched until Save)', () => {
    const saved: PlanSnapshot = {
      version: 2,
      tasks: [
        {
          taskId: 't-high',
          startDate: '2025-01-01',
          endDate: '2025-01-02',
          hoursPerDay: { '2025-01-01': 8 },
          priorityOrder: 1,
        },
      ],
      meta: { savedAt: '2025-01-01T00:00:00Z' },
    };
    const before = JSON.stringify(saved);
    draftFromCurrentTasks({ tasks, config: makeConfig(), horizon: HORIZON, today: TODAY });
    expect(JSON.stringify(saved)).toBe(before);
  });
});

describe('Save/load: snapshot stability + viewport independence', () => {
  const saved: PlanSnapshot = {
    version: 2,
    tasks: [
      {
        taskId: 't1',
        startDate: '2026-09-07',
        endDate: '2026-09-09',
        hoursPerDay: { '2026-09-07': 8, '2026-09-09': 4 },
        assigneeUserId: 'u1',
        assigneeResourceMemberId: 'rm1',
        priorityOrder: 1,
      },
    ],
    meta: { savedAt: '2026-09-06T00:00:00Z', configFingerprint: 'fp-v1' },
  };

  it('snapshotToBars renders hours/day exactly as saved', () => {
    const bars = snapshotToBars(saved);
    expect(bars.t1).toEqual({
      start: '2026-09-07',
      end: '2026-09-09',
      hoursPerDay: { '2026-09-07': 8, '2026-09-09': 4 },
      unscheduled: false,
    });
  });

  it('saved bars are viewport-independent (scroll cannot move them)', () => {
    const wide = savedBarsAreViewportIndependent(saved, {
      from: '2026-01-01',
      to: '2027-01-01',
    });
    const narrow = savedBarsAreViewportIndependent(saved, {
      from: '2026-09-07',
      to: '2026-09-07',
    });
    const none = savedBarsAreViewportIndependent(saved, null);
    expect(wide).toEqual(narrow);
    expect(narrow).toEqual(none);
  });

  it('a config change does NOT move saved bars (only staleness flips)', () => {
    expect(isSnapshotStale('fp-v1', 'fp-v1')).toBe(false);
    expect(isSnapshotStale('fp-v1', 'fp-v2')).toBe(true);
    // Bars still pure from snapshot bytes:
    expect(snapshotToBars(saved).t1.start).toBe('2026-09-07');
  });

  it('duplicate task entries in a snapshot render once (no duplicate bars)', () => {
    const dup: PlanSnapshot = {
      ...saved,
      tasks: [...saved.tasks, { ...saved.tasks[0] }],
    };
    expect(Object.keys(snapshotToBars(dup))).toEqual(['t1']);
  });

  it('parsePlanSnapshot accepts empty plans but rejects corrupt hours, dates, and duplicate ids', () => {
    expect(parsePlanSnapshot({ version: 2, tasks: [], meta: {} }).tasks).toEqual([]);
    expect(() => parsePlanSnapshot({ tasks: [{ startDate: 'x' }] })).toThrow();
    expect(() => parsePlanSnapshot('not json')).toThrow(); // string payloads are JSON.parse'd
    expect(() => parsePlanSnapshot({
      version: 2,
      meta: {},
      tasks: [
        { taskId: 't1', startDate: '2026-09-07', endDate: '2026-09-07', hoursPerDay: {}, priorityOrder: 1 },
        { taskId: 't1', startDate: '2026-09-07', endDate: '2026-09-07', hoursPerDay: {}, priorityOrder: 2 },
      ],
    })).toThrow();
    expect(() => parsePlanSnapshot({
      version: 2, meta: {}, tasks: [
        { taskId: 't1', startDate: '2026-02-30', endDate: '2026-02-30', hoursPerDay: {}, priorityOrder: 1 },
      ],
    })).toThrow();
  });

  it('adapts legacy rows without inventing daily hours', () => {
    const legacy = parsePlanSnapshot({
      tasks: [{
        taskId: 'legacy-1', startDate: '2026-09-07', endDate: '2026-09-08',
        priorityOrder: 4, assigneeId: 'u-legacy', title: 'Legacy task',
      }],
    });
    expect(legacy.tasks[0]).toMatchObject({
      taskId: 'legacy-1', startDate: '2026-09-07', endDate: '2026-09-08',
      priorityOrder: 4, assigneeUserId: 'u-legacy', hoursPerDay: {},
    });
    expect(legacy.meta.legacyHoursMissing).toBe(true);

    const legacyV2 = parsePlanSnapshot({
      version: 2,
      tasks: [{ taskId: 'legacy-v2', startDate: '2026-09-07', endDate: '2026-09-08', priorityOrder: 1 }],
      meta: {},
    });
    expect(legacyV2.tasks[0].hoursPerDay).toEqual({});
    expect(legacyV2.meta.legacyHoursMissing).toBe(true);
    expect(() => parsePlanSnapshot({
      version: 2,
      tasks: [{ taskId: 'corrupt-v2', startDate: '2026-09-07', endDate: '2026-09-08', priorityOrder: 1, hoursPerDay: 'invalid' }],
      meta: {},
    })).toThrow(/invalid daily hours/);
  });

  it('rejects invalid optional snapshot identity metadata', () => {
    expect(() => parsePlanSnapshot({
      version: 2, meta: {}, tasks: [{
        taskId: 't1', startDate: '2026-09-07', endDate: '2026-09-07',
        hoursPerDay: { '2026-09-07': 1 }, priorityOrder: 1,
        assigneeResourceMemberId: 42,
      }],
    })).toThrow();
  });

  it('preserves canonical progress IDs, accepts the snake alias, and distinguishes missing from null', () => {
    const base = { taskId: 't1', startDate: '2026-09-07', endDate: '2026-09-07', hoursPerDay: { '2026-09-07': 1 }, priorityOrder: 1 };
    const id = '00000000-0000-0000-0000-000000000001';
    expect(parsePlanSnapshot({ version: 2, meta: {}, tasks: [{ ...base, progressCatalogItemId: id }] }).tasks[0].progressCatalogItemId).toBe(id);
    expect(parsePlanSnapshot({ version: 2, meta: {}, tasks: [{ ...base, progress_catalog_item_id: id }] }).tasks[0].progressCatalogItemId).toBe(id);
    expect(parsePlanSnapshot({ version: 2, meta: {}, tasks: [{ ...base, progressCatalogItemId: null }] }).tasks[0]).toHaveProperty('progressCatalogItemId', null);
    expect(parsePlanSnapshot({ version: 2, meta: {}, tasks: [base] }).tasks[0]).not.toHaveProperty('progressCatalogItemId');
    expect(() => parsePlanSnapshot({ version: 2, meta: {}, tasks: [{ ...base, progressCatalogItemId: id, progress_catalog_item_id: null }] })).toThrow(/conflicting progress catalog aliases/);
    expect(() => parsePlanSnapshot({ version: 2, meta: {}, tasks: [{ ...base, progressCatalogItemId: 'not-a-uuid' }] })).toThrow(/invalid progress catalog item id/);
  });

  it('captures a live progress catalog ID in a new snapshot without changing saved bytes', () => {
    const draft = draftFromCurrentTasks({
      tasks: [{ task_id: 'catalogued', title: 'catalogued', status: 'TODO', effort: 1, priority_order: 1, progressCatalogItemId: '00000000-0000-0000-0000-000000000001' }],
      config: makeConfig(), horizon: HORIZON, today: TODAY,
    });
    expect(draft.snapshot.tasks[0].progressCatalogItemId).toBe('00000000-0000-0000-0000-000000000001');
    expect(parsePlanSnapshot(draft.snapshot).tasks[0].progressCatalogItemId).toBe('00000000-0000-0000-0000-000000000001');
  });

  it('reorders a draft snapshot locally without changing its allocations or source snapshot', () => {
    const source: PlanSnapshot = {
      version: 2,
      meta: { savedAt: '2026-09-07T00:00:00Z' },
      tasks: [
        { taskId: 'a', startDate: '2026-09-07', endDate: '2026-09-07', hoursPerDay: { '2026-09-07': 8 }, priorityOrder: 1 },
        { taskId: 'b', startDate: '2026-09-08', endDate: '2026-09-08', hoursPerDay: { '2026-09-08': 4 }, priorityOrder: 2 },
      ],
    };
    const ordered = reorderPlanSnapshot(source, ['b', 'a']);
    expect(ordered.tasks.map((task) => [task.taskId, task.priorityOrder])).toEqual([['b', 1], ['a', 2]]);
    expect(ordered.tasks[0].hoursPerDay).toEqual({ '2026-09-08': 4 });
    expect(source.tasks.map((task) => task.taskId)).toEqual(['a', 'b']);
    expect(reorderPlanSnapshot(source, ['a'])).toBe(source);
  });
});

describe('Recalculate: saved task set × CURRENT config', () => {
  const savedTasks: SnapshotTask[] = [
    {
      taskId: 't-high',
      startDate: '2026-09-07',
      endDate: '2026-09-07',
      hoursPerDay: { '2026-09-07': 8 },
      priorityOrder: 1,
    },
  ];

  it('recalc draft reflects CURRENT leave (saved dates do not pin new bars)', () => {
    const noLeave = draftFromSavedPlanTasks(savedTasks, {
      tasks,
      config: makeConfig(),
      horizon: HORIZON,
      today: TODAY,
    });
    expect(noLeave.snapshot.tasks[0].hoursPerDay['2026-09-07']).toBe(8);

    const leaveOnMonday: DayOffRange[] = [
      { id: 'd1', scope: 'project', startDate: '2026-09-07', endDate: '2026-09-07' },
    ];
    const withLeave = draftFromSavedPlanTasks(savedTasks, {
      tasks,
      config: makeConfig(leaveOnMonday),
      horizon: HORIZON,
      today: TODAY,
    });
    // Current leave takes priority: Monday is now empty, work moves to Tue.
    expect(withLeave.snapshot.tasks[0].hoursPerDay['2026-09-07']).toBeUndefined();
    expect(withLeave.snapshot.tasks[0].hoursPerDay['2026-09-08']).toBe(8);
    expect(withLeave.snapshot.meta.source).toBe('recalculate');
  });

  it('tasks deleted since the save are dropped from the recalc draft', () => {
    const onlyLive = draftFromSavedPlanTasks(
      [
        ...savedTasks,
        { ...savedTasks[0], taskId: 't-deleted', priorityOrder: 9 },
      ],
      { tasks, config: makeConfig(), horizon: HORIZON, today: TODAY }
    );
    expect(onlyLive.snapshot.tasks.map((t) => t.taskId)).toEqual(['t-high']);
  });
});

describe('Zero capacity: warned, never silently dropped', () => {
  it('zero-capacity member → exhausted + unscheduled snapshot entry', () => {
    const draft = draftFromCurrentTasks({
      tasks,
      config: makeConfig([], 0), // weekday capacity 0 for everyone
      horizon: HORIZON,
      today: TODAY,
    });
    expect(draft.exhaustedTaskIds.sort()).toEqual(['t-high', 't-low']);
    const bars = snapshotToBars(draft.snapshot);
    expect(bars['t-high'].unscheduled).toBe(true);
    expect(Object.values(bars['t-high'].hoursPerDay)).toEqual([]);
    // Warning surfaces in the snapshot itself (empty hours = ⚠).
    expect(draft.snapshot.tasks.find((t) => t.taskId === 't-high')!.hoursPerDay).toEqual({});
  });
});
