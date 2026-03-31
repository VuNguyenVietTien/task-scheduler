import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { client } from '@/lib/apollo-client';
import { 
  GET_PROJECT_TASKS,
  GET_PROJECT_TASKS_PAGINATED 
} from '@/graphql/queries/tasks';
import {
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

interface TasksState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  pagination: PaginationData;
  filters: TaskFilter;
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
        query: GET_PROJECT_TASKS,
        variables: { projectId },
        fetchPolicy: 'network-only'
      });
      
      if (response.errors) {
        return rejectWithValue(response.errors[0].message);
      }
      
      return response.data.tasks;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi tải danh sách công việc');
    }
  }
);

// Async thunk để update task status
export const updateTaskStatus = createAsyncThunk(
  'tasks/updateTaskStatus',
  async ({ taskId, status }: { taskId: string, status: TaskStatus }, { getState, rejectWithValue }) => {
    try {
      const input = {
        task_id: taskId,
        status: status
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

      if (!response.data) {
        console.error('Không có dữ liệu trả về từ server');
        return rejectWithValue('Không có dữ liệu trả về từ server');
      }

      console.log('Response từ server:', response.data.update_task);

      // Chuyển đổi dữ liệu từ API về dạng dùng trong UI
      const transformedTask = transformTaskFromAPI(response.data.update_task);
      
      return {
        taskId,
        status,
        task: transformedTask
      };
    } catch (error) {
      console.error('Lỗi khi gọi API cập nhật trạng thái:', error);
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

      if (!response.data) {
        console.error('Không có dữ liệu trả về từ server');
        return rejectWithValue('Không có dữ liệu trả về từ server');
      }

      console.log('Response từ server:', response.data.update_task);

      // Chuyển đổi dữ liệu từ API về dạng dùng trong UI
      const transformedTask = transformTaskFromAPI(response.data.update_task);
      
      return {
        taskId,
        assigneeId,
        assignee: response.data.update_task.assignee,
        task: transformedTask
      };
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

      if (!response.data) {
        console.error('Không có dữ liệu trả về từ server');
        return rejectWithValue('Không có dữ liệu trả về từ server');
      }

      console.log('Response từ server:', response.data.update_task);

      // Chuyển đổi dữ liệu từ API về dạng dùng trong UI
      const transformedTask = transformTaskFromAPI(response.data.update_task);
      
      return {
        taskId,
        priority,
        task: transformedTask
      };
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

      if (!response.data) {
        console.error('Không có dữ liệu trả về từ server');
        return rejectWithValue('Không có dữ liệu trả về từ server');
      }

      console.log('Response từ server:', response.data.update_task);

      // Chuyển đổi dữ liệu từ API về dạng dùng trong UI
      const transformedTask = transformTaskFromAPI(response.data.update_task);
      
      return {
        taskId,
        effort,
        task: transformedTask
      };
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

      if (!response.data) {
        console.error('Không có dữ liệu trả về từ server');
        return rejectWithValue('Không có dữ liệu trả về từ server');
      }

      console.log('Response từ server:', response.data.update_task);

      // Chuyển đổi dữ liệu từ API về dạng dùng trong UI
      const transformedTask = transformTaskFromAPI(response.data.update_task);
      
      return {
        taskId,
        dueDate: formattedDueDate || undefined,
        task: transformedTask
      };
    } catch (error) {
      console.error('Lỗi khi gọi API cập nhật hạn:', error);
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi cập nhật hạn');
    }
  }
);

// Hàm tiện ích để chuyển đổi task từ snake_case (API) sang dạng dùng trong UI
const transformTaskFromAPI = (apiTask: any): Partial<Task> => {
  if (!apiTask) return {};

  return {
    task_id: apiTask.task_id,
    id: apiTask.task_id,
    project_id: apiTask.project_id,
    projectId: apiTask.project_id,
    parent_task_id: apiTask.parent_task_id,
    title: apiTask.title,
    description: apiTask.description,
    assignee: apiTask.assignee ? {
      userId: apiTask.assignee.user_id,
      username: apiTask.assignee.username,
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
    type: apiTask.type_ ?? apiTask.type,
    category: apiTask.category,
    progress_type: apiTask.progress_type,
    // Normalize JSONB tags to string[] (handles null, array, or legacy object shapes)
    tags: Array.isArray(apiTask.tags)
      ? apiTask.tags.filter((t: unknown): t is string => typeof t === 'string')
      : [],
    child_tasks: apiTask.child_tasks ? apiTask.child_tasks.map(transformTaskFromAPI) : undefined
  };
};

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
      state.pagination = initialState.pagination;
      state.filters = {};
    },
    // Sync a single task's fields locally without refetching
    updateTaskLocally: (state, action: PayloadAction<{ taskId: string; updates: Partial<Task> }>) => {
      const { taskId, updates } = action.payload;
      const idx = state.tasks.findIndex(t => t.task_id === taskId || t.id === taskId);
      if (idx >= 0) {
        state.tasks[idx] = { ...state.tasks[idx], ...updates };
      }
    }
  },
  extraReducers: (builder) => {
    // fetchProjectTasks
    builder.addCase(fetchProjectTasks.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchProjectTasks.fulfilled, (state, action) => {
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
      state.loading = false;
      state.error = action.payload as string;
    });
    
    // updateTaskStatus
    builder.addCase(updateTaskStatus.fulfilled, (state, action) => {
      const { taskId, status, task } = action.payload;
      
      // Cập nhật task trong state
      const taskIndex = state.tasks.findIndex(t => t.task_id === taskId || t.id === taskId);
      if (taskIndex >= 0) {
        console.log('Cập nhật task status trong store, index =', taskIndex);
        state.tasks[taskIndex].status = status;
        
        // Nếu có thêm data từ API, cập nhật luôn
        if (task) {
          state.tasks[taskIndex] = { ...state.tasks[taskIndex], ...task };
        }
      } else {
        console.log('Không tìm thấy task để cập nhật status trong store, taskId =', taskId);
      }
    });
    
    // updateTaskAssignee
    builder.addCase(updateTaskAssignee.fulfilled, (state, action) => {
      const { taskId, assigneeId, assignee, task } = action.payload;
      
      // Cập nhật task trong state
      const taskIndex = state.tasks.findIndex(t => t.task_id === taskId || t.id === taskId);
      if (taskIndex >= 0) {
        console.log('Cập nhật task assignee trong store, index =', taskIndex);
        // Sử dụng assignee.userId thay vì assignee_id
        if (assignee) {
          state.tasks[taskIndex].assignee = assignee;
        } else {
          state.tasks[taskIndex].assignee = undefined;
        }
        
        // Nếu có thêm data từ API, cập nhật luôn
        if (task) {
          state.tasks[taskIndex] = { ...state.tasks[taskIndex], ...task };
        }
      } else {
        console.log('Không tìm thấy task để cập nhật assignee trong store, taskId =', taskId);
      }
    });
    
    // updateTaskPriority
    builder.addCase(updateTaskPriority.fulfilled, (state, action) => {
      const { taskId, priority, task } = action.payload;
      
      // Cập nhật task trong state
      const taskIndex = state.tasks.findIndex(t => t.task_id === taskId || t.id === taskId);
      if (taskIndex >= 0) {
        console.log('Cập nhật task priority trong store, index =', taskIndex);
        state.tasks[taskIndex].priority = priority;
        
        // Nếu có thêm data từ API, cập nhật luôn
        if (task) {
          state.tasks[taskIndex] = { ...state.tasks[taskIndex], ...task };
        }
      } else {
        console.log('Không tìm thấy task để cập nhật priority trong store, taskId =', taskId);
      }
    });
    
    // updateTaskEffort
    builder.addCase(updateTaskEffort.fulfilled, (state, action) => {
      const { taskId, effort, task } = action.payload;
      
      // Cập nhật task trong state
      const taskIndex = state.tasks.findIndex(t => t.task_id === taskId || t.id === taskId);
      if (taskIndex >= 0) {
        console.log('Cập nhật task effort trong store, index =', taskIndex);
        state.tasks[taskIndex].effort = effort;
        
        // Nếu có thêm data từ API, cập nhật luôn
        if (task) {
          state.tasks[taskIndex] = { ...state.tasks[taskIndex], ...task };
        }
      } else {
        console.log('Không tìm thấy task để cập nhật effort trong store, taskId =', taskId);
      }
    });
    
    // updateTaskDueDate
    builder.addCase(updateTaskDueDate.fulfilled, (state, action) => {
      const { taskId, dueDate, task } = action.payload;
      
      // Cập nhật task trong state
      const taskIndex = state.tasks.findIndex(t => t.task_id === taskId || t.id === taskId);
      if (taskIndex >= 0) {
        console.log('Cập nhật task due date trong store, index =', taskIndex);
        state.tasks[taskIndex].due_date = dueDate;
        
        // Nếu có thêm data từ API, cập nhật luôn
        if (task) {
          state.tasks[taskIndex] = { ...state.tasks[taskIndex], ...task };
        }
      } else {
        console.log('Không tìm thấy task để cập nhật due date trong store, taskId =', taskId);
      }
    });
  }
});

export const { setFilter, setPage, setPageSize, resetTasks, updateTaskLocally } = tasksSlice.actions;
export default tasksSlice.reducer; 