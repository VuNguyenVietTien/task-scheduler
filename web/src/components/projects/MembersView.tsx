'use client';

import { SchedulingConfigPanel } from './SchedulingConfigPanel';

type Member = {
  role: string;
  joinedAt: string;
  position?: string | null;
  user: {
    userId: string;
    email: string;
    fullName: string;
    username: string;
    avatarUrl: string;
  };
};

type ProjectMembersProps = {
  projectId: string;
  members: Member[];
  currentUserRole: string;
  refetch: () => void;
};

/** One canonical member surface. Access is explicit on each resource row;
 * placeholders remain available for capacity, leave, groups and assignments. */
export function MembersView({ projectId, currentUserRole }: ProjectMembersProps) {
  const role = String(currentUserRole).toLowerCase();
  return (
    <SchedulingConfigPanel
      projectId={projectId}
      canManage={['manager', 'leader', 'admin'].includes(role)}
    />
  );
}
