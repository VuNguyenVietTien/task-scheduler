import { useQuery } from '@apollo/client';
import { useState, useEffect } from 'react';
import {
  Task,
  TaskStatus,
  Priority,
  TaskType,
  TaskCategory,
  ProgressType,
  TaskTag,
  TaskStatuses,
  Priorities,
  TaskFilter,
  PaginationData
} from '@/types/task';
import { GET_PROJECT_TASKS, GET_PROJECT_TASKS_PAGINATED } from '@/graphql/queries/tasks';

interface GraphQLTaskAssignee {
  user_id: string;
  username: string;
  avatar_url?: string;
  role?: string;
}

interface GraphQLTask {
  task_id: string;
  project_id: string;
  parent_task_id?: string;
  title: string;
  description?: string;
  assignee?: GraphQLTaskAssignee;
  assignee_resource_member_id?: string | null;
  priority_order: number;
  start_date?: string;
  due_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  effort?: number;
  progress?: number;
  created_by: string;
  created_at?: string;
  updated_at?: string;
  is_deleted?: boolean;
  status: string;
  priority: string;
  type?: string;
  category?: string;
  tags?: string[];
  progress_type?: string;
  child_tasks?: GraphQLTask[];
}

const validateTaskStatus = (status: string): TaskStatus => {
  const normalizedStatus = status.toUpperCase() as TaskStatus;
  return Object.values(TaskStatuses).includes(normalizedStatus)
    ? normalizedStatus
    : TaskStatuses.TODO;
};

const validatePriority = (priority: string): Priority => {
  const normalizedPriority = priority.toUpperCase() as Priority;
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

const transformAssignee = (assignee: GraphQLTaskAssignee | undefined) => {
  if (!assignee) return undefined;

  return {
    userId: assignee.user_id,
    username: assignee.username,
    avatarUrl: assignee.avatar_url,
    role: assignee.role
  };
};

const transformGraphQLTask = (graphqlTask: GraphQLTask): Task => {
  return {
    task_id: graphqlTask.task_id,
    project_id: graphqlTask.project_id,
    parent_task_id: graphqlTask.parent_task_id,
    title: graphqlTask.title,
    description: graphqlTask.description,
    assignee: transformAssignee(graphqlTask.assignee) as any,
    assignee_resource_member_id: graphqlTask.assignee_resource_member_id,
    priority_order: graphqlTask.priority_order,
    start_date: graphqlTask.start_date,
    due_date: graphqlTask.due_date,
    actual_start_date: graphqlTask.actual_start_date,
    actual_end_date: graphqlTask.actual_end_date,
    effort: graphqlTask.effort,
    progress: graphqlTask.progress,
    created_by: graphqlTask.created_by,
    created_at: graphqlTask.created_at,
    updated_at: graphqlTask.updated_at,
    is_deleted: graphqlTask.is_deleted,
    status: validateTaskStatus(graphqlTask.status),
    priority: validatePriority(graphqlTask.priority),
    type: graphqlTask.type ? validateTaskType(graphqlTask.type) : undefined,
    category: graphqlTask.category ? validateTaskCategory(graphqlTask.category) : undefined,
    progress_type: graphqlTask.progress_type ? validateProgressType(graphqlTask.progress_type) : undefined,
    tags: graphqlTask.tags ? validateTaskTags(graphqlTask.tags) : undefined,
    child_tasks: graphqlTask.child_tasks
      ? graphqlTask.child_tasks.map(transformGraphQLTask)
      : undefined
  };
};

export function useProjectTasks(projectId: string) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<TaskFilter>({});
  
  // Kiểm tra nếu API pagination đã được triển khai ở backend
  const isPaginationApiReady = false; // TODO: Set to true when backend is ready
  
  const { data, loading, error, refetch } = useQuery(
    isPaginationApiReady ? GET_PROJECT_TASKS_PAGINATED : GET_PROJECT_TASKS, 
    {
      variables: isPaginationApiReady 
        ? { projectId, page, pageSize, filters }
        : { projectId },
      skip: !projectId,
      fetchPolicy: 'cache-and-network',
      nextFetchPolicy: 'cache-first'
    }
  );
  
  const handleFilterChange = (newFilters: TaskFilter) => {
    setFilters(newFilters);
    setPage(1); // Reset về trang đầu tiên khi thay đổi filter
  };
  
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };
  
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1); // Reset về trang đầu tiên khi thay đổi page size
  };
  
  // Xử lý dữ liệu từ API
  let tasks: Task[] = [];
  let paginationData: PaginationData = {
    totalItems: 0,
    totalPages: 0,
    currentPage: page,
    pageSize: pageSize
  };
  
  if (isPaginationApiReady && data?.tasksPaginated) {
    tasks = data.tasksPaginated.tasks.map((task: GraphQLTask) => transformGraphQLTask(task));
    paginationData = data.tasksPaginated.pagination;
  } else if (data?.tasks) {
    // Fallback to client-side pagination and filtering if API is not ready
    const allTasks = data.tasks.map((task: GraphQLTask) => transformGraphQLTask(task));
    
    // Apply filters client-side
    const filteredTasks = allTasks.filter((task: Task) => {
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        if (!task.title.toLowerCase().includes(query) &&
            !task.description?.toLowerCase().includes(query)) {
          return false;
        }
      }

      if (filters.status && task.status !== filters.status) {
        return false;
      }

      if (filters.priority && task.priority !== filters.priority) {
        return false;
      }

      if (filters.assigneeId && task.assignee?.userId !== filters.assigneeId) {
        return false;
      }

      if (filters.startDate && task.start_date && 
          new Date(task.start_date) < new Date(filters.startDate)) {
        return false;
      }

      if (filters.endDate && task.due_date && 
          new Date(task.due_date) > new Date(filters.endDate)) {
        return false;
      }

      if (filters.projectId && task.project_id !== filters.projectId) {
        return false;
      }

      return true;
    });
    
    // Apply client-side pagination
    const totalItems = filteredTasks.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    tasks = filteredTasks.slice(startIndex, endIndex);
    paginationData = {
      totalItems,
      totalPages,
      currentPage: page,
      pageSize
    };
  }

  return {
    data: tasks,
    pagination: paginationData,
    loading,
    error,
    refetch,
    setPage: handlePageChange,
    setPageSize: handlePageSizeChange,
    filters,
    setFilters: handleFilterChange
  };
}
