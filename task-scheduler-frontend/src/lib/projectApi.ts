import { graphqlRequest } from './graphqlClient';
import type { CreateProjectInput } from './graphqlClient';

interface ProjectMember {
  id: string;
  role: string;
  user: {
    id: string;
    name: string;
  };
}

export interface Project {
  id: string;
  name: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  members: ProjectMember[];
}

interface CreateProjectResponse {
  createProject: Project;
}

export const createProject = async (input: CreateProjectInput): Promise<Project> => {
  const response = await graphqlRequest<CreateProjectResponse>(`
    mutation CreateProject($input: CreateProjectInput!) {
      createProject(input: $input) {
        id
        name
        description
        startDate
        endDate
        status
        members {
          id
          role
          user {
            id
            name
          }
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
        id
        name
        description
        startDate
        endDate
        status
        members {
          id
          role
          user {
            id
            name
          }
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
    query GetProject($id: ID!) {
      project(id: $id) {
        id
        name
        description
        startDate
        endDate
        status
        members {
          id
          role
          user {
            id
            name
          }
        }
      }
    }
  `, { id });

  if (!response.project) {
    throw new Error('Project not found');
  }

  return response.project;
};