import {
  canAddMembers,
  canEditOtherTimesheets,
  canRemoveMember,
  canViewMembers,
  canViewOtherTimesheets,
  canViewSettings,
} from '../project-permissions';

test('member and settings tabs follow the role matrix', () => {
  expect(canAddMembers('manager')).toBe(true);
  expect(canAddMembers('leader')).toBe(true);
  expect(canAddMembers('member')).toBe(false);
  expect(canViewMembers('member')).toBe(true);
  expect(canViewMembers('guest')).toBe(false);
  expect(canViewSettings('manager')).toBe(true);
  expect(canViewSettings('leader')).toBe(false);
});

test('removal protects owners and peer managers', () => {
  expect(canRemoveMember('manager', 'manager', true, false, false)).toBe(true);
  expect(canRemoveMember('manager', 'manager', false, false, false)).toBe(false);
  expect(canRemoveMember('manager', 'leader', false, false, false)).toBe(true);
  expect(canRemoveMember('leader', 'leader', true, false, false)).toBe(true);
  expect(canRemoveMember('leader', 'leader', false, false, false)).toBe(false);
  expect(canRemoveMember('leader', 'member', false, false, false)).toBe(true);
  expect(canRemoveMember('manager', 'manager', false, true, false)).toBe(true);
  expect(canRemoveMember('manager', 'member', false, true, true)).toBe(false);
});

test('timesheet read and edit permissions differ for leaders', () => {
  expect(canViewOtherTimesheets('manager')).toBe(true);
  expect(canEditOtherTimesheets('manager')).toBe(true);
  expect(canViewOtherTimesheets('leader')).toBe(true);
  expect(canEditOtherTimesheets('leader')).toBe(false);
  expect(canViewOtherTimesheets('member')).toBe(false);
});
