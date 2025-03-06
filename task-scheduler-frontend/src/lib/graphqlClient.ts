// GraphQL client implementation
import { getAuthHeaders } from './api';

const GRAPHQL_ENDPOINT = `${process.env.NEXT_PUBLIC_BACKEND_URL}/graphql`;

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations: Array<{
      line: number;
      column: number;
    }>;
    path: string[];
  }>;
}

export async function graphqlRequest<T = any>(
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const result: GraphQLResponse<T> = await response.json();

  if (result.errors) {
    throw new Error(result.errors[0].message);
  }

  return result.data as T;
}

// Authentication Mutations
export const registerMutation = `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      accessToken
      refreshToken
      user {
        id
        email
        name
      }
    }
  }
`;

export const loginMutation = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      refreshToken
      user {
        id
        email
        name
      }
    }
  }
`;

// Project Mutations
export const createProjectMutation = `
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
`;

// Task Mutations
export const createTaskMutation = `
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      taskId
      title
      description
      status
      assigneeId
    }
  }
`;

export const updateTaskMutation = `
  mutation UpdateTask($input: UpdateTaskInput!) {
    updateTask(input: $input) {
      taskId
      title 
      description
      status
      priorityOrder
      startDate
      dueDate
      updatedAt
    }
  }
`;

// Task Queries
export const getTasksQuery = `
  query GetTasks($projectId: ID!) {
    tasks(projectId: $projectId) {
      taskId
      title
      description
      status
      effort
      priority_order
      priority
      assigneeId
      progress
      start_date
      due_date
      actual_start_date
      actual_end_date
      created_at
      updated_at
    }
  }
`;

// Type definitions
export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface CreateProjectInput {
  name: string;
  description: string;
  ownerId: string;
  members: Array<{
    userId: string;
    role: string;
  }>;
}

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  effort: number;
  assigneeIds: string[];
}

export interface UpdateTaskInput {
  taskId: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  priorityOrder?: number;
  startDate?: string;
  dueDate?: string;
}