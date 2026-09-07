import { parsePlanSnapshot } from '@/utils/planLifecycle';

const legacy = { task_id: 'task', start_date: '2026-09-07', end_date: '2026-09-07', priority_order: 1 };
test.each([
  { assigneeResourceMemberId: 'resource-a', assignee_resource_member_id: 'resource-b' },
  { parentTaskId: 'parent-a', parent_task_id: 'parent-b' },
  { assigneeUserId: 'user-a', assignee_user_id: 'user-b' },
  { assigneeUserId: 'user-a', assignee_id: 'user-b' },
  { assignee_user_id: null, assigneeId: 'user-b' },
  { assigneeResourceMemberId: null, assignee_resource_member_id: 'resource-b' },
])('R12 rejects contradictory supported legacy identity/hierarchy aliases %j', aliases => {
  expect(() => parsePlanSnapshot({ tasks: [{ ...legacy, ...aliases }] })).toThrow();
});

test.each([
  { assigneeUserId: 'u', assignee_user_id: 'u', assigneeId: 'u', assignee_id: 'u', parentTaskId: 'p', parent_task_id: 'p' },
  { assigneeResourceMemberId: 'r', assignee_resource_member_id: 'r' },
  { assignee_user_id: 'u', assignee_resource_member_id: 'r', parent_task_id: 'p' },
  { assigneeUserId: null, assignee_id: null, assigneeResourceMemberId: null, parent_task_id: null },
])('retains valid legacy aliases and honest missing-hours state %j', aliases => {
  const snapshot = parsePlanSnapshot({ version: 1, tasks: [{ ...legacy, ...aliases }] });
  expect(snapshot.meta.legacyHoursMissing).toBe(true);
  expect(snapshot.tasks[0]).toMatchObject({ startDate: '2026-09-07', endDate: '2026-09-07', priorityOrder: 1, hoursPerDay: {} });
});
test('an empty legacy plan remains valid', () => {
  expect(parsePlanSnapshot({ tasks: [] }).tasks).toEqual([]);
});
