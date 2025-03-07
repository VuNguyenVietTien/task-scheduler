import { graphqlRequest } from './graphqlClient';
import type { CreateProjectInput } from './graphqlClient';

export interface ProjectMember {
  user_id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  role: string;
  joined_at: string;
}

export interface Project {
  project_id: string;
  name: string;
  description: string;
  owner_id: string;
  created_at: string;
  priority: string;
  visibility: string;
  tags: string;
  progress: number;
  category: string;
  metadata: string;
  status: string;
  member_count: number;
  owner: ProjectMember;
  members: ProjectMember[];
}

interface CreateProjectResponse {
  createProject: Project;
}

export const createProject = async (input: CreateProjectInput): Promise<Project> => {
  const response = await graphqlRequest<CreateProjectResponse>(`
    mutation CreateProject($input: CreateProjectInput!) {
      createProject(input: $input) {
        project_id
        name
        description
        owner_id
        priority
        visibility
        tags
        category
        metadata
        start_date
        end_date
        icon_url
        is_public
        status
      }
    }
  `, { input });

  if (!response.createProject) {
    throw new Error('Failed to create project');
  }

  return response.createProject;
};

interface GetProjectsResponse {
  projects: Project[];
}
  
export const getProjects = async (): Promise<Project[]> => {
  const response = await graphqlRequest<GetProjectsResponse>(`
    query GetProjects {
      projects {
        project_id
        name
        description
        owner_id
        created_at
        priority
        visibility
        tags
        progress
        category
        metadata
        start_date
        end_date
        icon_url
        is_public
        status
        member_count
        owner {
          user_id
          email
          full_name
          avatar_url
        }
      }
    }
  `);

  return response.projects || [];
};

interface GetProjectResponse {
  project: Project;
}

export const getProject = async (id: string): Promise<Project> => {
  const response = await graphqlRequest<GetProjectResponse>(`
    query GetProjectById($projectId: UUID!) {
      project(project_id: $projectId) {
        project_id
        name
        description
        owner_id
        created_at
        priority
        visibility
        tags
        progress
        category
        metadata
        start_date
        end_date
        icon_url
        is_public
        status
        member_count
        owner {
          user_id
          email
          full_name
          avatar_url
        }
        members {
          user_id
          email
          full_name
          avatar_url
          role
          joined_at
        }
      }
    }
  `, { projectId: id });

  if (!response.project) {
    throw new Error('Project not found');
  }

  return response.project;
};