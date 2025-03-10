export type TaskStatus = 'todo' | 'doing' | 'done' | 'close' | 'pending' | 'review' | 'blocked' | 'rejected' | 'archived';
export type Priority = 'low' | 'medium' | 'high' | 'urgent' | 'critical';
export type ProgressType = 'study' | 'investigate' | 'code' | 'test' | 'review_code' | 'review_test_report' | 'release';
export type TaskType = 'Feature' | 'Bug' | 'Enhancement' | 'Documentation';
export type TaskCategory = 'Frontend' | 'Backend' | 'Design' | 'Testing' | 'DevOps';
export type TaskTag = 'Urgent' | 'High Priority' | 'Low Priority' | 'In Progress' | 'Blocked';

export const TaskStatuses = {
  TODO: 'todo' as TaskStatus,
  DOING: 'doing' as TaskStatus,
  DONE: 'done' as TaskStatus,
  CLOSE: 'close' as TaskStatus,
  PENDING: 'pending' as TaskStatus,
  REVIEW: 'review' as TaskStatus,
  BLOCKED: 'blocked' as TaskStatus,
  REJECTED: 'rejected' as TaskStatus,
  ARCHIVED: 'archived' as TaskStatus
};

export const Priorities = {
  LOW: 'low' as Priority,
  MEDIUM: 'medium' as Priority,
  HIGH: 'high' as Priority,
  URGENT: 'urgent' as Priority,
  CRITICAL: 'critical' as Priority
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

export interface TaskAssignee {
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
  assignee_id?: string;
  assignee?: TaskAssignee;
  priority_order: number;
  
  // Dates
  start_date?: string;
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
  
  // Additional info
  created_by: string;
  is_deleted?: boolean;
  tags?: TaskTag[];
  child_tasks?: Task[];
}

export interface TaskFilter {
  searchQuery?: string;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
  startDate?: string;
  endDate?: string;
  projectId?: string;
  category?: TaskCategory;
  type?: TaskType;
  progressType?: ProgressType;
}
