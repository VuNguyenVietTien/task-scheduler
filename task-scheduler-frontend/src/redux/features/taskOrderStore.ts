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

// Định nghĩa interface cho tham số của initializeFromTasks
interface InitializeFromTasksPayload {
  tasks: Task[];
  autoSort?: boolean;
  skipIfPlanLoaded?: boolean;
  onlyAddNewTasks?: boolean;
}

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
    initializeFromTasks: (state, action: PayloadAction<Task[] | InitializeFromTasksPayload>) => {
      // Xử lý input để hỗ trợ cả 2 kiểu dữ liệu đầu vào
      let tasks: Task[];
      let skipIfPlanLoaded = false;
      let onlyAddNewTasks = false;
      let autoSort = state.autoSort; // Giữ nguyên giá trị autoSort hiện tại
      
      // Kiểm tra xem action.payload có phải là mảng không
      if (Array.isArray(action.payload)) {
        tasks = action.payload;
      } else {
        // Nếu không phải mảng, lấy từ đối tượng payload
        tasks = action.payload.tasks;
        skipIfPlanLoaded = action.payload.skipIfPlanLoaded || false;
        onlyAddNewTasks = action.payload.onlyAddNewTasks || false;
        
        // Chỉ cập nhật autoSort nếu được chỉ định rõ trong payload
        if (action.payload.autoSort !== undefined) {
          autoSort = action.payload.autoSort;
        }
      }
      
      // Nếu cờ skipIfPlanLoaded = true và đã có plan được load, bỏ qua quá trình xử lý
      if (skipIfPlanLoaded && state.isPlanLoaded && !onlyAddNewTasks) {
        console.log('Bỏ qua initializeFromTasks vì đã có plan được load và skipIfPlanLoaded=true');
        return;
      }
      
      // Nếu không có tasks hoặc danh sách rỗng, không làm gì cả
      if (!tasks || tasks.length === 0) {
        console.log('Danh sách tasks rỗng, bỏ qua initializeFromTasks');
        return;
      }
      
      // Nếu đã có plan được load hoặc đang yêu cầu chỉ thêm task mới
      if (state.isPlanLoaded || onlyAddNewTasks) {
        console.log('Đã có plan được load, chỉ bổ sung thông tin task mới');
        
        // Tạo một Set chứa tất cả các taskId đã có trong state
        const existingTaskIds = new Set(state.orderedTasks.map(task => task.taskId));
        
        // Lọc ra những task chưa có trong state
        const newTasks = tasks.filter(task => !existingTaskIds.has(task.task_id));
        
        if (newTasks.length === 0) {
          console.log('Không có task mới cần bổ sung vào state');
          return;
        }
        
        console.log(`Bổ sung ${newTasks.length} task mới vào state (từ plan)`);
        
        // Chuyển đổi và thêm task mới vào cuối danh sách
        const newOrderItems = newTasks.map(task => ({
          taskId: task.task_id,
          title: task.title,
          priorityOrder: state.orderedTasks.length + 1, // Thêm vào cuối
          startDate: task.start_date,
          endDate: task.due_date,
          effort: task.effort,
          assigneeId: task.assignee?.userId,
          assigneeName: task.assignee?.username,
          priority: task.priority,
          status: task.status,
          fromPlan: false
        }));
        
        // Cập nhật state với task mới
        state.orderedTasks = [...state.orderedTasks, ...newOrderItems];
        state.sourceTaskIds = state.orderedTasks.map(item => item.taskId);
        
        // Cập nhật calculatedTaskDates với task mới
        newOrderItems.forEach(item => {
          if (item.startDate && item.endDate) {
            state.calculatedTaskDates[item.taskId] = {
              startDate: item.startDate,
              endDate: item.endDate
            };
          }
        });
        
        return;
      }
      
      // Nếu không có plan hoặc state chưa được khởi tạo từ plan, thực hiện khởi tạo mới
      console.log('Khởi tạo taskOrderStore từ tasks:', tasks.length);
      
      // Chuyển đổi từ Task[] sang TaskOrderItem[]
      const orderItems = tasks.map((task, index) => ({
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
      state.autoSort = autoSort; // Cập nhật autoSort từ tham số
      
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
  console.log('⭐ Bắt đầu updateTaskOrderFromPlan với plan:', plan.name);
  
  // Validate plan và plan_data
  if (!plan || !plan.planData) {
    console.warn('⚠️ Không thể cập nhật task order: Plan không hợp lệ hoặc thiếu plan_data');
    return;
  }
  
  try {
    // Chuyển đổi planData sang đúng format từ JSON nếu cần
    const planData = plan.planData;

    // Đảm bảo planData.tasks là mảng
    if (!Array.isArray(planData.tasks)) {
      console.warn('⚠️ Không thể cập nhật task order: planData.tasks không phải là mảng');
      return;
    }
    
    // Lấy thông tin task hiện tại để không mất dữ liệu
    const currentTasksMap = new Map(
      state.orderedTasks.map(task => [task.taskId, task])
    );
    
    // Tạo mảng chứa các task đã được sắp xếp từ plan
    let orderItems: TaskOrderItem[] = [];
    
    // Sử dụng Set để theo dõi các ID đã xử lý
    const processedIds = new Set<string>();
    
    // Kiểm tra và loại bỏ các ID trùng lặp trước trong planData.tasks
    const uniqueTaskIds = new Set<string>();
    const uniquePlanTasks = planData.tasks.filter((planTask: any) => {
      const taskId = planTask.task_id || planTask.taskId;
      if (uniqueTaskIds.has(taskId)) {
        console.warn(`⚠️ Phát hiện task trùng lặp trong planData.tasks: ${taskId}. Chỉ sử dụng lần xuất hiện đầu tiên.`);
        return false;
      }
      uniqueTaskIds.add(taskId);
      return true;
    });
    
    console.log(`Đã lọc ${planData.tasks.length - uniquePlanTasks.length} task trùng lặp trong planData.tasks.`);
    
    uniquePlanTasks.forEach((planTask: any) => {
      // Lấy task_id từ planTask, hỗ trợ cả task_id và taskId
      const taskId = planTask.task_id || planTask.taskId;
      
      // Bỏ qua nếu đã xử lý ID này
      if (processedIds.has(taskId)) {
        return;
      }
      
      // Đánh dấu ID đã xử lý
      processedIds.add(taskId);
      
      // Tìm task hiện tại trong store để lấy thông tin bổ sung
      const currentTask = currentTasksMap.get(taskId);
      
      // Xử lý priority để đảm bảo đúng kiểu
      let taskPriority: string | undefined = planTask.priority;
      
      // Nếu không có priority từ plan hoặc priority không hợp lệ, lấy từ currentTask hoặc dùng giá trị mặc định
      if (!taskPriority || !['low', 'medium', 'high', 'urgent', 'critical'].includes(taskPriority)) {
        taskPriority = currentTask?.priority || 'medium';
      }
      
      // Xử lý status tương tự như priority
      let taskStatus: string | undefined = planTask.status;
      
      // Nếu không có status từ plan, lấy từ currentTask hoặc dùng giá trị mặc định
      if (!taskStatus) {
        taskStatus = currentTask?.status || 'todo';
      }
      
      // Thêm vào danh sách với đầy đủ thông tin
      orderItems.push({
        taskId: taskId,
        // Ưu tiên dùng title từ Redux store nếu title trong plan là null
        title: currentTask?.title || planTask.title || 'Không có tiêu đề',
        priorityOrder: planTask.priority_order || planTask.priorityOrder || 0,
        startDate: planTask.start_date || planTask.startDate,
        endDate: planTask.end_date || planTask.endDate,
        // Thông tin bổ sung
        effort: planTask.effort !== undefined ? planTask.effort : (currentTask?.effort),
        assigneeId: planTask.assignee_id || planTask.assigneeId || currentTask?.assigneeId,
        assigneeName: planTask.assignee_name || planTask.assigneeName || currentTask?.assigneeName,
        priority: taskPriority,
        status: taskStatus,
        fromPlan: true
      });
    });
    
    // Kiểm tra ID trùng lặp một lần nữa trước khi cập nhật state
    const finalUniqueIds = new Set<string>();
    const duplicateIds = new Set<string>();
    
    // Phát hiện và thu thập các ID trùng lặp
    orderItems.forEach(item => {
      if (finalUniqueIds.has(item.taskId)) {
        duplicateIds.add(item.taskId);
      }
      finalUniqueIds.add(item.taskId);
    });
    
    // Nếu có ID trùng lặp, lọc để chỉ giữ lại lần xuất hiện đầu tiên
    if (duplicateIds.size > 0) {
      console.warn(`⚠️ Phát hiện ${duplicateIds.size} task trùng lặp sau khi xử lý. Loại bỏ các bản trùng lặp.`);
      
      // Set để theo dõi các ID đã thêm vào danh sách kết quả
      const addedIds = new Set<string>();
      
      // Lọc để chỉ giữ lại phần tử xuất hiện đầu tiên cho mỗi taskId
      orderItems = orderItems.filter(item => {
        if (addedIds.has(item.taskId)) {
          console.warn(`⚠️ Loại bỏ bản trùng lặp của: ${item.taskId}`);
          return false;
        }
        addedIds.add(item.taskId);
        return true;
      });
    }
    
    // Log để debug
    console.log('Đã chuyển đổi sang orderItems:', orderItems.length, 'tasks');
    orderItems.slice(0, 5).forEach((item, i) => {
      console.log(`  ${i+1}. Task ${item.taskId} - ${item.title} (${item.priority}), Order: ${item.priorityOrder}`);
    });
    
    // Cập nhật state với các task đã lọc trùng lặp
    state.orderedTasks = orderItems;
    state.sourceTaskIds = orderItems.map(item => item.taskId);
    state.isPlanLoaded = true;
    state.currentPlanId = plan.id;
    state.autoSort = false; // Khi có plan, tắt auto sort
    
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
    console.log('⭐ Hoàn thành cập nhật task order từ plan', plan.id);
    
  } catch (error) {
    console.error('❌ Lỗi khi cập nhật task order từ plan:', error);
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