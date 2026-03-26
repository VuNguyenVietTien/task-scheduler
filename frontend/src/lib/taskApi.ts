import { graphqlRequest } from './graphqlClient';
import type { CreateTaskInput, UpdateTaskInput } from './graphqlClient';

export interface Task {
  taskId: string;
  title: string;
  description: string;
  status: string;
  effort: number;
  priority_order: number;
  priority: string;
  assigneeId: string;
  progress: number;
  start_date: string | null;
  due_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateTaskResponse {
  createTask: {
    taskId: string;
    title: string;
    description: string;
    status: string;
    assigneeId: string;
  };
}

export const createTask = async (input: CreateTaskInput): Promise<Partial<Task>> => {
  const response = await graphqlRequest<CreateTaskResponse>(`
    mutation CreateTask($input: CreateTaskInput!) {
      createTask(input: $input) {
        taskId
        title
        description
        status
        assigneeId
      }
    }
  `, { input });

  if (!response.createTask) {
    throw new Error('Failed to create task');
  }

  return response.createTask;
};

interface UpdateTaskResponse {
  updateTask: {
    taskId: string;
    title: string;
    description: string;
    status: string;
    priorityOrder: number;
    startDate: string | null;
    dueDate: string | null;
    updatedAt: string;
  };
}

export const updateTask = async (input: UpdateTaskInput): Promise<Partial<Task>> => {
  const response = await graphqlRequest<UpdateTaskResponse>(`
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
  `, { input });

  if (!response.updateTask) {
    throw new Error('Failed to update task');
  }

  // Convert the response to match Task interface
  return {
    taskId: response.updateTask.taskId,
    title: response.updateTask.title,
    description: response.updateTask.description,
    status: response.updateTask.status,
    priority_order: response.updateTask.priorityOrder,  
    start_date: response.updateTask.startDate,
    due_date: response.updateTask.dueDate,
    updated_at: response.updateTask.updatedAt
  };
};

interface GetTasksResponse {
  tasks: Task[];
}

export const getTasks = async (projectId: string): Promise<Task[]> => {
  const response = await graphqlRequest<GetTasksResponse>(`
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
  `, { projectId });

  return response.tasks || [];
};

export const getTasksByStatus = async (projectId: string, status: string): Promise<Task[]> => {
  const tasks = await getTasks(projectId);
  return tasks.filter(task => task.status === status);
};