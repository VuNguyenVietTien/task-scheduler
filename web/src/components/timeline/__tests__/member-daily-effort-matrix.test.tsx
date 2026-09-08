import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemberDailyEffortMatrix } from '../MemberDailyEffortMatrix';
import type { SchedulingConfig, SchedulingResourceMember } from '@/hooks/useProjectSchedulingConfig';

const members = ['under', 'full', 'over', 'empty'].map((id) => ({
  resource_member_id: id,
  display_name: id,
  user_id: null,
  member_kind: 'MEMBER',
})) as SchedulingResourceMember[];

const scheduling = {
  loading: false,
  error: undefined,
  daysOff: [],
  capacityFor: () => () => 8,
  groupIdsFor: () => [],
  reservedFor: () => ({ '2026-09-07': 7 }),
} as unknown as SchedulingConfig;

it('shows only assigned and working hours with capacity-based colors', () => {
  render(
    <MemberDailyEffortMatrix
      members={members}
      dates={[new Date(2026, 8, 7)]}
      taskEfforts={[
        { taskId: 't-under', assigneeResourceMemberId: 'under', hoursPerDay: { '2026-09-07': 4 } },
        { taskId: 't-full', assigneeResourceMemberId: 'full', hoursPerDay: { '2026-09-07': 8 } },
        { taskId: 't-over', assigneeResourceMemberId: 'over', hoursPerDay: { '2026-09-07': 9 } },
      ]}
      scheduling={scheduling}
      snapshotFrozen={false}
      dayWidth={80}
    />
  );

  const cells = Object.fromEntries(screen.getAllByTestId('member-effort-cell').map((cell) => [cell.dataset.memberId, cell]));
  expect(cells.under).toHaveClass('bg-yellow-100');
  expect(cells.full).toHaveClass('bg-emerald-100');
  expect(cells.over).toHaveClass('bg-red-100');
  expect(cells.empty).toHaveClass('bg-white');
  expect(within(cells.under).getByText('Assigned 4h')).toBeInTheDocument();
  expect(within(cells.under).getByText('Working 8h')).toBeInTheDocument();
  expect(cells.under.children).toHaveLength(2);
  expect(cells.under).not.toHaveTextContent(/reserved|budget|remaining/i);
});
