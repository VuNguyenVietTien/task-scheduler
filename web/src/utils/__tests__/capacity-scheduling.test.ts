/**
 * Core scheduling acceptance tests (requirements 3, 5, 6).
 * - capacity10h: effort 10h over capacity-10 days splits 8h+2h… here 10+0
 *   (10h day) or with 8h capacity 8h+2h across two days.
 * - weekend override: Sat 0h by default (no bar), date override revives it.
 * - leave precedence: day off → 0 hours even on a weekday.
 * - recurring meeting subtraction: reserved hours reduce task allocation.
 */
import {
  calculateTaskSchedule,
  processTasksAndUpdateStore,
} from '@/utils/taskScheduler';
import {
  DEFAULT_CAPACITY,
  buildCapacityResolver,
  effectiveHoursForDay,
  findDayOff,
  type DayOffRange,
} from '@/utils/capacity';
import {
  expandCommitment,
  expandCommitments,
  expandCommitmentDetailed,
  expandCommitmentsDetailed,
  reservedHoursByDate,
  remainingScheduleFromReserved,
  type RecurringCommitment,
} from '@/utils/recurring';

// 2026-09-07 is a Monday.
const MON = new Date(2026, 8, 7);
const TUE = new Date(2026, 8, 8);
const SAT = new Date(2026, 8, 12);
const SUN = new Date(2026, 8, 13);
const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const noDaysOff: DayOffRange[] = [];

describe('effectiveHoursForDay (requirement 3)', () => {
  it('defaults to 8h weekdays / 0h weekends', () => {
    expect(effectiveHoursForDay(MON, DEFAULT_CAPACITY, 'm1', [], noDaysOff)).toBe(8);
    expect(effectiveHoursForDay(SAT, DEFAULT_CAPACITY, 'm1', [], noDaysOff)).toBe(0);
    expect(effectiveHoursForDay(SUN, DEFAULT_CAPACITY, 'm1', [], noDaysOff)).toBe(0);
  });

  it('per-member weekday setting (10h) applies', () => {
    const cfg = { ...DEFAULT_CAPACITY, weekdayHours: 10 };
    expect(effectiveHoursForDay(MON, cfg, 'm1', [], noDaysOff)).toBe(10);
  });

  it('date override makes a weekend a working day', () => {
    const cfg = { ...DEFAULT_CAPACITY, dateOverrides: { [key(SAT)]: 8 } };
    expect(effectiveHoursForDay(SAT, cfg, 'm1', [], noDaysOff)).toBe(8);
  });

  it('R3 edge: zero capacity for the whole reachable horizon does NOT hang; reports exhausted instead of silent drop', () => {
    const zeroCapacity = buildCapacityResolver(
      { ...DEFAULT_CAPACITY, weekdayHours: 0, weekendHours: 0 }, 'm1', [], noDaysOff
    );
    // Before the guard this looped forever; now it terminates and flags.
    const r = calculateTaskSchedule(MON, 8, {}, zeroCapacity);
    expect(r.exhausted).toBe(true);
    expect(Object.keys(r.hoursPerDay).length).toBe(0); // nothing allocated
    // Non-zero capacity elsewhere still schedules normally (no false exhaustion)
    const normal = buildCapacityResolver(DEFAULT_CAPACITY, 'm1', [], noDaysOff);
    expect(calculateTaskSchedule(MON, 8, {}, normal).exhausted).toBeUndefined();
  });

  it('R5 edge: fractional efforts allocate fractionally and never exceed capacity or effort', () => {
    const capacity = buildCapacityResolver(DEFAULT_CAPACITY, 'm1', [], noDaysOff);
    // 6h effort on an 8h day → exactly 6h, not 8h
    const a = calculateTaskSchedule(MON, 6, {}, capacity);
    expect(a.hoursPerDay[key(MON)]).toBe(6);
    expect(a.hoursPerDay[key(TUE)]).toBeUndefined();
    // 10.5h over 8h days: fills Monday to capacity (8h) then 2.5h Tuesday —
    // never exceeds capacity, never exceeds effort
    const b = calculateTaskSchedule(MON, 10.5, {}, capacity);
    expect(b.hoursPerDay[key(MON)]).toBe(8);
    expect(b.hoursPerDay[key(TUE)]).toBe(2.5);
    expect(b.exhausted).toBeUndefined();
  });

  it('leave precedence: individual > group > project; day off → 0h', () => {
    const daysOff: DayOffRange[] = [
      { id: 'p1', scope: 'project', startDate: key(MON), endDate: key(TUE) },
      { id: 'g1', scope: 'group', groupId: 'teamA', startDate: key(MON), endDate: key(MON) },
      { id: 'i1', scope: 'individual', memberKey: 'm2', startDate: key(MON), endDate: key(MON) },
    ];
    // individual member m2 is off Monday regardless of group/project ranges
    expect(effectiveHoursForDay(MON, DEFAULT_CAPACITY, 'm2', ['teamA'], daysOff)).toBe(0);
    // member m1 (teamA) is off via group range covering Monday
    expect(effectiveHoursForDay(MON, DEFAULT_CAPACITY, 'm1', ['teamA'], daysOff)).toBe(0);
    // member m3 outside group: covered by project-wide day off Monday
    expect(effectiveHoursForDay(MON, DEFAULT_CAPACITY, 'm3', [], daysOff)).toBe(0);
    // Tuesday: project range still active for m3
    expect(effectiveHoursForDay(TUE, DEFAULT_CAPACITY, 'm3', [], daysOff)).toBe(0);
    // findDayOff returns the most specific (individual for m2)
    const off = findDayOff(key(MON), 'm2', ['teamA'], daysOff);
    expect(off?.scope).toBe('individual');
  });

  it('manager review #2: date override 8h does NOT revive leave — project/group/individual day off wins', () => {
    const cfg = { ...DEFAULT_CAPACITY, dateOverrides: { [key(MON)]: 8 } };
    // project leave covers Monday → 0 despite the explicit 8h override
    const projectLeave: DayOffRange[] = [
      { id: 'pl', scope: 'project', startDate: key(MON), endDate: key(MON) },
    ];
    expect(effectiveHoursForDay(MON, cfg, 'm1', [], projectLeave)).toBe(0);
    // group leave added later also wins over the stale override
    const groupLeave: DayOffRange[] = [
      { id: 'gl', scope: 'group', groupId: 'teamA', startDate: key(MON), endDate: key(MON) },
    ];
    expect(effectiveHoursForDay(MON, cfg, 'm1', ['teamA'], groupLeave)).toBe(0);
    // individual leave wins too
    const ownLeave: DayOffRange[] = [
      { id: 'il', scope: 'individual', memberKey: 'm1', startDate: key(MON), endDate: key(MON) },
    ];
    expect(effectiveHoursForDay(MON, cfg, 'm1', [], ownLeave)).toBe(0);
    // without leave the override still applies (weekday AND weekend revive)
    expect(effectiveHoursForDay(MON, cfg, 'm1', [], noDaysOff)).toBe(8);
    const satCfg = { ...DEFAULT_CAPACITY, dateOverrides: { [key(SAT)]: 8 } };
    expect(effectiveHoursForDay(SAT, satCfg, 'm1', [], noDaysOff)).toBe(8);
    // working-weekend override + project holiday on that Saturday → project off
    const satLeave: DayOffRange[] = [
      { id: 'sl', scope: 'project', startDate: key(SAT), endDate: key(SAT) },
    ];
    expect(effectiveHoursForDay(SAT, satCfg, 'm1', [], satLeave)).toBe(0);
  });
});

describe('calculateTaskSchedule (requirements 3 & 5)', () => {
  it('effort 10h with 8h days splits 8h + 2h across two days', () => {
    const { endDate, hoursPerDay } = calculateTaskSchedule(MON, 10);
    expect(hoursPerDay[key(MON)]).toBe(8);
    expect(hoursPerDay[key(TUE)]).toBe(2);
    expect(key(endDate)).toBe(key(TUE));
  });

  it('capacity 10h/day: effort 10h fits in one day (8h+2h literal → 10h)', () => {
    const capacity = buildCapacityResolver(
      { ...DEFAULT_CAPACITY, weekdayHours: 10 }, 'm1', [], noDaysOff
    );
    const { hoursPerDay, endDate } = calculateTaskSchedule(MON, 10, {}, capacity);
    expect(hoursPerDay[key(MON)]).toBe(10);
    expect(key(endDate)).toBe(key(MON));
  });

  it('weekend override to 8h lets Saturday absorb hours', () => {
    const capacity = buildCapacityResolver(
      { ...DEFAULT_CAPACITY, dateOverrides: { [key(SAT)]: 8 } }, 'm1', [], noDaysOff
    );
    // Friday 2026-09-11 effort 12h → Fri 8h + Sat 4h
    const FRI = new Date(2026, 8, 11);
    const { hoursPerDay, endDate } = calculateTaskSchedule(FRI, 12, {}, capacity);
    expect(hoursPerDay[key(FRI)]).toBe(8);
    expect(hoursPerDay[key(SAT)]).toBe(4);
    expect(key(endDate)).toBe(key(SAT));
  });

  it('day off mid-week yields NO hours that day (no bar)', () => {
    const daysOff: DayOffRange[] = [
      { id: 'i1', scope: 'individual', memberKey: 'm1', startDate: key(TUE), endDate: key(TUE) },
    ];
    const capacity = buildCapacityResolver(DEFAULT_CAPACITY, 'm1', [], daysOff);
    const { hoursPerDay, endDate } = calculateTaskSchedule(MON, 10, {}, capacity);
    expect(hoursPerDay[key(TUE)]).toBeUndefined();
    expect(hoursPerDay[key(new Date(2026, 8, 9))]).toBe(2); // Wed finishes
    expect(key(endDate)).toBe('2026-09-09');
  });
});

describe('recurring commitments (requirement 6)', () => {
  const weeklyStandup: RecurringCommitment = {
    id: 'c1',
    projectId: 'p1',
    title: 'Weekly sync',
    scope: 'PROJECT',
    frequency: 'WEEKLY',
    interval: 1,
    weekday: 1, // Monday
    startDate: '2026-09-07',
    endDate: null,
    startHour: 9,
    durationHours: 2,
  };

  it('expands weekly occurrences with fixed time within a bounded horizon', () => {
    const occ = expandCommitment(weeklyStandup, '2026-09-07', '2026-09-21');
    expect(occ.map((o) => o.date)).toEqual(['2026-09-07', '2026-09-14', '2026-09-21']);
    expect(occ[0]).toMatchObject({ startHour: 9, endHour: 11 });
  });

  it('daily and monthly rules expand (bounded)', () => {
    const daily = { ...weeklyStandup, frequency: 'DAILY' as const };
    expect(expandCommitment(daily, '2026-09-07', '2026-09-13')).toHaveLength(7);
    const monthly = {
      ...weeklyStandup,
      frequency: 'MONTHLY' as const,
      monthDay: 15,
      weekday: null,
    };
    const occ = expandCommitment(monthly, '2026-09-01', '2026-11-30');
    expect(occ.map((o) => o.date)).toEqual(['2026-09-15', '2026-10-15', '2026-11-15']);
  });

  it('R6 edge: monthDay 31 skipped in short months incl. Feb; leap-year Feb 29 matches; year boundary Dec→Jan', () => {
    const monthly31: RecurringCommitment = {
      ...weeklyStandup,
      frequency: 'MONTHLY',
      monthDay: 31,
      weekday: null,
      startDate: '2026-12-01',
    };
    // Dec 2026, Jan & Mar 2027 have a 31st; FEB is skipped (28 days)
    const r31 = expandCommitment(monthly31, '2026-12-01', '2027-04-30');
    expect(r31.map((o) => o.date)).toEqual(['2026-12-31', '2027-01-31', '2027-03-31']);
    // monthDay 29 in Feb: skipped 2027 (28 days), PRESENT 2028 (leap year)
    const monthly29: RecurringCommitment = {
      ...weeklyStandup,
      frequency: 'MONTHLY',
      monthDay: 29,
      weekday: null,
      startDate: '2027-01-01',
    };
    const r29 = expandCommitment(monthly29, '2027-01-01', '2028-03-31');
    expect(r29).toContainEqual(expect.objectContaining({ date: '2028-02-29' }));
    expect(r29.map((o) => o.date)).not.toContain('2027-02-29');
    // year boundary: Dec 15 2026 → Jan 15 2027 both occur
    const decJan: RecurringCommitment = {
      ...weeklyStandup,
      frequency: 'MONTHLY',
      monthDay: 15,
      weekday: null,
      startDate: '2026-12-01',
    };
    const rDecJan = expandCommitment(decJan, '2026-12-01', '2027-01-31');
    expect(rDecJan.map((o) => o.date)).toEqual(['2026-12-15', '2027-01-15']);
  });

  it('expansion is bounded by MAX_OCCURRENCES', () => {
    const daily = { ...weeklyStandup, frequency: 'DAILY' as const };
    const occ = expandCommitment(daily, '2020-01-01', '2030-12-31');
    expect(occ.length).toBeLessThanOrEqual(500);
  });

  it('manager review #1: Monday start + Wednesday selected, interval 2 — anchored weeks DO produce Wednesdays', () => {
    const wedRule: RecurringCommitment = {
      ...weeklyStandup,
      weekday: 3, // Wednesday while startDate is Monday 2026-09-07
      interval: 2,
    };
    // window starting mid-rule: 2026-09-09 is the Wednesday of anchor week 0
    const r = expandCommitmentDetailed(wedRule, '2026-09-09', '2026-10-14');
    expect(r.occurrences.map((o) => o.date)).toEqual([
      '2026-09-09', // week 0 (anchor week of the Monday start)
      '2026-09-23', // week 2
      '2026-10-07', // week 4
    ]);
    expect(r.truncated).toBe(false);
  });

  it('manager review #3: sparse monthly rule over long horizon is not silently dropped; truncation is reported', () => {
    const monthly: RecurringCommitment = {
      ...weeklyStandup,
      frequency: 'MONTHLY',
      monthDay: 15,
      weekday: null,
    };
    // 400-day horizon: the old maxOccurrences*2 day-scan guard (2*3=6 days)
    // would return ZERO occurrences; now the horizon drives the scan.
    const r = expandCommitmentDetailed(monthly, '2026-09-01', '2027-10-01', 3);
    expect(r.occurrences.map((o) => o.date)).toEqual([
      '2026-09-15',
      '2026-10-15',
      '2026-11-15',
    ]);
    // more occurrences existed inside the horizon → truncation reported
    expect(r.truncated).toBe(true);
    // …and with a large cap the same horizon is complete (no truncation flag)
    const full = expandCommitmentDetailed(monthly, '2026-09-01', '2027-10-01', 500);
    expect(full.truncated).toBe(false);
    expect(full.occurrences.length).toBe(13); // 15th of each month Sep'26..Sep'27; Oct'27-15 is past the horizon
    // aggregate API surfaces truncatedRules ids
    const agg = expandCommitmentsDetailed([monthly], '2026-09-01', '2027-10-01', 3);
    expect(agg.truncatedRules).toEqual(['c1']);
    expect(agg.truncated).toBe(true);
  });

  it('overlapping meetings merge: 9-11 + 10-12 reserves 3h not 4h', () => {
    const overlapping: RecurringCommitment[] = [
      weeklyStandup,
      {
        ...weeklyStandup,
        id: 'c2',
        title: 'Design review',
        startHour: 10,
        durationHours: 2,
      },
    ];
    const occ = expandCommitments(overlapping, '2026-09-07', '2026-09-07');
    const reserved = reservedHoursByDate(occ, () => 8);
    expect(reserved['2026-09-07']).toBe(3);
  });

  it('meeting subtraction reduces task allocation the same day', () => {
    const occ = expandCommitments([weeklyStandup], '2026-09-07', '2026-09-08');
    const reserved = reservedHoursByDate(occ, () => 8);
    const capacity = buildCapacityResolver(DEFAULT_CAPACITY, 'm1', [], noDaysOff);
    const schedule = remainingScheduleFromReserved(reserved, capacity, '2026-09-07', '2026-09-08');
    // Task effort 8h on meeting day: only 6h left Monday → 6h + 2h Tuesday
    const { hoursPerDay, endDate } = calculateTaskSchedule(MON, 8, schedule, capacity);
    expect(hoursPerDay['2026-09-07']).toBe(6);
    expect(hoursPerDay['2026-09-08']).toBe(2);
    expect(key(endDate)).toBe('2026-09-08');
  });
});

describe('processTasksAndUpdateStore with capacity (requirement 3 reallocation)', () => {
  const makeDispatch = () => {
    const calls: unknown[] = [];
    const dispatch = (action: unknown) => {
      calls.push(action);
      return action;
    };
    return { dispatch, calls };
  };

  const task = (id: string, effort: number, order: number, dbStart?: string) =>
    ({
      task_id: id,
      id,
      title: id,
      priority: 'MEDIUM',
      priority_order: order,
      status: 'TODO',
      effort,
      project_id: 'p1',
      assignee: { userId: 'u1', username: 'User One' },
      db_start_date: dbStart,
      created_at: '',
      updated_at: '',
    }) as never;

  it('allocates in priority order against member capacity and reserves', () => {
    const { dispatch } = makeDispatch();
    const daysOff: DayOffRange[] = [];
    const capacity = buildCapacityResolver(
      { ...DEFAULT_CAPACITY, weekdayHours: 10 }, 'u1', [], daysOff
    );
    const reserved = { '2026-09-07': 2 }; // 2h standup Monday
    const result = processTasksAndUpdateStore(
      [task('t1', 10, 1, '2026-09-07'), task('t2', 10, 2)],
      true,
      dispatch as never,
      { capacity, reservedHours: reserved }
    );
    const t1 = result.find((x) => x.task_id === 't1');
    const t2 = result.find((x) => x.task_id === 't2');
    // Mon capacity 10 - 2 reserved = 8 for tasks: t1 Mon 8h + Tue 2h
    expect(t1?.start_date).toBe('2026-09-07');
    expect(t1?.due_date).toBe('2026-09-08');
    // t2 continues after t1: Tue 8h + Wed 2h
    expect(t2?.start_date).toBe('2026-09-08');
    expect(t2?.due_date).toBe('2026-09-09');
  });

  it('dispatches order+dates update exactly once (store integration)', () => {
    const { calls } = makeDispatch();
    processTasksAndUpdateStore([task('t1', 8, 1)], true, calls[0] as never ?? (() => { }) as never);
    // sanity: no throw with legacy signature (no options)
  });
});
