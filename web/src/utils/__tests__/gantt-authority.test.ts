import { draftFromCurrentTasks, parsePlanSnapshot, snapshotToBars } from '../planLifecycle';
import { sortGanttSiblingTaskIds } from '../ganttRows';
import { computeTaskAllocations, fmt } from '../taskAllocations';
import { buildMemberDailyEffort } from '../member-daily-effort';

const config = { capacityFor: () => () => 8, reservedFor: () => ({}), memberKeyFor: () => 'rm' };
const inputs = { config, horizon: { from: '2026-09-07', to: '2026-10-07' }, today: new Date(2026, 8, 7), tasks: [
  { task_id: 'p', title: 'Parent', effort: 8, priority_order: 1 },
  { task_id: 'a', parent_task_id: 'p', effort: 8, priority_order: 2 },
  { task_id: 'b', parent_task_id: 'p', effort: 8, priority_order: 3 },
  { task_id: 'u', effort: 8, priority_order: 4 },
] };

test('R1 selected membership is before collapse; ancestors are non-accounting metadata; zero matches stays empty', () => {
  const draft = draftFromCurrentTasks({ ...inputs, selectedTaskIds: new Set(['a']) } as any);
  expect(draft.snapshot.tasks.map(t => t.taskId)).toEqual(['a']);
  expect(draft.snapshot.meta.contextTasks).toEqual([expect.objectContaining({ taskId: 'p', title: 'Parent' })]);
  expect(Object.keys(draft.allocations)).toEqual(['a']);
  expect(draft.snapshot.tasks[0].hoursPerDay).toEqual({ '2026-09-07': 8 });
  expect(draftFromCurrentTasks({ ...inputs, selectedTaskIds: new Set() } as any).snapshot.tasks).toEqual([]);
});

test('R5 auto-sort replaces matching sibling slots only, retaining CLOSE last', () => {
  const tasks = [
    { task_id: 'a', priority: 'MEDIUM' }, { task_id: 'h', priority: 'LOW' },
    { task_id: 'b', priority: 'CRITICAL' }, { task_id: 'closed', status: 'CLOSE', priority: 'CRITICAL' },
  ];
  expect((sortGanttSiblingTaskIds as any)(tasks, new Set(['a', 'b', 'closed']))).toEqual(['b', 'h', 'a', 'closed']);
});

test('R7 positive vector owns first/last bounds after full-day reservation and saved padding', () => {
  const result = computeTaskAllocations([{ task_id: 'a', effort: 10 }], {
    ...config, reservedFor: () => ({ '2026-09-07': 8 }),
  }, inputs.horizon, inputs.today);
  expect(fmt(result.allocations.a.start)).toBe('2026-09-08');
  const bars = snapshotToBars({ version: 2, meta: { savedAt: '' }, tasks: [{
    taskId: 'a', startDate: '2026-09-07', endDate: '2026-09-09', priorityOrder: 1, hoursPerDay: { '2026-09-08': 8 },
  }] });
  expect([bars.a.start, bars.a.end]).toEqual(['2026-09-08', '2026-09-08']);
});

test('R11 missing legacy vectors mark only affected member/date totals unknown, including unresolved identity', () => {
  const rows = buildMemberDailyEffort([
    { resourceMemberId: 'rm', displayName: 'Member', userId: 'u' }, { resourceMemberId: 'zero', displayName: 'Zero' },
  ], ['2026-09-07', '2026-09-08', '2026-09-09'], [
    { taskId: 'legacy', assigneeUserId: 'u', hoursPerDay: {}, unknownSpan: { start: '2026-09-07', end: '2026-09-08' } },
    { taskId: 'unresolved', hoursPerDay: {}, unknownSpan: { start: '2026-09-07', end: '2026-09-07' } },
  ] as any);
  expect((rows[0] as any).unknownDates).toEqual(['2026-09-07', '2026-09-08']);
  expect((rows[1] as any).unknownDates).toEqual([]);
  expect(rows.find(r => r.isDiagnostic)).toMatchObject({ unknownDates: ['2026-09-07'] });
});

const legacy = { taskId: 'a', startDate: '2026-09-07', endDate: '2026-09-08', priorityOrder: 1, assigneeId: 'u' };
test.each([
  ['unsupported version', { version: 3, tasks: [legacy] }],
  ['duplicate ID', { tasks: [legacy, { ...legacy, priorityOrder: 2 }] }],
  ['bad identity', { tasks: [{ ...legacy, assigneeId: 42 }] }],
  ['bad date', { tasks: [{ ...legacy, startDate: '2026-02-30' }] }],
  ['reversed dates', { tasks: [{ ...legacy, startDate: '2026-09-09' }] }],
  ['bad order', { tasks: [{ ...legacy, priorityOrder: -1 }] }],
  ['duplicate order', { tasks: [legacy, { ...legacy, taskId: 'b' }] }],
  ['conflicting aliases', { tasks: [{ ...legacy, task_id: 'other' }] }],
])('R12 rejects %s without adapting corrupt data', (_, payload) => {
  expect(() => parsePlanSnapshot(payload)).toThrow();
});
test('R12 supports empty and snake-case legacy plans without inventing hours', () => {
  expect(parsePlanSnapshot({ tasks: [] }).tasks).toEqual([]);
  expect(parsePlanSnapshot({ tasks: [{ task_id: 'a', start_date: '2026-09-07', end_date: '2026-09-08', priority_order: 1, assignee_id: null }] }).tasks[0]).toMatchObject({ taskId: 'a', hoursPerDay: {}, assigneeUserId: null });
});
