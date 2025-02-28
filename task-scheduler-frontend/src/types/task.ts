export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  deadline: string;
  assignee?: string;
  description?: string;
  startDate?: string;
  effortHours?: number;
  priorityOrder: number;
  projectId: string;
  assignees: User[];
  createdBy: User;
  createdAt: string;
  updatedAt?: string;
  parentTaskId?: string;
  childTasks?: Task[];
}

export enum TaskStatus {
  BACKLOG = 'backlog',
  PLANNED = 'planned',
  IN_PROGRESS = 'in-progress',
  IN_REVIEW = 'in-review',
  DONE = 'done',
  CANCELLED = 'cancelled'
}

export type Priority = 'high' | 'medium' | 'low';

export const TaskStatuses = {
  BACKLOG: TaskStatus.BACKLOG,
  PLANNED: TaskStatus.PLANNED,
  IN_PROGRESS: TaskStatus.IN_PROGRESS,
  IN_REVIEW: TaskStatus.IN_REVIEW,
  DONE: TaskStatus.DONE,
  CANCELLED: TaskStatus.CANCELLED
};

export const Priorities = {
  HIGH: 'high' as const,
  MEDIUM: 'medium' as const,
  LOW: 'low' as const
};

export interface TaskUpdate extends Partial<Task> {
  id: string;
}

export interface TaskMetadata {
  totalCount: number;
  completedCount: number;
  overdueCount: number;
  byPriority: {
    [K in Priority]: number;
  };
  byStatus: {
    [K in TaskStatus]: number;
  };
}

export const TASK_CATEGORIES = [
  'Development',
  'Design',
  'Testing',
  'Documentation',
  'Planning',
  'Research',
  'Maintenance'
] as const;

export const TASK_TYPES = [
  'Feature',
  'Bug',
  'Enhancement',
  'Task',
  'Epic',
  'Story',
  'Subtask'
] as const;

export const TASK_TAGS = [
  'Frontend',
  'Backend',
  'UI/UX',
  'Database',
  'API',
  'Security',
  'Performance',
  'DevOps'
] as const;

export interface TaskFilter {
  searchQuery?: string;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
  projectId?: string;
  startDate?: string;
  endDate?: string;
}
