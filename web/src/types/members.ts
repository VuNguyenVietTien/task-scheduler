export type MemberRole = 'Manager' | 'Leader' | 'Member' | 'Guest';

export interface UserInfo {
  userId: string;
  email: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface Member {
  memberId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
  position?: string | null;
  user: UserInfo;
}

export interface MemberRoleUpdate {
  userId: string;
  role: MemberRole;
}

export interface MembersTabProps {
  projectId: string;
}

export interface PendingChanges {
  [userId: string]: MemberRole;
}

export interface NotificationType {
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface BulkUpdateResult {
  successCount: number;
  members: {
    user: UserInfo;
    role: MemberRole;
    joinedAt: string;
  }[];
}

export interface BulkRemoveResult {
  successCount: number;
  failedCount: number;
} 