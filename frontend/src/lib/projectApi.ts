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
  projectId: string;
  name: string;
  description: string;
  createdAt: string;
  priority: string;
  visibility: string;
  tags: string;
  progress: number;
  category: string;
  metadata: string;
  status: string;
  memberCount: number;
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
        projectId
        name
        description
        priority
        visibility
        tags
        category
        metadata
        startDate
        endDate
        iconUrl
        isPublic
        status
        createdAt
        owner {
          userId
          email
          fullName
          avatarUrl
        }
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
        projectId
        name
        description
        createdAt
        priority
        visibility
        tags
        progress
        category
        metadata
        startDate
        endDate
        iconUrl
        isPublic
        status
        memberCount
        owner {
          userId
          email
          fullName
          avatarUrl
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
      project(projectId: $projectId) {
        projectId
        name
        description
        createdAt
        priority
        visibility
        tags
        progress
        category
        metadata
        startDate
        endDate
        iconUrl
        isPublic
        status
        memberCount
        owner {
          userId
          email
          fullName
          avatarUrl
        }
        members {
          userId
          email
          fullName
          avatarUrl
          role
          joinedAt
        }
      }
    }
  `, { projectId: id });

  if (!response.project) {
    throw new Error('Project not found');
  }

  return response.project;
};