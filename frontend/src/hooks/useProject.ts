import { useQuery } from '@apollo/client';
import { GET_PROJECT_BY_ID } from '@/graphql/queries/project';

export interface ProjectMember {
  role: string;
  joinedAt: string;
  user: {
    userId: string;
    email: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
}

export interface ProjectOwner {
  userId: string;
  email: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface Project {
  projectId: string;
  name: string;
  description: string | null;
  createdAt: string;
  priority: string;
  visibility: string;
  tags: string[];
  progress: number;
  category: string;
  metadata: any;
  startDate: string;
  endDate: string;
  iconUrl: string | null;
  isPublic: boolean;
  status: string;
  memberCount: number;
  owner: ProjectOwner;
  members: ProjectMember[];
  userRole?: string; // Vai trò của người dùng hiện tại trong project (Admin, Member, Viewer, Guest, null)
}

export const useProject = (projectId: string) => {
  return useQuery<{ project: Project }>(GET_PROJECT_BY_ID, {
    variables: { projectId },
    skip: !projectId,
  });
};
