import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Task, TaskComment, UserBasic } from '@/types/task';
import { client } from '@/lib/apollo-client';
import { 
  GET_TASK_BY_ID,
  GET_TASK_SUBTASKS,
  GET_TASK_COMMENTS,
  GET_TASK_BASIC_INFO
} from '@/graphql/queries/tasks';
import { UPDATE_TASK } from '@/graphql/mutations/tasks';

// Định nghĩa kiểu dữ liệu cho state
interface TaskDetailState {
  task: Task | null;
  subtasks: Task[];
  comments: TaskComment[];
  loadingTask: boolean;
  loadingSubtasks: boolean;
  loadingComments: boolean;
  updatingParent: boolean;
  searchingParent: boolean;
  potentialParentTask: { taskId: string; title: string; projectId: string } | null;
  error: string | null;
}

// State ban đầu
const initialState: TaskDetailState = {
  task: null,
  subtasks: [],
  comments: [],
  loadingTask: false,
  loadingSubtasks: false,
  loadingComments: false,
  updatingParent: false,
  searchingParent: false,
  potentialParentTask: null,
  error: null
};

// Async thunk để lấy thông tin chi tiết của task
export const fetchTaskDetail = createAsyncThunk(
  'taskDetail/fetchTaskDetail',
  async (taskId: string, { rejectWithValue }) => {
    try {
      const response = await client.query({
        query: GET_TASK_BY_ID,
        variables: { taskId },
        fetchPolicy: 'network-only'
      });
      
      if (response.errors) {
        return rejectWithValue(response.errors[0].message);
      }
      
      return response.data.task;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi tải thông tin công việc');
    }
  }
);

// Async thunk để lấy danh sách subtasks
export const fetchSubtasks = createAsyncThunk(
  'taskDetail/fetchSubtasks',
  async (taskId: string, { rejectWithValue }) => {
    try {
      const response = await client.query({
        query: GET_TASK_SUBTASKS,
        variables: { taskId },
        fetchPolicy: 'network-only'
      });
      
      if (response.errors) {
        return rejectWithValue(response.errors[0].message);
      }
      
      return response.data.taskSubtasks;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi tải danh sách công việc con');
    }
  }
);

// Async thunk để lấy danh sách comments
export const fetchComments = createAsyncThunk(
  'taskDetail/fetchComments',
  async (taskId: string, { rejectWithValue }) => {
    try {
      const response = await client.query({
        query: GET_TASK_COMMENTS,
        variables: { taskId },
        fetchPolicy: 'network-only'
      });
      
      if (response.errors) {
        return rejectWithValue(response.errors[0].message);
      }
      
      return response.data.taskComments;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi tải bình luận');
    }
  }
);

// Async thunk để cập nhật parent task
export const updateTaskParent = createAsyncThunk(
  'taskDetail/updateTaskParent',
  async ({ 
    taskId, 
    parentTaskId 
  }: { 
    taskId: string; 
    parentTaskId: string;
  }, { rejectWithValue }) => {
    try {
      console.log(`Đang cập nhật parent task: taskId=${taskId}, parentTaskId=${parentTaskId}`);
      // Gọi API để cập nhật parent task
      const response = await client.mutate({
        mutation: UPDATE_TASK,
        variables: { 
          input: {
            taskId,
            parentTaskId // Sử dụng tên trường camelCase để khớp với GraphQL schema
          } 
        },
        fetchPolicy: 'no-cache'
      });
      
      if (response.errors) {
        console.error('Lỗi khi cập nhật task cha:', response.errors);
        return rejectWithValue(response.errors[0].message);
      }
      
      console.log('Kết quả cập nhật parent task:', response.data.updateTask);
      return response.data.updateTask;
    } catch (error) {
      console.error('Exception khi cập nhật task cha:', error);
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi cập nhật task cha');
    }
  }
);

// Async thunk để tìm kiếm task theo ID (chỉ lấy thông tin cơ bản)
export const searchParentTaskById = createAsyncThunk(
  'taskDetail/searchParentTaskById',
  async (taskId: string, { rejectWithValue }) => {
    try {
      const response = await client.query({
        query: GET_TASK_BASIC_INFO,
        variables: { taskId },
        fetchPolicy: 'network-only'
      });
      
      if (response.errors) {
        return rejectWithValue(response.errors[0].message);
      }
      
      // Nếu không tìm thấy task
      if (!response.data.task) {
        return rejectWithValue('Không tìm thấy task với ID đã nhập');
      }
      
      return response.data.task;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi tìm task cha');
    }
  }
);

// Hàm chuyển đổi dữ liệu từ API sang định dạng local
const transformTaskFromAPI = (apiTask: any): Task => {
  return {
    task_id: apiTask.taskId,
    id: apiTask.taskId,
    project_id: apiTask.projectId,
    parent_task_id: apiTask.parentTaskId,
    title: apiTask.title,
    description: apiTask.description,
    assignee: apiTask.assignee ? {
      userId: apiTask.assignee.userId,
      username: apiTask.assignee.username,
      avatarUrl: apiTask.assignee.avatarUrl || "",
      role: apiTask.assignee.role || ""
    } : undefined,
    priority_order: apiTask.priorityOrder || 0,
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
    status: apiTask.status || 'todo',
    priority: apiTask.priority || 'medium',
    type: apiTask.type,
    category: apiTask.category,
    progress_type: apiTask.progressType,
    tags: apiTask.tags
  };
};

// Hàm chuyển đổi comment từ API sang định dạng local
const transformCommentFromAPI = (apiComment: any): TaskComment => {
  return {
    id: apiComment.id,
    content: apiComment.content,
    user_id: apiComment.authorId,
    username: apiComment.username,
    avatar_url: apiComment.avatarUrl,
    created_at: apiComment.createdAt,
    updated_at: apiComment.updatedAt
  };
};

// Tạo slice
const taskDetailSlice = createSlice({
  name: 'taskDetail',
  initialState,
  reducers: {
    resetTaskDetail: (state) => {
      state.task = null;
      state.subtasks = [];
      state.comments = [];
      state.loadingTask = false;
      state.loadingSubtasks = false;
      state.loadingComments = false;
      state.updatingParent = false;
      state.searchingParent = false;
      state.potentialParentTask = null;
      state.error = null;
    },
    clearParentTaskSearch: (state) => {
      state.potentialParentTask = null;
      state.searchingParent = false;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    // fetchTaskDetail
    builder.addCase(fetchTaskDetail.pending, (state) => {
      state.loadingTask = true;
      state.error = null;
    });
    builder.addCase(fetchTaskDetail.fulfilled, (state, action) => {
      state.loadingTask = false;
      state.task = transformTaskFromAPI(action.payload);
    });
    builder.addCase(fetchTaskDetail.rejected, (state, action) => {
      state.loadingTask = false;
      state.error = action.payload as string;
    });

    // fetchSubtasks
    builder.addCase(fetchSubtasks.pending, (state) => {
      state.loadingSubtasks = true;
    });
    builder.addCase(fetchSubtasks.fulfilled, (state, action) => {
      state.loadingSubtasks = false;
      state.subtasks = action.payload.map(transformTaskFromAPI);
    });
    builder.addCase(fetchSubtasks.rejected, (state, action) => {
      state.loadingSubtasks = false;
      state.error = action.payload as string;
    });

    // fetchComments
    builder.addCase(fetchComments.pending, (state) => {
      state.loadingComments = true;
    });
    builder.addCase(fetchComments.fulfilled, (state, action) => {
      state.loadingComments = false;
      state.comments = action.payload.map(transformCommentFromAPI);
    });
    builder.addCase(fetchComments.rejected, (state, action) => {
      state.loadingComments = false;
      state.error = action.payload as string;
    });

    // updateTaskParent
    builder.addCase(updateTaskParent.pending, (state) => {
      state.updatingParent = true;
      state.error = null;
    });
    builder.addCase(updateTaskParent.fulfilled, (state, action) => {
      state.updatingParent = false;
      
      console.log('UPDATE_TASK_PARENT THÀNH CÔNG!');
      console.log('Payload từ action:', action.payload);
      console.log('parentTaskId mới:', action.payload?.parentTaskId);
      
      if (state.task) {
        state.task.parent_task_id = action.payload?.parentTaskId || null;
        console.log('Đã cập nhật state.task.parent_task_id thành:', state.task.parent_task_id);
      } else {
        console.log('Không thể cập nhật parent_task_id vì state.task là null');
      }
      
      // Clear potential parent task
      state.potentialParentTask = null;
    });
    builder.addCase(updateTaskParent.rejected, (state, action) => {
      state.updatingParent = false;
      state.error = action.payload as string || 'Lỗi khi cập nhật task cha';
      console.error('UPDATE_TASK_PARENT THẤT BẠI:', state.error);
    });
    
    // searchParentTaskById
    builder.addCase(searchParentTaskById.pending, (state) => {
      state.searchingParent = true;
      state.potentialParentTask = null;
      state.error = null;
    });
    builder.addCase(searchParentTaskById.fulfilled, (state, action) => {
      state.searchingParent = false;
      state.potentialParentTask = {
        taskId: action.payload.taskId,
        title: action.payload.title,
        projectId: action.payload.projectId
      };
    });
    builder.addCase(searchParentTaskById.rejected, (state, action) => {
      state.searchingParent = false;
      state.potentialParentTask = null;
      state.error = action.payload as string;
    });
  }
});

export const { resetTaskDetail, clearParentTaskSearch } = taskDetailSlice.actions;
export default taskDetailSlice.reducer; 