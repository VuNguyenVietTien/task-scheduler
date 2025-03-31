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
  effort?: number;  // Thêm effort để tính toán lại nếu cần
  assigneeId?: string; // Thêm assigneeId để tính toán lại nếu cần
  assigneeName?: string; // Thêm tên người được gán
  priority?: string; // Ưu tiên của task (urgent, high, medium, low)
  fromPlan?: boolean;
  status?: string; // Trạng thái của task (todo, doing, done)
}

interface TaskOrderState {
  orderedTasks: TaskOrderItem[];
  sourceTaskIds: string[]; // Array of task IDs in the correct order
  isPlanLoaded: boolean; // Cờ để biết dữ liệu được lấy từ plan hay không
  currentPlanId: string | null;
  calculatedTaskDates: Record<string, { startDate?: string; endDate?: string }>; // Đã tính toán ngày cho mỗi task
  autoSort: boolean; // Biến mới để lưu trữ trạng thái sắp xếp tự động
}

const initialState: TaskOrderState = {
  orderedTasks: [],
  sourceTaskIds: [],
  isPlanLoaded: false,
  currentPlanId: null,
  calculatedTaskDates: {},
  autoSort: true // Mặc định là true khi khởi tạo
};

const taskOrderSlice = createSlice({
  name: 'taskOrder',
  initialState,
  reducers: {
    // Cập nhật thứ tự tasks (khi kéo thả trong Priority Task List)
    updateTaskOrder: (state, action: PayloadAction<TaskOrderItem[]>) => {
      state.orderedTasks = action.payload;
      state.sourceTaskIds = action.payload.map(item => item.taskId);
      // Không xóa calculatedTaskDates, chỉ đánh dấu là chưa cập nhật ngày cho các task mới
    },
    
    // Cập nhật thông tin tasks đầy đủ (sau khi tính toán ngày bắt đầu, kết thúc)
    updateTasksWithDates: (state, action: PayloadAction<TaskOrderItem[]>) => {
      state.orderedTasks = action.payload;
      state.sourceTaskIds = action.payload.map(item => item.taskId);
      
      // Cập nhật calculatedTaskDates đối với các task có ngày
      action.payload.forEach(task => {
        if (task.startDate && task.endDate) {
          state.calculatedTaskDates[task.taskId] = {
            startDate: task.startDate,
            endDate: task.endDate
          };
        }
      });
    },
    
    // Reset về trạng thái ban đầu
    resetTaskOrder: (state) => {
      state.orderedTasks = [];
      state.sourceTaskIds = [];
      state.isPlanLoaded = false;
      state.currentPlanId = null;
      state.calculatedTaskDates = {}; // Reset về object rỗng
    },
    
    // Lưu thông tin từ danh sách Task gốc (khi lần đầu load app)
    initializeFromTasks: (state, action: PayloadAction<Task[]>) => {
      // Nếu đã có plan được load, không cần khởi tạo từ tasks
      if (state.isPlanLoaded) {
        console.log('Đã có plan được load, bỏ qua initializeFromTasks');
        return;
      }
      
      // Nếu không có tasks hoặc danh sách rỗng, không làm gì cả
      if (!action.payload || action.payload.length === 0) {
        console.log('Danh sách tasks rỗng, bỏ qua initializeFromTasks');
        return;
      }
      
      console.log('Khởi tạo taskOrderStore từ tasks:', action.payload.length);
      
      // Chuyển đổi từ Task[] sang TaskOrderItem[]
      const orderItems = action.payload.map((task, index) => ({
        taskId: task.task_id,
        title: task.title,
        priorityOrder: task.priority_order || index,
        startDate: task.start_date,
        endDate: task.due_date,
        effort: task.effort,
        assigneeId: task.assignee?.userId,
        assigneeName: task.assignee?.username,
        priority: task.priority,
        status: task.status,
        fromPlan: false
      }));
      
      state.orderedTasks = orderItems;
      state.sourceTaskIds = orderItems.map(item => item.taskId);
      state.isPlanLoaded = false;
      
      // Tạo calculatedTaskDates từ task data
      const newCalculatedDates: Record<string, { startDate?: string; endDate?: string }> = {};
      orderItems.forEach(item => {
        if (item.startDate && item.endDate) {
          newCalculatedDates[item.taskId] = {
            startDate: item.startDate,
            endDate: item.endDate
          };
        }
      });
      state.calculatedTaskDates = newCalculatedDates;
    },
    
    // Tính toán lại ngày cho tất cả task và lưu vào store
    updateCalculatedDates: (state, action: PayloadAction<{taskId: string, startDate: string, endDate: string}[]>) => {
      const dateUpdates = action.payload;
      
      // Cập nhật ngày cho từng task
      dateUpdates.forEach(update => {
        const taskIndex = state.orderedTasks.findIndex(task => task.taskId === update.taskId);
        if (taskIndex >= 0) {
          state.orderedTasks[taskIndex].startDate = update.startDate;
          state.orderedTasks[taskIndex].endDate = update.endDate;
          
          // Lưu thông tin các ngày đã tính toán vào object
          state.calculatedTaskDates[update.taskId] = {
            startDate: update.startDate,
            endDate: update.endDate
          };
        }
      });
    },
    
    // Thêm action mới để cập nhật thứ tự và ngày tính toán trong một bước
    updateTaskOrderAndDates: (state, action: PayloadAction<{
      tasks: TaskOrderItem[], 
      dateUpdates: {taskId: string, startDate: string, endDate: string}[]
    }>) => {
      // Cập nhật thứ tự tasks
      state.orderedTasks = action.payload.tasks;
      state.sourceTaskIds = action.payload.tasks.map(item => item.taskId);
      
      // Cập nhật ngày cho từng task
      action.payload.dateUpdates.forEach(update => {
        const taskIndex = state.orderedTasks.findIndex(task => task.taskId === update.taskId);
        if (taskIndex >= 0) {
          state.orderedTasks[taskIndex].startDate = update.startDate;
          state.orderedTasks[taskIndex].endDate = update.endDate;
          
          // Lưu cập nhật vào calculatedTaskDates
          state.calculatedTaskDates[update.taskId] = {
            startDate: update.startDate,
            endDate: update.endDate
          };
        }
      });
    },
    
    // Thêm reducer mới để cập nhật trạng thái autoSort
    updateAutoSort: (state, action: PayloadAction<boolean>) => {
      state.autoSort = action.payload;
    },
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
      effort: task.effort,
      assigneeId: task.assigneeId,
      assigneeName: task.assigneeName,
      priority: task.priority,
      status: task.status,
      fromPlan: true
    }));
    
    state.orderedTasks = orderItems;
    state.sourceTaskIds = orderItems.map(item => item.taskId);
    state.isPlanLoaded = true;
    state.currentPlanId = plan.id;
    
    // Cập nhật calculatedTaskDates từ plan data
    const newCalculatedDates: Record<string, { startDate?: string; endDate?: string }> = {};
    orderItems.forEach(item => {
      if (item.startDate && item.endDate) {
        newCalculatedDates[item.taskId] = {
          startDate: item.startDate,
          endDate: item.endDate
        };
      }
    });
    state.calculatedTaskDates = newCalculatedDates;
    
    console.log('Đã cập nhật task order từ plan:', plan.name);
  }
}

export const { 
  updateTaskOrder, 
  updateTasksWithDates, 
  resetTaskOrder, 
  initializeFromTasks,
  updateCalculatedDates,
  updateTaskOrderAndDates,
  updateAutoSort
} = taskOrderSlice.actions;

// Selectors
export const selectOrderedTasks = (state: RootState) => state.taskOrder.orderedTasks;
export const selectSourceTaskIds = (state: RootState) => state.taskOrder.sourceTaskIds;
export const selectCalculatedTaskDates = (state: RootState) => state.taskOrder.calculatedTaskDates;
export const selectIsPlanLoaded = (state: RootState) => state.taskOrder.isPlanLoaded;
export const selectCurrentPlanId = (state: RootState) => state.taskOrder.currentPlanId;
export const selectAutoSort = (state: RootState) => state.taskOrder.autoSort;

export default taskOrderSlice.reducer; 