export enum TaskStatus {
  BACKLOG = 'BACKLOG',
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE'
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  assignees: User[];
  deadline?: string;
  effortHours?: number;
  priorityOrder: number;
  projectId: string;
  startDate?: string;
  tags?: string[];
  category?: string;
  type?: string;
  createdAt: string;
  updatedAt: string;
  parentTaskId?: string;
  childTasks?: Task[];
}

export interface TaskFilter {
  searchQuery?: string;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
  startDate?: string;
  endDate?: string;
}

export type TaskType = 'Feature' | 'Bug' | 'Enhancement' | 'Documentation';
export type TaskCategory = 'Frontend' | 'Backend' | 'Design' | 'Testing' | 'DevOps';
export type TaskTag = 'Urgent' | 'High Priority' | 'Low Priority' | 'In Progress' | 'Blocked';

export const TASK_TYPES: TaskType[] = ['Feature', 'Bug', 'Enhancement', 'Documentation'];
export const TASK_CATEGORIES: TaskCategory[] = ['Frontend', 'Backend', 'Design', 'Testing', 'DevOps'];
export const TASK_TAGS: TaskTag[] = ['Urgent', 'High Priority', 'Low Priority', 'In Progress', 'Blocked'];
