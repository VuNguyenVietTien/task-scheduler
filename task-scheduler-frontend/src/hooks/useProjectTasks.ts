import { useQuery } from '@apollo/client';
import { Task, TaskAssignee } from '@/types/task';
import { GET_PROJECT_TASKS } from '@/graphql/queries/tasks';

interface GraphQLTaskAssignee {
  userId: string;
  username: string;
  avatarUrl?: string;
  role?: string;
}

interface GraphQLTask {
  taskId: string;
  projectId: string;
  parentTaskId?: string;
  title: string;
  description?: string;
  assignee?: GraphQLTaskAssignee;
  priorityOrder: number;
  startDate?: string;
  dueDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  effort?: number;
  progress?: number;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
  isDeleted?: boolean;
  status: string;
  priority: string;
  type?: string;
  category?: string;
  tags?: string[];
  progressType?: string;
  childTasks?: GraphQLTask[];
}

const transformAssignee = (assignee: GraphQLTaskAssignee | undefined): TaskAssignee | undefined => {
  if (!assignee) return undefined;
  
  return {
    userId: assignee.userId,
    username: assignee.username,
    avatarUrl: assignee.avatarUrl,
    role: assignee.role
  };
};

const transformGraphQLTask = (graphqlTask: GraphQLTask): Task => {
  return {
    task_id: graphqlTask.taskId,
    project_id: graphqlTask.projectId,
    parent_task_id: graphqlTask.parentTaskId,
    title: graphqlTask.title,
    description: graphqlTask.description,
    assignee_id: graphqlTask.assignee?.userId,
    assignee: transformAssignee(graphqlTask.assignee),
    priority_order: graphqlTask.priorityOrder,
    start_date: graphqlTask.startDate,
    due_date: graphqlTask.dueDate,
    actual_start_date: graphqlTask.actualStartDate,
    actual_end_date: graphqlTask.actualEndDate,
    effort: graphqlTask.effort,
    progress: graphqlTask.progress,
    created_by: graphqlTask.createdBy,
    created_at: graphqlTask.createdAt,
    updated_at: graphqlTask.updatedAt,
    is_deleted: graphqlTask.isDeleted,
    status: graphqlTask.status as Task['status'],
    priority: graphqlTask.priority as Task['priority'],
    type: graphqlTask.type as Task['type'],
    category: graphqlTask.category as Task['category'],
    progress_type: graphqlTask.progressType as Task['progress_type'],
    tags: graphqlTask.tags as Task['tags'],
    child_tasks: graphqlTask.childTasks 
      ? graphqlTask.childTasks.map(transformGraphQLTask)
      : undefined
  };
};

/**
 * Hook để lấy tasks của một project và map dữ liệu sang định dạng Task
 */
export function useProjectTasks(projectId: string) {
  const { loading, error, data } = useQuery(GET_PROJECT_TASKS, {
    variables: { projectId },
    fetchPolicy: 'network-only'
  });

  // Transform GraphQL response to match Task interface
  const tasks = data?.tasks?.map((task: GraphQLTask) => transformGraphQLTask(task)) || [];

  return { loading, error, data: tasks };
}
