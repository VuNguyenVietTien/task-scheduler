import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { client } from '@/lib/apollo-client';
import { 
  TASK_TREE_ROWS,
  GET_PROJECT_TASKS_PAGINATED 
} from '@/graphql/queries/tasks';
import {
  DELETE_TASK,
  UPDATE_TASK,
  UPDATE_TASK_STATUS,
  UPDATE_TASK_EFFORT
} from '@/graphql/mutations/tasks';
import { 
  Task, 
  TaskStatus, 
  Priority, 
  TaskFilter,
  PaginationData
} from '@/types/task';
import { gql } from '@apollo/client';
import { buildGanttTaskRows } from '@/utils/ganttRows';

interface TasksState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  pagination: PaginationData;
  filters: TaskFilter;
  projectId?: string;
  requestId?: string;
}

const initialState: TasksState = {
  tasks: [],
  loading: false,
  error: null,
  pagination: {
    totalItems: 0,
    totalPages: 0,
    currentPage: 1,
    pageSize: 20
  },
  filters: {}
};

// Thêm query để lấy thông tin tối thiểu của task
export const GET_TASK_MINIMAL = gql`
  query GetTaskMinimal($taskId: ID!) {
    task(task_id: $taskId) {
      task_id
      parent_task_id
    }
  }
`;

// Async thunk để fetch tasks
export const fetchProjectTasks = createAsyncThunk(
  'tasks/fetchProjectTasks',
  async (projectId: string, { getState, rejectWithValue }) => {
    try {
      const response = await client.query({
        query: TASK_TREE_ROWS,
        variables: { projectId },
        fetchPolicy: 'network-only'
      });
      
      if (response.errors) {
        return rejectWithValue(response.errors[0].message);
      }
      
      // The legacy tasks field returns roots; selecting one child level loses
      // deeper descendants. Read all rows once, then preserve the public forest.
      if (!Array.isArray(response.data?.task_tree_rows)) throw new Error('Task tree response is missing');
      const roots: any[] = [];
      const ancestors: any[] = [];
      for (const row of buildGanttTaskRows(response.data.task_tree_rows as Task[])) {
        const task = { ...row.task, child_tasks: [] };
        ancestors.length = row.depth;
        if (row.depth) ancestors[row.depth - 1].child_tasks.push(task);
        else roots.push(task);
        ancestors.push(task);
      }
      return roots;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi tải danh sách công việc');
    }
  }
);

export interface DeleteTaskResult {
  projectId: string;
  deletedTaskIds: string[];
}

async function requestTaskDeletion(taskId: string): Promise<DeleteTaskResult> {
  const response = await client.mutate({
    mutation: DELETE_TASK,
    variables: { taskId },
    errorPolicy: 'all',
    fetchPolicy: 'no-cache',
  });
  if (response.errors?.length) throw new Error(response.errors[0].message);
  const payload = response.data?.delete_task;
  if (!payload?.project_id || !Array.isArray(payload.deleted_task_ids) || !payload.deleted_task_ids.includes(taskId)) {
    throw new Error('Task deletion returned no matching task result.');
  }
  return { projectId: payload.project_id, deletedTaskIds: payload.deleted_task_ids };
}

export const deleteTask = createAsyncThunk(
  'tasks/deleteTask',
  async ({ taskId }: { taskId: string }, { rejectWithValue }) => {
    try {
      return await requestTaskDeletion(taskId);
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Could not delete task.');
    }
  }
);

export const updateTaskStatus = createAsyncThunk(
  'tasks/updateTaskStatus',
  async ({ taskId, status }: { taskId: string, status: TaskStatus }, { rejectWithValue }) => {
    try {
      const response = await client.mutate({
        mutation: UPDATE_TASK,
        variables: { input: { task_id: taskId, status } },
        errorPolicy: 'all',
        fetchPolicy: 'no-cache',
      });
      if (response.errors?.length) return rejectWithValue(response.errors[0].message);
      const returnedTask = response.data?.update_task;
      if (!returnedTask || returnedTask.task_id !== taskId) {
        return rejectWithValue('Task update returned no matching task result.');
      }
      return { taskId, status, task: transformTaskFromAPI(returnedTask) };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi cập nhật trạng thái');
    }
  }
);

// Async thunk để update task assignee
export const updateTaskAssignee = createAsyncThunk(
  'tasks/updateTaskAssignee',
  async ({ taskId, assigneeId }: { taskId: string, assigneeId: string | null }, { getState, rejectWithValue }) => {
    try {
      const input = {
        task_id: taskId,
        assignee_id: assigneeId
      };

      const response = await client.mutate({
        mutation: UPDATE_TASK,
        variables: { input },
        errorPolicy: 'all',
        fetchPolicy: 'no-cache' // Đảm bảo không sử dụng cache
      });

      if (response.errors) {
        console.error('Lỗi GraphQL:', response.errors);
        return rejectWithValue(response.errors[0].message);
      }

      const returnedTask = response.data?.update_task;
      if (!returnedTask || returnedTask.task_id !== taskId) {
        return rejectWithValue('Task update returned no matching task result.');
      }

      return { taskId, assigneeId, assignee: returnedTask.assignee, task: transformTaskFromAPI(returnedTask) };
    } catch (error) {
      console.error('Lỗi khi gọi API cập nhật người được giao:', error);
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi cập nhật người được giao');
    }
  }
);

// Async thunk để update task priority
export const updateTaskPriority = createAsyncThunk(
  'tasks/updateTaskPriority',
  async ({ taskId, priority }: { taskId: string, priority: Priority }, { getState, rejectWithValue }) => {
    try {
      const input = {
        task_id: taskId,
        priority: priority
      };

      // Cập nhật cách gọi API
      const response = await client.mutate({
        mutation: UPDATE_TASK,
        variables: { input },
        errorPolicy: 'all',
        fetchPolicy: 'no-cache' // Đảm bảo không sử dụng cache
      });

      if (response.errors) {
        console.error('Lỗi GraphQL:', response.errors);
        return rejectWithValue(response.errors[0].message);
      }

      const returnedTask = response.data?.update_task;
      if (!returnedTask || returnedTask.task_id !== taskId) {
        return rejectWithValue('Task update returned no matching task result.');
      }

      return { taskId, priority, task: transformTaskFromAPI(returnedTask) };
    } catch (error) {
      console.error('Lỗi khi gọi API cập nhật ưu tiên:', error);
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi cập nhật ưu tiên');
    }
  }
);

// Async thunk để update task effort
export const updateTaskEffort = createAsyncThunk(
  'tasks/updateTaskEffort',
  async ({ taskId, effort }: { taskId: string, effort: number }, { getState, rejectWithValue }) => {
    try {
      const input = {
        task_id: taskId,
        effort: Number(effort)
      };

      // Cập nhật cách gọi API
      const response = await client.mutate({
        mutation: UPDATE_TASK,
        variables: { input },
        errorPolicy: 'all',
        fetchPolicy: 'no-cache' // Đảm bảo không sử dụng cache
      });

      if (response.errors) {
        console.error('Lỗi GraphQL:', response.errors);
        return rejectWithValue(response.errors[0].message);
      }

      const returnedTask = response.data?.update_task;
      if (!returnedTask || returnedTask.task_id !== taskId) {
        return rejectWithValue('Task update returned no matching task result.');
      }

      return { taskId, effort, task: transformTaskFromAPI(returnedTask) };
    } catch (error) {
      console.error('Lỗi khi gọi API cập nhật công sức:', error);
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi cập nhật công sức');
    }
  }
);

// Async thunk để update task due date
export const updateTaskDueDate = createAsyncThunk(
  'tasks/updateTaskDueDate',
  async ({ taskId, dueDate }: { taskId: string, dueDate: string }, { getState, rejectWithValue }) => {
    try {
      const formattedDueDate = dueDate ? new Date(dueDate).toISOString() : null;
      const input = {
        task_id: taskId,
        due_date: formattedDueDate
      };

      // Cập nhật cách gọi API
      const response = await client.mutate({
        mutation: UPDATE_TASK,
        variables: { input },
        errorPolicy: 'all',
        fetchPolicy: 'no-cache' // Đảm bảo không sử dụng cache
      });

      if (response.errors) {
        console.error('Lỗi GraphQL:', response.errors);
        return rejectWithValue(response.errors[0].message);
      }

      const returnedTask = response.data?.update_task;
      if (!returnedTask || returnedTask.task_id !== taskId) {
        return rejectWithValue('Task update returned no matching task result.');
      }

      return { taskId, dueDate: formattedDueDate || undefined, task: transformTaskFromAPI(returnedTask) };
    } catch (error) {
      console.error('Lỗi khi gọi API cập nhật hạn:', error);
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi cập nhật hạn');
    }
  }
);

const catalogIdFromAPI = (apiTask: any, snakeCase: string, camelCase: string): string | null | undefined => {
  if (Object.prototype.hasOwnProperty.call(apiTask, snakeCase)) return apiTask[snakeCase];
  if (Object.prototype.hasOwnProperty.call(apiTask, camelCase)) return apiTask[camelCase];
  return undefined;
};

// Hàm tiện ích để chuyển đổi task từ snake_case (API) sang dạng dùng trong UI
export const transformTaskFromAPI = (apiTask: any): Partial<Task> => {
  if (!apiTask) return {};
  const has = (key: string) => Object.prototype.hasOwnProperty.call(apiTask, key);
  const transformed: Record<string, unknown> = {
    task_id: apiTask.task_id,
    id: apiTask.task_id,
    project_id: apiTask.project_id,
    projectId: apiTask.project_id,
    parent_task_id: apiTask.parent_task_id,
    title: apiTask.title,
    description: apiTask.description,
    assignee_resource_member_id: apiTask.assignee_resource_member_id,
    assignee: apiTask.assignee ? {
      userId: apiTask.assignee.user_id,
      username: apiTask.assignee.full_name || apiTask.assignee.username,
      avatarUrl: apiTask.assignee.avatar_url || "",
      role: apiTask.assignee.role || ""
    } : undefined,
    priority_order: apiTask.priority_order,
    start_date: apiTask.start_date,
    due_date: apiTask.due_date,
    actual_start_date: apiTask.actual_start_date,
    actual_end_date: apiTask.actual_end_date,
    effort: apiTask.effort,
    progress: apiTask.progress,
    created_by: apiTask.created_by,
    created_at: apiTask.created_at,
    updated_at: apiTask.updated_at,
    is_deleted: apiTask.is_deleted,
    status: apiTask.status as TaskStatus,
    priority: apiTask.priority as Priority,
    // GraphQL exposes DB column 'type' as 'type_' to avoid keyword conflict
    type: has('type_') ? apiTask.type_ : apiTask.type,
    category: apiTask.category,
    progress_type: apiTask.progress_type,
    progressCatalogItemId: catalogIdFromAPI(apiTask, 'progress_catalog_item_id', 'progressCatalogItemId'),
    categoryCatalogItemId: catalogIdFromAPI(apiTask, 'category_catalog_item_id', 'categoryCatalogItemId'),
    taskTypeCatalogItemId: catalogIdFromAPI(apiTask, 'task_type_catalog_item_id', 'taskTypeCatalogItemId'),
    // Missing fields are omitted; explicit null still clears normalized state.
    tags: has('tags')
      ? (Array.isArray(apiTask.tags) ? apiTask.tags.filter((t: unknown): t is string => typeof t === 'string') : [])
      : undefined,
    // Mutation resolvers return null when the relationship was not loaded.
    // Only an actual array is authoritative; [] still clears known children.
    child_tasks: Array.isArray(apiTask.child_tasks)
      ? apiTask.child_tasks.map(transformTaskFromAPI)
      : undefined
  };

  return Object.fromEntries(Object.entries(transformed).filter(([key, value]) =>
    value !== undefined || (key === 'assignee' && has('assignee'))
  )) as Partial<Task>;
};

function findTaskInTree(tasks: readonly Task[], taskId: string): Task | undefined {
  for (const task of tasks) {
    if (task.task_id === taskId || task.id === taskId) return task;
    const found = task.child_tasks && findTaskInTree(task.child_tasks, taskId);
    if (found) return found;
  }
  return undefined;
}

/** Replace a known task in-place without flattening, reordering, or duplicating its tree. */
export function removeTasksFromTree(tasks: Task[], deletedTaskIds: readonly string[]): Task[] {
  const deleted = new Set(deletedTaskIds);
  return tasks.flatMap((task) => {
    if (deleted.has(task.task_id) || (task.id && deleted.has(task.id))) return [];
    if (!task.child_tasks?.length) return [task];
    return [{ ...task, child_tasks: removeTasksFromTree(task.child_tasks, deletedTaskIds) }];
  });
}

export function upsertTaskInTree(tasks: Task[], incoming: Task): Task[] {
  const merge = (current: Task, next: Task): Task => {
    const childTasks = next.child_tasks === undefined
      ? current.child_tasks
      : next.child_tasks.map((child) => {
        const previous = findTaskInTree(current.child_tasks ?? [], child.task_id);
        return previous ? merge(previous, child) : child;
      });
    const definedNext = Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined));
    if ('assignee' in next) definedNext.assignee = next.assignee;
    return { ...current, ...definedNext, child_tasks: childTasks };
  };
  let replaced = false;
  const replace = (nodes: Task[]): Task[] => nodes.map((task) => {
    if (task.task_id === incoming.task_id || task.id === incoming.task_id) {
      replaced = true;
      return merge(task, incoming);
    }
    if (!task.child_tasks?.length) return task;
    const childTasks = replace(task.child_tasks);
    return childTasks === task.child_tasks ? task : { ...task, child_tasks: childTasks };
  });
  const next = replace(tasks);
  return replaced ? next : [...next, incoming];
}

const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    setFilter: (state, action: PayloadAction<TaskFilter>) => {
      state.filters = action.payload;
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.pagination.currentPage = action.payload;
    },
    setPageSize: (state, action: PayloadAction<number>) => {
      state.pagination.pageSize = action.payload;
      state.pagination.currentPage = 1; // Reset trang về 1 khi thay đổi pageSize
    },
    resetTasks: (state) => {
      state.tasks = [];
      state.projectId = undefined;
      state.requestId = undefined;
      state.loading = false;
      state.pagination = initialState.pagination;
      state.filters = {};
    },
    upsertTask: (state, action: PayloadAction<Task>) => {
      state.tasks = upsertTaskInTree(state.tasks as Task[], action.payload) as any;
    },
    // Sync a task in the canonical tree. List and Excel can edit descendants,
    // so a root-only lookup would be overwritten by the next prop refresh.
    updateTaskLocally: (state, action: PayloadAction<{ taskId: string; updates: Partial<Task> }>) => {
      const { taskId, updates } = action.payload;
      const updateTree = (tasks: Task[]): boolean => {
        for (const task of tasks) {
          if (task.task_id === taskId || task.id === taskId) {
            Object.assign(task, updates);
            return true;
          }
          if (task.child_tasks && updateTree(task.child_tasks)) return true;
        }
        return false;
      };
      updateTree(state.tasks);
    }
  },
  extraReducers: (builder) => {
    // fetchProjectTasks
    builder.addCase(fetchProjectTasks.pending, (state, action) => {
      if (state.projectId !== action.meta.arg) state.tasks = [];
      state.projectId = action.meta.arg;
      state.requestId = action.meta.requestId;
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchProjectTasks.fulfilled, (state, action) => {
      if (action.meta && state.requestId !== action.meta.requestId) return;
      state.projectId = action.meta?.arg ?? action.payload[0]?.project_id;
      state.requestId = undefined;
      state.loading = false;
      
      // Log dữ liệu để debug
      console.log('TASKS API RESPONSE:', {
        count: action.payload.length,
        sample: action.payload[0]
      });
      
      // Chuyển đổi từ camelCase sang snake_case trước khi lưu vào state
      state.tasks = action.payload.map((task: any) => transformTaskFromAPI(task) as Task);
      console.log('TASKS STATE:', state.tasks);
      // Tính toán pagination dựa trên tổng số tasks
      state.pagination.totalItems = action.payload.length;
      state.pagination.totalPages = Math.ceil(action.payload.length / state.pagination.pageSize);
    });
    builder.addCase(fetchProjectTasks.rejected, (state, action) => {
      if (action.meta && state.requestId !== action.meta.requestId) return;
      state.requestId = undefined;
      state.loading = false;
      state.error = action.payload as string;
    });
    
    // A mutation result replaces its matching node at any depth. Never publish
    // status-only / locally guessed patches as a confirmed server update.
    const applyReturnedTask = (state: TasksState, task?: Partial<Task>) => {
      if (task?.task_id) state.tasks = upsertTaskInTree(state.tasks, task as Task);
    };
    const applyDeletedTasks = (state: TasksState, result?: DeleteTaskResult) => {
      if (result?.deletedTaskIds.length) state.tasks = removeTasksFromTree(state.tasks, result.deletedTaskIds);
    };
    builder.addCase(deleteTask.fulfilled, (state, action) => applyDeletedTasks(state, action.payload));
    builder.addCase(updateTaskStatus.fulfilled, (state, action) => applyReturnedTask(state, action.payload.task));
    builder.addCase(updateTaskAssignee.fulfilled, (state, action) => applyReturnedTask(state, action.payload.task));
    builder.addCase(updateTaskPriority.fulfilled, (state, action) => applyReturnedTask(state, action.payload.task));
    builder.addCase(updateTaskEffort.fulfilled, (state, action) => applyReturnedTask(state, action.payload.task));
    builder.addCase(updateTaskDueDate.fulfilled, (state, action) => applyReturnedTask(state, action.payload.task));
  }
});

export const { setFilter, setPage, setPageSize, resetTasks, upsertTask, updateTaskLocally } = tasksSlice.actions;
export default tasksSlice.reducer; 