import { useQuery } from '@apollo/client';
import { GET_PROJECT_BY_ID } from '@/graphql/queries/project';

export interface ProjectMember {
  userId: string;
  username: string;
  avatarUrl: string | null;
  role: string;
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
}

export const useProject = (projectId: string) => {
  return useQuery<{ project: Project }>(GET_PROJECT_BY_ID, {
    variables: { projectId },
    skip: !projectId,
  });
};
