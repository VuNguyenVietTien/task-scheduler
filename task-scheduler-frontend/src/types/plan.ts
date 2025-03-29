import { Priority } from './task';

export interface Plan {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  plan_data: PlanData;
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
}

export interface PlanMetadata {
  last_sorted_date?: string;
  sort_criteria?: string;
}

export interface CreatePlanInput {
  project_id: string;
  name: string;
  description?: string;
  plan_data: CreatePlanDataInput;
}

export interface UpdatePlanInput {
  id: string;
  name?: string;
  description?: string;
  is_active?: boolean;
  plan_data?: CreatePlanDataInput;
}

export interface CreatePlanDataInput {
  tasks: CreatePlanTaskDataInput[];
  metadata?: CreatePlanMetadataInput;
}

export interface CreatePlanTaskDataInput {
  task_id: string;
  priority_order: number;
  original_priority?: string;
  start_date?: string;
  end_date?: string;
}

export interface CreatePlanMetadataInput {
  last_sorted_date?: string;
  sort_criteria?: string;
} 