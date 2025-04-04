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
      // Sửa lại định dạng input đúng với API backend mong đợi
      // Không cần lấy data từ store nữa
      const input = {
        taskId: taskId,
        status: String(status).toLowerCase()
      };
      
      console.log('Gửi request cập nhật trạng thái:', input);
      
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
      
      console.log('Response từ server:', response.data.updateTask);
      
      // Chuyển đổi dữ liệu từ API về dạng dùng trong UI
      const transformedTask = transformTaskFromAPI(response.data.updateTask);
      
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
      // Tìm task hiện tại trong store để lấy assignee_id
      const state = getState() as { tasks: TasksState };
      const currentTask = state.tasks.tasks.find(t => t.task_id === taskId || t.id === taskId);
      
      if (!currentTask) {
        return rejectWithValue('Không tìm thấy task trong state');
      }

      // Sửa lại định dạng input đúng với API backend mong đợi
      // Thêm assignee_id vào input để tránh bị ghi đè thành null
      const input = {
        taskId: taskId,
        assigneeId: assigneeId
      };
      
      console.log('Gửi request cập nhật người được giao:', input);
      
      const response = await client.mutate({
        mutation: UPDATE_TASK,
        variables: { input },
        errorPolicy: 'all'
      });
      
      if (response.errors) {
        console.error('Lỗi GraphQL:', response.errors);
        return rejectWithValue(response.errors[0].message);
      }
      
      if (!response.data) {
        console.error('Không có dữ liệu trả về từ server');
        return rejectWithValue('Không có dữ liệu trả về từ server');
      }

      console.log('Response từ server:', response.data.updateTask);
      
      return {
        taskId,
        assigneeId,
        assignee: response.data.updateTask.assignee,
        task: response.data.updateTask // Thêm toàn bộ task vào response
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
      // Sửa lại định dạng input đúng với API backend mong đợi
      // Không cần lấy data từ store nữa
      const input = {
        taskId: taskId,
        priority: String(priority).toLowerCase()
      };
      
      console.log('Gửi request cập nhật ưu tiên:', input);
      
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

      console.log('Response từ server:', response.data.updateTask);
      
      // Chuyển đổi dữ liệu từ API về dạng dùng trong UI
      const transformedTask = transformTaskFromAPI(response.data.updateTask);
      
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
      // Sửa lại định dạng input đúng với API backend mong đợi
      // Không cần lấy data từ store nữa
      const input = {
        taskId: taskId,
        effort: Number(effort)
      };
      
      console.log('Gửi request cập nhật công sức:', input);
      
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

      console.log('Response từ server:', response.data.updateTask);
      
      // Chuyển đổi dữ liệu từ API về dạng dùng trong UI
      const transformedTask = transformTaskFromAPI(response.data.updateTask);
      
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

// Hàm tiện ích để chuyển đổi task từ camelCase (API) sang snake_case (UI)
const transformTaskFromAPI = (apiTask: any): Partial<Task> => {
  if (!apiTask) return {};

  return {
    task_id: apiTask.taskId,
    id: apiTask.taskId,
    project_id: apiTask.projectId,
    projectId: apiTask.projectId,
    parent_task_id: apiTask.parentTaskId,
    title: apiTask.title,
    description: apiTask.description,
    assignee: apiTask.assignee ? {
      userId: apiTask.assignee.userId,
      username: apiTask.assignee.username,
      avatarUrl: apiTask.assignee.avatarUrl || "",
      role: apiTask.assignee.role || ""
    } : undefined,
    priority_order: apiTask.priorityOrder,
    start_date: apiTask.startDate,
    due_date: apiTask.dueDate,
    actual_start_date: apiTask.actualStartDate,
    actual_end_date: apiTask.actualEndDate,
    effort: apiTask.effort,
    progress: apiTask.progress,
    created_by: apiTask.createdBy,
    created_at: apiTask.createdAt,
    updated_at: apiTask.updatedAt,
    is_deleted: apiTask.isDeleted,
    status: apiTask.status,
    priority: apiTask.priority,
    type: apiTask.type,
    category: apiTask.category,
    progress_type: apiTask.progressType,
    tags: apiTask.tags,
    child_tasks: apiTask.childTasks ? apiTask.childTasks.map(transformTaskFromAPI) : undefined
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
  }
});

export const { setFilter, setPage, setPageSize, resetTasks } = tasksSlice.actions;
export default tasksSlice.reducer; 