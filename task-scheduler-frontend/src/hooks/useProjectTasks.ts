import { useQuery } from '@apollo/client';
import { 
  Task, 
  TaskStatus, 
  Priority, 
  TaskType, 
  TaskCategory, 
  ProgressType, 
  TaskTag, 
  TaskAssignee,
  TaskStatuses,
  Priorities 
} from '@/types/task';
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

const validateTaskStatus = (status: string): TaskStatus => {
  const normalizedStatus = status.toLowerCase() as TaskStatus;
  return Object.values(TaskStatuses).includes(normalizedStatus) 
    ? normalizedStatus 
    : TaskStatuses.TODO;
};

const validatePriority = (priority: string): Priority => {
  const normalizedPriority = priority.toLowerCase() as Priority;
  return Object.values(Priorities).includes(normalizedPriority)
    ? normalizedPriority
    : Priorities.LOW;
};

const validateTaskType = (type: string): TaskType | undefined => {
  const normalizedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  return ['Feature', 'Bug', 'Enhancement', 'Documentation'].includes(normalizedType)
    ? normalizedType as TaskType
    : undefined;
};

const validateTaskCategory = (category: string): TaskCategory | undefined => {
  const normalizedCategory = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  return ['Frontend', 'Backend', 'Design', 'Testing', 'DevOps'].includes(normalizedCategory)
    ? normalizedCategory as TaskCategory
    : undefined;
};

const validateProgressType = (progressType: string): ProgressType | undefined => {
  const normalizedType = progressType.toLowerCase().replace(' ', '_') as ProgressType;
  return ['study', 'investigate', 'code', 'test', 'review_code', 'review_test_report', 'release'].includes(normalizedType)
    ? normalizedType
    : undefined;
};

const validateTaskTags = (tags: string[]): TaskTag[] => {
  return tags.filter(tag => {
    const normalizedTag = tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase().replace('_', ' ');
    return ['Urgent', 'High Priority', 'Low Priority', 'In Progress', 'Blocked'].includes(normalizedTag);
  }) as TaskTag[];
};

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
    status: validateTaskStatus(graphqlTask.status),
    priority: validatePriority(graphqlTask.priority),
    type: graphqlTask.type ? validateTaskType(graphqlTask.type) : undefined,
    category: graphqlTask.category ? validateTaskCategory(graphqlTask.category) : undefined,
    progress_type: graphqlTask.progressType ? validateProgressType(graphqlTask.progressType) : undefined,
    tags: graphqlTask.tags ? validateTaskTags(graphqlTask.tags) : undefined,
    child_tasks: graphqlTask.childTasks 
      ? graphqlTask.childTasks.map(transformGraphQLTask)
      : undefined
  };
};

export function useProjectTasks(projectId: string) {
  const { data, loading, error, refetch } = useQuery(GET_PROJECT_TASKS, {
    variables: { projectId },
    skip: !projectId,
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first'
  });

  const tasks = data?.tasks
    ? data.tasks.map((task: GraphQLTask) => transformGraphQLTask(task))
    : [];

  return { data: tasks, loading, error, refetch };
}
