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

  it('parsePlanSnapshot rejects junk payloads loudly', () => {
    expect(() => parsePlanSnapshot({ tasks: [] })).toThrow();
    expect(() => parsePlanSnapshot({ tasks: [{ startDate: 'x' }] })).toThrow();
    expect(() => parsePlanSnapshot('not json')).toThrow(); // string payloads are JSON.parse'd
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
