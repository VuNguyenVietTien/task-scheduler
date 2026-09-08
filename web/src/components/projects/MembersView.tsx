'use client';

import { SchedulingConfigPanel } from './SchedulingConfigPanel';
import { canAddMembers } from '@/utils/project-permissions';

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
  currentUserId?: string;
  ownerUserId?: string;
  refetch: () => void;
};

/** One canonical member surface. Access is explicit on each resource row;
 * placeholders remain available for capacity, leave, groups and assignments. */
export function MembersView({ projectId, currentUserRole, currentUserId, ownerUserId, refetch }: ProjectMembersProps) {
  return (
    <SchedulingConfigPanel
      projectId={projectId}
      canManage={canAddMembers(currentUserRole)}
      currentUserRole={currentUserRole}
      currentUserId={currentUserId}
      ownerUserId={ownerUserId}
      onMembersChanged={refetch}
    />
  );
}
