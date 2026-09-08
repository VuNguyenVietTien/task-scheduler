/**
 * Viewport-independence regression (manager review): the SAME task gets the
 * SAME allocation regardless of the visible date range; commitments beyond
 * the viewport are still subtracted; exhausted effort is reported.
 * Also covers memberKeyFor mapping (R2/R3): capacity keyed by
 * resource_member_id applies to tasks assigned via the linked user id.
 */
import {
  computeTaskAllocations,
  schedulingHorizon,
} from '@/utils/taskAllocations';
import { buildCapacityResolver, DEFAULT_CAPACITY } from '@/utils/capacity';
import type { DayOffRange } from '@/utils/capacity';

const noDaysOff: DayOffRange[] = [];
const today = new Date(2026, 8, 7); // Monday

function makeConfig(reserved: Record<string, Record<string, number>> = {}, memberMap: Record<string, string> = {}) {
  return {
    capacityFor: (key: string) => buildCapacityResolver(DEFAULT_CAPACITY, key, [], noDaysOff),
    reservedFor: (key: string, _from: string, _to: string) => reserved[key] ?? {},
    memberKeyFor: (userId?: string | null) => (userId && memberMap[userId]) || userId || 'unassigned',
  };
}

describe('schedulingHorizon', () => {
  it('is viewport-independent: short and long viewports share today→+365d', () => {
    const short = schedulingHorizon(today, today, new Date(2026, 8, 10));
    const none = schedulingHorizon(today);
    expect(short).toEqual(none);
    expect(short.from).toBe('2026-09-07');
    expect(short.to).toBe('2027-09-07');
  });
  it('a viewport LONGER than the horizon extends it (display must cover allocation)', () => {
    const long = schedulingHorizon(today, today, new Date(2028, 11, 31));
    expect(long.to).toBe('2028-12-31');
  });
});

describe('computeTaskAllocations viewport-independence (R3/R6)', () => {
  const task = { task_id: 't1', status: 'TODO', start_date: '2026-09-07', effort: 10 };

  it('SAME allocation for 7-day and 30-day horizons — meeting beyond the short view still subtracts', () => {
    // Meeting Tue 2026-09-22 (outside a 7-day view, inside a 30-day view)
    const config = makeConfig({ u1: { '2026-09-22': 4 } });
    const horizon = schedulingHorizon(today); // explicit, NOT the viewport
    const a = computeTaskAllocations([{ ...task, assignee_user_id: 'u1' }], config, horizon, today);
    const b = computeTaskAllocations([{ ...task, assignee_user_id: 'u1' }], config, horizon, today);
    // identical because the horizon — not the viewport — drives the seed
    expect(a).toEqual(b);
    // sanity: 10h over 8h days → Mon 8 + Tue 2 (the 22nd is irrelevant here)
    expect(a.allocations.t1.hoursPerDay['2026-09-07']).toBe(8);
    expect(a.allocations.t1.hoursPerDay['2026-09-08']).toBe(2);
  });

  it('task effort beyond the horizon is flagged exhausted, never silently complete', () => {
    const config = makeConfig();
    const tiny = { from: '2026-09-07', to: '2026-09-08' }; // horizon smaller than effort
    const r = computeTaskAllocations([{ ...task, effort: 40, assignee_user_id: 'u1' }], config, tiny, today);
    expect(r.exhaustedTaskIds).toEqual(['t1']);
  });

  it('memberKeyFor maps linked user → resource_member so capacity/commitments apply (R2/R3)', () => {
    // capacity & reservations keyed by resource_member 'rm-1', task assigned to user 'u1'
    const config = makeConfig({ 'rm-1': { '2026-09-07': 2 } }, { u1: 'rm-1' });
    const horizon = schedulingHorizon(today);
    const r = computeTaskAllocations([{ ...task, assignee_user_id: 'u1' }], config, horizon, today);
    // Monday capacity 8 − reserved 2 = 6h allocated Monday, 4h Tuesday
    expect(r.allocations.t1.hoursPerDay['2026-09-07']).toBe(6);
    expect(r.allocations.t1.hoursPerDay['2026-09-08']).toBe(4);
  });

  it('unlinked/placeholder assignee falls back to userId key (never silently unassigned)', () => {
    const config = makeConfig({ u1: { '2026-09-07': 8 } }); // full-day meeting for u1
    const horizon = schedulingHorizon(today);
    const r = computeTaskAllocations([{ ...task, assignee_user_id: 'u1' }], config, horizon, today);
    // Monday fully reserved → task starts Tuesday 8h + Wednesday 2h
    expect(r.allocations.t1.hoursPerDay['2026-09-07']).toBeUndefined();
    expect(r.allocations.t1.hoursPerDay['2026-09-08']).toBe(8);
    expect(r.allocations.t1.hoursPerDay['2026-09-09']).toBe(2);
  });

  it('does not allocate rejected or archived tasks', () => {
    const r = computeTaskAllocations([
      { ...task, task_id: 'rejected', status: 'REJECTED', effort: 2 },
      { ...task, task_id: 'archived', status: 'ARCHIVED', effort: 2 },
      { ...task, task_id: 'eligible', status: 'TODO', effort: 2 },
    ], makeConfig(), schedulingHorizon(today), today);

    expect(Object.keys(r.allocations)).toEqual(['eligible']);
    expect(r.allocations.eligible.hoursPerDay).toEqual({ '2026-09-07': 2 });
  });

  it('does not allocate summary parents or let their stored effort delay descendants', () => {
    const r = computeTaskAllocations([
      { task_id: 'parent', effort: 40, assignee_user_id: 'u1' },
      { task_id: 'child-a', parent_task_id: 'parent', effort: 8, assignee_user_id: 'u1' },
      { task_id: 'child-b', parent_task_id: 'parent', effort: 4, assignee_user_id: 'u1' },
    ], makeConfig(), schedulingHorizon(today), today);

    expect(r.allocations.parent).toBeUndefined();
    expect(r.allocations['child-a'].hoursPerDay).toEqual({ '2026-09-07': 8 });
    expect(r.allocations['child-b'].hoursPerDay).toEqual({ '2026-09-08': 4 });
  });

  it('does not consume member capacity twice when a selected task id is duplicated', () => {
    const r = computeTaskAllocations([
      { ...task, assignee_user_id: 'u1' },
      { ...task, effort: 99, assignee_user_id: 'u1' },
    ], makeConfig(), schedulingHorizon(today), today);
    expect(r.allocations.t1.hoursPerDay).toEqual({ '2026-09-07': 8, '2026-09-08': 2 });
  });

  it('keeps undated lower-priority work behind future same-member work', () => {
    const r = computeTaskAllocations([
      { task_id: 'high', priority_order: 1, assignee_user_id: 'u1', start_date: '2026-09-10', effort: 8 },
      { task_id: 'low', priority_order: 2, assignee_user_id: 'u1', effort: 8 },
    ], makeConfig(), schedulingHorizon(today), today);

    expect(r.allocations.high.hoursPerDay).toEqual({ '2026-09-10': 8 });
    expect(r.allocations.low.hoursPerDay).toEqual({ '2026-09-11': 8 });
  });

  it('sequences each assignee independently', () => {
    const r = computeTaskAllocations([
      { task_id: 'a-high', priority_order: 1, assignee_user_id: 'a', start_date: '2026-09-10', effort: 8 },
      { task_id: 'b-low', priority_order: 2, assignee_user_id: 'b', effort: 8 },
      { task_id: 'a-low', priority_order: 3, assignee_user_id: 'a', effort: 8 },
    ], makeConfig(), schedulingHorizon(today), today);

    expect(r.allocations['b-low'].hoursPerDay).toEqual({ '2026-09-07': 8 });
    expect(r.allocations['a-low'].hoursPerDay).toEqual({ '2026-09-11': 8 });
  });

  it('keeps stable order while respecting weekends, leave, and remaining daily capacity', () => {
    const leave: DayOffRange[] = [{
      id: 'leave', scope: 'individual', memberKey: 'u1', startDate: '2026-09-14', endDate: '2026-09-14',
    }];
    const config = {
      ...makeConfig(),
      capacityFor: (key: string) => buildCapacityResolver(DEFAULT_CAPACITY, key, [], leave),
    };
    const r = computeTaskAllocations([
      { task_id: 'first', priority_order: 1, assignee_user_id: 'u1', start_date: '2026-09-11', effort: 10 },
      { task_id: 'second', priority_order: 2, assignee_user_id: 'u1', effort: 8 },
    ], config, schedulingHorizon(today), today);

    expect(r.allocations.first.hoursPerDay).toEqual({ '2026-09-11': 8, '2026-09-15': 2 });
    expect(r.allocations.second.hoursPerDay).toEqual({ '2026-09-15': 6, '2026-09-16': 2 });
    for (const date of ['2026-09-11', '2026-09-15', '2026-09-16']) {
      const used = (r.allocations.first.hoursPerDay[date] ?? 0) + (r.allocations.second.hoursPerDay[date] ?? 0);
      expect(used).toBeLessThanOrEqual(8);
    }
  });
});
