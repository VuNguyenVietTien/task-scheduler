import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { Task } from '@/types/task';
import { fetchProjectPlans, fetchLatestProjectPlan, createPlan, updatePlan, setActivePlan } from './plansSlice';
import { Plan } from '@/types/plan';

// Định nghĩa kiểu dữ liệu cho task order
export interface TaskOrderItem {
  taskId: string;
  title?: string;
  priorityOrder: number;
  startDate?: string;
  endDate?: string;
  fromPlan?: boolean;
}

interface TaskOrderState {
  orderedTasks: TaskOrderItem[];
  sourceTaskIds: string[]; // Array of task IDs in the correct order
  isPlanLoaded: boolean; // Cờ để biết dữ liệu được lấy từ plan hay không
  currentPlanId: string | null;
}

const initialState: TaskOrderState = {
  orderedTasks: [],
  sourceTaskIds: [],
  isPlanLoaded: false,
  currentPlanId: null
};

const taskOrderSlice = createSlice({
  name: 'taskOrder',
  initialState,
  reducers: {
    // Cập nhật thứ tự tasks (khi kéo thả trong Priority Task List)
    updateTaskOrder: (state, action: PayloadAction<TaskOrderItem[]>) => {
      state.orderedTasks = action.payload;
      state.sourceTaskIds = action.payload.map(item => item.taskId);
    },
    
    // Cập nhật thông tin tasks đầy đủ (sau khi tính toán ngày bắt đầu, kết thúc)
    updateTasksWithDates: (state, action: PayloadAction<TaskOrderItem[]>) => {
      state.orderedTasks = action.payload;
      state.sourceTaskIds = action.payload.map(item => item.taskId);
    },
    
    // Reset về trạng thái ban đầu
    resetTaskOrder: (state) => {
      state.orderedTasks = [];
      state.sourceTaskIds = [];
      state.isPlanLoaded = false;
      state.currentPlanId = null;
    },
    
    // Lưu thông tin từ danh sách Task gốc (khi lần đầu load app)
    initializeFromTasks: (state, action: PayloadAction<Task[]>) => {
      // Chuyển đổi từ Task[] sang TaskOrderItem[]
      const orderItems = action.payload.map((task, index) => ({
        taskId: task.task_id,
        title: task.title,
        priorityOrder: task.priority_order || index,
        startDate: task.start_date,
        endDate: task.due_date,
        fromPlan: false
      }));
      
      state.orderedTasks = orderItems;
      state.sourceTaskIds = orderItems.map(item => item.taskId);
      state.isPlanLoaded = false;
    }
  },
  extraReducers: (builder) => {
    // Xử lý khi load plan từ server
    builder
      // Khi load plan thành công, cập nhật TaskOrder từ plan data
      .addCase(fetchLatestProjectPlan.fulfilled, (state, action) => {
        if (action.payload) {
          const plan = action.payload;
          updateTaskOrderFromPlan(state, plan);
        }
      })
      // Khi fetch project plans thành công, nếu có active plan thì cập nhật từ đó
      .addCase(fetchProjectPlans.fulfilled, (state, action) => {
        if (action.payload && action.payload.length > 0) {
          const activePlan = action.payload.find((plan: Plan) => plan.isActive);
          if (activePlan) {
            updateTaskOrderFromPlan(state, activePlan);
          }
        }
      })
      // Khi tạo plan mới thành công, cập nhật từ plan data
      .addCase(createPlan.fulfilled, (state, action) => {
        updateTaskOrderFromPlan(state, action.payload);
      })
      // Khi update plan thành công, cập nhật từ plan data mới
      .addCase(updatePlan.fulfilled, (state, action) => {
        updateTaskOrderFromPlan(state, action.payload);
      })
      // Khi thay đổi active plan, cập nhật từ plan data mới
      .addCase(setActivePlan, (state, action) => {
        if (action.payload) {
          updateTaskOrderFromPlan(state, action.payload);
        } else {
          // Nếu set active plan về null, đánh dấu là không sử dụng plan
          state.isPlanLoaded = false;
          state.currentPlanId = null;
        }
      });
  }
});

// Hàm helper để cập nhật state từ plan data
function updateTaskOrderFromPlan(state: TaskOrderState, plan: Plan) {
  let planData = plan.planData;
  
  // Kiểm tra nếu planData là string thì parse thành object
  if (typeof planData === 'string') {
    try {
      planData = JSON.parse(planData);
    } catch (e) {
      console.error('Lỗi khi parse planData:', e);
      return;
    }
  }
  
  // Kiểm tra nếu có tasks trong planData
  if (planData && planData.tasks && planData.tasks.length > 0) {
    // Chuyển đổi từ plan tasks sang TaskOrderItem[]
    const orderItems = planData.tasks.map((task: any) => ({
      taskId: task.taskId,
      title: task.title,
      priorityOrder: task.priorityOrder,
      startDate: task.startDate,
      endDate: task.endDate,
      fromPlan: true
    }));
    
    state.orderedTasks = orderItems;
    state.sourceTaskIds = orderItems.map(item => item.taskId);
    state.isPlanLoaded = true;
    state.currentPlanId = plan.id;
    
    console.log('Đã cập nhật task order từ plan:', plan.name);
  }
}

export const { updateTaskOrder, updateTasksWithDates, resetTaskOrder, initializeFromTasks } = taskOrderSlice.actions;

// Selectors
export const selectOrderedTasks = (state: RootState) => state.taskOrder.orderedTasks;
export const selectSourceTaskIds = (state: RootState) => state.taskOrder.sourceTaskIds;
export const selectIsPlanLoaded = (state: RootState) => state.taskOrder.isPlanLoaded;
export const selectCurrentPlanId = (state: RootState) => state.taskOrder.currentPlanId;

export default taskOrderSlice.reducer; 