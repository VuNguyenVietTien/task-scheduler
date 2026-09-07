export type TaskStatus = 'TODO' | 'DOING' | 'DONE' | 'CLOSE' | 'PENDING' | 'REVIEW' | 'BLOCKED' | 'REJECTED' | 'ARCHIVED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL';
export type ProgressType = 'study' | 'investigate' | 'code' | 'test' | 'review_code' | 'review_test_report' | 'release';
export type TaskType = 'Feature' | 'Bug' | 'Enhancement' | 'Documentation';
export type TaskCategory = 'Frontend' | 'Backend' | 'Design' | 'Testing' | 'DevOps';
export type TaskTag = 'Urgent' | 'High Priority' | 'Low Priority' | 'In Progress' | 'Blocked';

export const TaskStatuses = {
  TODO: 'TODO' as TaskStatus,
  DOING: 'DOING' as TaskStatus,
  DONE: 'DONE' as TaskStatus,
  CLOSE: 'CLOSE' as TaskStatus,
  PENDING: 'PENDING' as TaskStatus,
  REVIEW: 'REVIEW' as TaskStatus,
  BLOCKED: 'BLOCKED' as TaskStatus,
  REJECTED: 'REJECTED' as TaskStatus,
  ARCHIVED: 'ARCHIVED' as TaskStatus
};

export const Priorities = {
  LOW: 'LOW' as Priority,
  MEDIUM: 'MEDIUM' as Priority,
  HIGH: 'HIGH' as Priority,
  URGENT: 'URGENT' as Priority,
  CRITICAL: 'CRITICAL' as Priority
};

export const ProgressTypes = {
  STUDY: 'study' as ProgressType,
  INVESTIGATE: 'investigate' as ProgressType,
  CODE: 'code' as ProgressType,
  TEST: 'test' as ProgressType,
  REVIEW_CODE: 'review_code' as ProgressType,
  REVIEW_TEST_REPORT: 'review_test_report' as ProgressType,
  RELEASE: 'release' as ProgressType
};

// Constant arrays for form selects
export const TASK_TYPES: TaskType[] = ['Feature', 'Bug', 'Enhancement', 'Documentation'];
export const TASK_CATEGORIES: TaskCategory[] = ['Frontend', 'Backend', 'Design', 'Testing', 'DevOps'];
export const TASK_TAGS: TaskTag[] = ['Urgent', 'High Priority', 'Low Priority', 'In Progress', 'Blocked'];

export interface UserBasic {
  userId: string;
  username: string;
  avatarUrl?: string;
  role?: string;
}

export interface Task {
  // ID fields
  task_id: string;
  id?: string; // Alias for task_id for backward compatibility
  project_id: string;
  projectId?: string; // Alias for project_id for backward compatibility
  parent_task_id?: string;

  // Basic info
  title: string;
  description?: string;
  assignee?: UserBasic;
  /** Assignment target for a project member who has not linked a user yet. */
  assignee_resource_member_id?: string | null;
  priority_order: number;

  // Dates
  start_date?: string;
  original_start_date?: string;
  db_start_date?: string;
  force_recalculate?: boolean;
  due_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  created_at?: string;
  updated_at?: string;

  // Progress tracking
  effort?: number;
  progress?: number;

  // Status and categorization
  status: TaskStatus;
  priority: Priority;
  type?: TaskType;
  category?: TaskCategory;
  progress_type?: ProgressType;
  progressCatalogItemId?: string | null;
  categoryCatalogItemId?: string | null;
  taskTypeCatalogItemId?: string | null;
  /** Increment 1 scheduling taxonomy: assigned project phase (null/undefined = Unphased). */
  phase_id?: string | null;

  // Additional info
  created_by: string | UserBasic;
  is_deleted?: boolean;
  tags?: string[];
  child_tasks?: Task[];
  attachments?: any[];
  comments?: any[];
  checklist?: any[];
  custom_fields?: Record<string, any>;
  deadline?: string;
}

export interface TaskFilter {
  searchQuery?: string;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
  projectId?: string;
  startDate?: string;
  endDate?: string;
  /** Increment 1: 'UNPHASED' keeps tasks without a phase; otherwise a phase id. */
  phaseId?: string;
}

export interface GanttFilter {
  searchQuery?: string;
  status?: TaskStatus;
  priority?: Priority;
  type?: TaskType;
  tags?: string[];
}

export interface TaskFiltersInput {
  searchQuery?: string;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
  projectId?: string;
  startDate?: string;
  endDate?: string;
  tags?: string[];
}

export interface PaginationData {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface TasksPaginatedResponse {
  tasks: Task[];
  pagination: PaginationData;
}

export interface ProjectTasksResponse {
  projectTasks: Task[];
}

export interface TaskComment {
  id: string;
  content: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  created_at: string;
  updated_at?: string;
  status?: 'pending' | 'failed' | 'saved' | 'local';
  task_id?: string;
}
