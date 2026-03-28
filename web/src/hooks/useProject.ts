import { useQuery } from '@apollo/client';
import { GET_PROJECT_BY_ID } from '@/graphql/queries/project';

export interface ProjectMember {
  role: string;
  joined_at: string;
  user: {
    user_id: string;
    email: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface ProjectOwner {
  user_id: string;
  email: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface Project {
  project_id: string;
  name: string;
  description: string | null;
  created_at: string;
  priority: string;
  visibility: string;
  tags: string[];
  progress: number;
  category: string;
  metadata: any;
  start_date: string;
  end_date: string;
  icon_url: string | null;
  is_public: boolean;
  status: string;
  member_count: number;
  owner: ProjectOwner;
  members: ProjectMember[];
  user_role?: string;
}

export const useProject = (projectId: string) => {
  return useQuery<{ project: Project }>(GET_PROJECT_BY_ID, {
    variables: { projectId },
    skip: !projectId,
  });
};
