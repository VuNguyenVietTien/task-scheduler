import { Priority } from './task';

export interface Plan {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  planData: PlanData;
}

export interface PlanData {
  tasks: PlanTaskData[];
  metadata?: PlanMetadata;
}

export interface PlanTaskData {
  task_id: string;
  priority_order: number;
  original_priority?: Priority;
  start_date?: string;
  end_date?: string;
  title?: string;
  effort?: number;
  assignee_id?: string;
  assignee_name?: string;
  priority?: Priority;
  status?: string;
}

export interface PlanMetadata {
  lastSortedDate?: string;
  sortCriteria?: string;
}

export interface CreatePlanInput {
  projectId: string;
  name: string;
  description?: string;
  planData: CreatePlanDataInput;
}

export interface UpdatePlanInput {
  id: string;
  name?: string;
  description?: string;
  isActive?: boolean;
  planData?: CreatePlanDataInput;
}

export interface CreatePlanDataInput {
  tasks: CreatePlanTaskDataInput[];
}

export interface CreatePlanTaskDataInput {
  task_id: string;
  priority_order: number;
  start_date?: string;
  end_date?: string;
  title?: string;
  effort?: number;
  assignee_id?: string;
  assignee_name?: string;
  priority?: Priority;
  status?: string;
}

export interface CreatePlanMetadataInput {
  lastSortedDate?: string;
  sortCriteria?: string;
} 