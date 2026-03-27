import { createBrowserClient } from '@/lib/supabase/client';

const GRAPHQL_ENDPOINT = '/api/graphql';

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

// Main GraphQL request function — uses Supabase session for auth
export async function graphqlRequest<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const supabase = createBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (response.status === 401) {
    window.location.href = '/auth';
    throw new Error('Unauthorized');
  }

  const result: GraphQLResponse<T> = await response.json();

  if (result.errors) {
    const error = new Error(result.errors[0].message);
    if (result.errors[0].message.toLowerCase().includes('unauthenticated')) {
      window.location.href = '/auth';
    }
    throw error;
  }

  return result.data as T;
}

// Re-export types for backward compatibility
export type { RegisterInput, LoginInput, CreateProjectInput, CreateTaskInput, UpdateTaskInput } from './graphqlClient.types';

// Authentication Mutations
export const registerMutation = `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      token
      expires_in
      user { id email name role verified }
    }
  }
`;

export const loginMutation = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
      expires_in
      user { id email name role verified }
    }
  }
`;

// Project Mutations
export const createProjectMutation = `
  mutation CreateProject($input: CreateProjectInput!) {
    create_project(input: $input) {
      id name description status priority visibility
      created_at updated_at
      owner { user_id email full_name avatar_url }
    }
  }
`;

// Task Mutations
export const createTaskMutation = `
  mutation CreateTask($input: CreateTaskInput!) {
    create_task(input: $input) {
      task_id title description status
    }
  }
`;

export const updateTaskMutation = `
  mutation UpdateTask($input: UpdateTaskInput!) {
    update_task(input: $input) {
      task_id title description status priority_order
      start_date due_date updated_at
    }
  }
`;

// Task Queries
export const getTasksQuery = `
  query GetTasks($project_id: ID!) {
    tasks(project_id: $project_id) {
      task_id title description status effort priority_order priority
      progress start_date due_date actual_start_date actual_end_date
      created_at updated_at
      assignee { user_id username avatar_url }
    }
  }
`;
