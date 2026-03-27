export interface ProjectData {
  id: string;
  name: string;
  description: string;
  dueDate: string;
  members: number;
  status: 'active' | 'completed' | 'on-hold';
}

export type MemberRole = 'Manager' | 'Leader' | 'Member' | 'Guest';

export interface ProjectMember {
  memberId: string;
  projectId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
  invitedBy?: string;
  user: {
    id: string;
    email: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
  }
}

export interface ProjectDetails {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  priority: string;
  status: string;
  visibility: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  iconUrl: string | null;
  userRole?: MemberRole;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  priority?: string;
  status?: string;
  visibility?: string;
  iconUrl?: string;
}

export const normalizeRole = (role: string): MemberRole => {
  const normalized = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  if (['Manager', 'Leader', 'Member', 'Guest'].includes(normalized)) {
    return normalized as MemberRole;
  }
  // Backward compatibility mapping
  const mapping: Record<string, MemberRole> = {
    'Admin': 'Manager',
    'Viewer': 'Guest',
  };
  if (mapping[normalized]) return mapping[normalized];
  throw new Error(`Invalid role: ${role}`);
};

export const getRoleDisplayName = (role: MemberRole): string => {
  switch (role) {
    case 'Manager':
      return 'Manager';
    case 'Leader':
      return 'Leader';
    case 'Member':
      return 'Member';
    case 'Guest':
      return 'Guest';
    default:
      return role;
  }
};

export const getRolePermissions = (role: MemberRole): string[] => {
  switch (role) {
    case 'Manager':
      return [
        'Quản lý thành viên',
        'Thay đổi vai trò',
        'Chỉnh sửa dự án',
        'Xem thông tin',
        'Tạo và quản lý công việc'
      ];
    case 'Leader':
      return [
        'Quản lý công việc',
        'Quản lý thành viên',
        'Xem thông tin',
        'Cập nhật tiến độ'
      ];
    case 'Member':
      return [
        'Xem thông tin',
        'Tạo và chỉnh sửa công việc',
        'Cập nhật tiến độ'
      ];
    case 'Guest':
      return [
        'Xem thông tin'
      ];
    default:
      return [];
  }
}; 