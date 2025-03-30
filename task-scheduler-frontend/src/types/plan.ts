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
  taskId: string;
  priorityOrder: number;
  originalPriority?: Priority;
  startDate?: string;
  endDate?: string;
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
  metadata?: CreatePlanMetadataInput;
}

export interface CreatePlanTaskDataInput {
  taskId: string;
  priorityOrder: number;
  originalPriority?: string;
  startDate?: string;
  endDate?: string;
}

export interface CreatePlanMetadataInput {
  lastSortedDate?: string;
  sortCriteria?: string;
} 