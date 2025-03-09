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

// Function to refresh token
async function refreshToken(): Promise<string> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    return data.accessToken;
  } catch (error) {
    console.error('Token refresh failed:', error);
    window.location.href = '/auth';
    throw error;
  }
}

// Main GraphQL request function
export async function graphqlRequest<T = any>(
  query: string,
  variables?: Record<string, any>,
  retryCount = 0
): Promise<T> {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      credentials: 'include', // Include cookies in the request
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    // Handle 401 Unauthorized
    if (response.status === 401 && retryCount < 1) {
      // Try to refresh token
      await refreshToken();
      // Retry request with new token
      return graphqlRequest(query, variables, retryCount + 1);
    }

    const result: GraphQLResponse<T> = await response.json();

    if (result.errors) {
      const error = new Error(result.errors[0].message);
      // Check if error is due to authentication
      if (result.errors[0].message.toLowerCase().includes('unauthorized') ||
          result.errors[0].message.toLowerCase().includes('authentication')) {
        error.name = 'AuthenticationError';
        // Redirect to login if authentication fails
        window.location.href = '/auth';
      }
      throw error;
    }

    return result.data as T;
  } catch (error) {
    // If error is not authentication related, rethrow
    if (error instanceof Error && error.name !== 'AuthenticationError') {
      throw error;
    }
    // Otherwise redirect to login
    window.location.href = '/auth';
    throw error;
  }
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
      projectId
      name
      description
      startDate
      endDate 
      status
      priority
      visibility
      tags
      category
      metadata
      iconUrl
      isPublic
      createdAt
      owner {
        userId
        email
        fullName
        avatarUrl
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
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  visibility?: 'PUBLIC' | 'PRIVATE' | 'TEAM';
  tags?: string[];
  status?: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';
  category?: string;
  startDate?: string;
  endDate?: string;
  iconUrl?: string;
  metadata?: Record<string, any>;
}

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  effort?: number;
  dueDate?: string;
  assigneeId?: string;
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