export type TaskStatus = 'BACKLOG' | 'PLANNED' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export const TaskStatuses = {
  BACKLOG: 'BACKLOG' as TaskStatus,
  PLANNED: 'PLANNED' as TaskStatus,
  IN_PROGRESS: 'IN_PROGRESS' as TaskStatus,
  IN_REVIEW: 'IN_REVIEW' as TaskStatus,
  DONE: 'DONE' as TaskStatus
};

export const Priorities = {
  LOW: 'LOW' as Priority,
  MEDIUM: 'MEDIUM' as Priority,
  HIGH: 'HIGH' as Priority,
  URGENT: 'URGENT' as Priority
};

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
  projectId?: string;
}

export type TaskType = 'Feature' | 'Bug' | 'Enhancement' | 'Documentation';
export type TaskCategory = 'Frontend' | 'Backend' | 'Design' | 'Testing' | 'DevOps';
export type TaskTag = 'Urgent' | 'High Priority' | 'Low Priority' | 'In Progress' | 'Blocked';

export const TASK_TYPES: TaskType[] = ['Feature', 'Bug', 'Enhancement', 'Documentation'];
export const TASK_CATEGORIES: TaskCategory[] = ['Frontend', 'Backend', 'Design', 'Testing', 'DevOps'];
export const TASK_TAGS: TaskTag[] = ['Urgent', 'High Priority', 'Low Priority', 'In Progress', 'Blocked'];
