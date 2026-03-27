export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  visibility?: 'PUBLIC' | 'PRIVATE' | 'TEAM';
  tags?: string[];
  status?: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';
  category?: string;
  start_date?: string;
  end_date?: string;
  icon_url?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateTaskInput {
  project_id: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  effort?: number;
  due_date?: string;
  assignee_id?: string;
}

export interface UpdateTaskInput {
  task_id: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  priority_order?: number;
  start_date?: string;
  due_date?: string;
  parent_task_id?: string;
}
