export type ProjectRole = 'manager' | 'leader' | 'member' | 'guest';

export function projectRole(value?: string | null): ProjectRole {
  const role = String(value ?? '').toLowerCase();
  if (role === 'admin') return 'manager';
  if (role === 'viewer') return 'guest';
  return ['manager', 'leader', 'member', 'guest'].includes(role) ? role as ProjectRole : 'guest';
}

export const canViewMembers = (role?: string | null) => projectRole(role) !== 'guest';
export const canAddMembers = (role?: string | null) => ['manager', 'leader'].includes(projectRole(role));
export const canViewSettings = (role?: string | null) => projectRole(role) === 'manager';
export const canViewOtherTimesheets = (role?: string | null) => ['manager', 'leader'].includes(projectRole(role));
export const canEditOtherTimesheets = (role?: string | null) => projectRole(role) === 'manager';

export function canRemoveMember(
  callerRole: string | null | undefined,
  targetRole: string | null | undefined,
  isSelf: boolean,
  isOwner: boolean,
  targetIsOwner: boolean,
) {
  if (targetIsOwner) return false;
  if (isOwner) return true;
  const caller = projectRole(callerRole);
  const target = targetRole ? projectRole(targetRole) : null;
  if (caller === 'manager') return isSelf || target !== 'manager';
  if (caller === 'leader') return isSelf || target === null || ['member', 'guest'].includes(target);
  return false;
}
