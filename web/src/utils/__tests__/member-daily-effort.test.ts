import { buildMemberDailyEffort } from '@/utils/member-daily-effort';

const dates = ['2026-09-07', '2026-09-08'];
const members = [
  { resourceMemberId: 'rm-parent', displayName: 'Parent', userId: 'u-parent' },
  { resourceMemberId: 'rm-child', displayName: 'Child', userId: null },
  { resourceMemberId: 'rm-zero', displayName: 'Zero', userId: null },
];

describe('buildMemberDailyEffort', () => {
  it('keeps zero members and counts direct parent/child effort exactly once', () => {
    const rows = buildMemberDailyEffort(members, dates, [
      { taskId: 'parent', assigneeResourceMemberId: 'rm-parent', hoursPerDay: { '2026-09-07': 2 } },
      { taskId: 'child', assigneeResourceMemberId: 'rm-child', hoursPerDay: { '2026-09-07': 6 } },
      { taskId: 'phase-rollup', kind: 'PHASE', assigneeResourceMemberId: 'rm-parent', hoursPerDay: { '2026-09-07': 8 } },
      { taskId: 'child', assigneeResourceMemberId: 'rm-child', hoursPerDay: { '2026-09-07': 6 } },
    ]);

    expect(rows.find((row) => row.resourceMemberId === 'rm-parent')!.hoursByDate).toEqual({
      '2026-09-07': 2, '2026-09-08': 0,
    });
    expect(rows.find((row) => row.resourceMemberId === 'rm-child')!.hoursByDate).toEqual({
      '2026-09-07': 6, '2026-09-08': 0,
    });
    expect(rows.find((row) => row.resourceMemberId === 'rm-zero')!.hoursByDate).toEqual({
      '2026-09-07': 0, '2026-09-08': 0,
    });
  });

  it('uses a diagnostic row for unresolved allocation instead of assigning it to a member', () => {
    const rows = buildMemberDailyEffort(members, dates, [
      { taskId: 'unknown', assigneeResourceMemberId: 'missing', hoursPerDay: { '2026-09-08': 3 } },
    ]);

    expect(rows.find((row) => row.resourceMemberId === 'rm-parent')!.hoursByDate['2026-09-08']).toBe(0);
    expect(rows.find((row) => row.isDiagnostic)).toMatchObject({
      resourceMemberId: 'diagnostic:missing',
      hoursByDate: { '2026-09-07': 0, '2026-09-08': 3 },
    });
  });

  it('maps legacy user-only assignments, but never falls back from an invalid explicit resource id', () => {
    const rows = buildMemberDailyEffort(members, dates, [
      { taskId: 'legacy-user', assigneeUserId: 'u-parent', hoursPerDay: { '2026-09-07': 2 } },
      { taskId: 'invalid-resource', assigneeResourceMemberId: 'missing', assigneeUserId: 'u-parent', hoursPerDay: { '2026-09-07': 3 } },
    ]);

    expect(rows.find((row) => row.resourceMemberId === 'rm-parent')!.hoursByDate['2026-09-07']).toBe(2);
    expect(rows.find((row) => row.isDiagnostic)?.hoursByDate['2026-09-07']).toBe(3);
  });
});
