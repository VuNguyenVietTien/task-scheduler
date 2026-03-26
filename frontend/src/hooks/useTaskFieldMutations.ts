import { useCallback, useState } from 'react';
import { useApolloClient } from '@apollo/client';
import { client } from '@/lib/apollo-client';
import { UPDATE_TASK, UPDATE_TASK_EFFORT } from '@/graphql/mutations/tasks';
import { Task, TaskStatus, Priority } from '@/types/task';

// Hook cho cập nhật trạng thái task
export function useUpdateTaskStatus() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const apolloClient = useApolloClient();

  const updateStatus = useCallback(async (taskId: string, status: TaskStatus) => {
    setIsUpdating(true);
    setError(null);
    
    try {
      // Chuyển đổi status sang dạng lowercase cho API (backend)
      const statusKey = String(status).toLowerCase();
      
      // Input chỉ chứa taskId và status
      const input = {
        taskId,
        status: statusKey
      };
      
      console.log(`Đang cập nhật trạng thái: ${statusKey} (gốc: ${status})`);
      
      // Gọi API GraphQL
      const response = await client.mutate({
        mutation: UPDATE_TASK,
        variables: { input },
        errorPolicy: 'all',
        optimisticResponse: {
          updateTask: {
            __typename: 'Task',
            taskId: taskId,
            status: statusKey,
          }
        }
      });
      
      if (response.errors) {
        console.warn("GraphQL errors:", response.errors);
        if (!response.data) {
          throw new Error(response.errors[0].message);
        }
      }
      
      // Xử lý kết quả
      const result = response.data?.updateTask;
      
      // Thông báo cập nhật thành công
      if (result) {
        const formattedResult = {
          task_id: result.taskId,
          status: result.status?.toLowerCase() as TaskStatus,
        };
        
        // Broadcast event cập nhật
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('task-status-updated', { 
            detail: { 
              taskId,
              status: formattedResult.status
            } 
          });
          window.dispatchEvent(event);
        }
        
        setIsUpdating(false);
        return formattedResult;
      }
      
      setIsUpdating(false);
      return { task_id: taskId, status };
    } catch (err) {
      console.error('Lỗi khi cập nhật trạng thái task:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsUpdating(false);
      throw err;
    }
  }, [apolloClient]);

  return {
    updateStatus,
    isUpdating,
    error
  };
}

// Hook cho cập nhật ưu tiên task
export function useUpdateTaskPriority() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const apolloClient = useApolloClient();

  const updatePriority = useCallback(async (taskId: string, priority: Priority) => {
    setIsUpdating(true);
    setError(null);
    
    try {
      // Chuyển đổi priority sang dạng lowercase cho API (backend)
      const priorityKey = String(priority).toLowerCase();
      
      // Input chỉ chứa taskId và priority
      const input = {
        taskId,
        priority: priorityKey
      };
      
      console.log(`Đang cập nhật ưu tiên: ${priorityKey} (gốc: ${priority})`);
      
      // Gọi API GraphQL
      const response = await client.mutate({
        mutation: UPDATE_TASK,
        variables: { input },
        errorPolicy: 'all',
        optimisticResponse: {
          updateTask: {
            __typename: 'Task',
            taskId: taskId,
            priority: priorityKey,
          }
        }
      });
      
      if (response.errors) {
        console.warn("GraphQL errors:", response.errors);
        if (!response.data) {
          throw new Error(response.errors[0].message);
        }
      }
      
      // Xử lý kết quả
      const result = response.data?.updateTask;
      
      // Thông báo cập nhật thành công
      if (result) {
        const formattedResult = {
          task_id: result.taskId,
          priority: result.priority?.toLowerCase() as Priority,
        };
        
        // Broadcast event cập nhật
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('task-priority-updated', { 
            detail: { 
              taskId,
              priority: formattedResult.priority
            } 
          });
          window.dispatchEvent(event);
        }
        
        setIsUpdating(false);
        return formattedResult;
      }
      
      setIsUpdating(false);
      return { task_id: taskId, priority };
    } catch (err) {
      console.error('Lỗi khi cập nhật ưu tiên task:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsUpdating(false);
      throw err;
    }
  }, [apolloClient]);

  return {
    updatePriority,
    isUpdating,
    error
  };
}

// Hook cho cập nhật effort (công sức) của task
export function useUpdateTaskEffort() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const apolloClient = useApolloClient();

  const updateEffort = useCallback(async (taskId: string, effort: number) => {
    setIsUpdating(true);
    setError(null);
    
    try {
      // Trích xuất thông tin task hiện tại từ cache nếu có 
      let assigneeFromCache = null;
      try {
        // Kiểm tra trong localStorage
        const tasksCache = localStorage.getItem('tasks-cache');
        if (tasksCache) {
          const tasks = JSON.parse(tasksCache);
          const task = tasks.find((t: any) => t.task_id === taskId);
          if (task && task.assignee) {
            assigneeFromCache = task.assignee;
          }
        }
        
        // Hoặc kiểm tra trong Apollo cache
        if (!assigneeFromCache) {
          try {
            const cache = apolloClient.cache.extract();
            // Sử dụng cách an toàn với TypeScript
            Object.entries(cache).forEach(([key, value]) => {
              if (key.includes('Task:') && key.includes(taskId)) {
                const cachedTask = value as any;
                if (cachedTask && cachedTask.assignee) {
                  assigneeFromCache = cachedTask.assignee;
                }
              }
            });
          } catch (e) {
            console.warn('Lỗi khi truy cập cache:', e);
          }
        }
      } catch (e) {
        console.warn('Không thể lấy thông tin assignee từ cache:', e);
      }
      
      // Input chỉ chứa taskId và effort, sử dụng mutation chuyên biệt
      const input = {
        taskId,
        effort: Number(effort)
      };
      
      console.log(`Đang cập nhật công sức: ${effort} với API đặc biệt`);
      
      // Gọi API GraphQL chuyên biệt cho cập nhật effort
      const response = await client.mutate({
        mutation: UPDATE_TASK_EFFORT, // Sử dụng mutation mới
        variables: { input },
        errorPolicy: 'all',
        optimisticResponse: {
          updateTaskEffort: { // Cập nhật response type
            __typename: 'Task',
            taskId: taskId,
            effort: Number(effort),
            // Giữ nguyên thông tin assignee trong phản hồi tối ưu
            assignee: assigneeFromCache
          }
        }
      });
      
      if (response.errors) {
        console.warn("GraphQL errors:", response.errors);
        if (!response.data) {
          throw new Error(response.errors[0].message);
        }
      }
      
      // Xử lý kết quả - Chú ý đổi sang updateTaskEffort
      const result = response.data?.updateTaskEffort;
      
      // Thông báo cập nhật thành công
      if (result) {
        const formattedResult = {
          task_id: result.taskId,
          effort: result.effort,
          // Đảm bảo giữ nguyên thông tin assignee nếu không có từ API
          assignee: result.assignee || assigneeFromCache
        };
        
        // Broadcast event cập nhật
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('task-effort-updated', { 
            detail: { 
              taskId,
              effort: formattedResult.effort,
              // Thêm thông tin assignee vào event
              assignee: formattedResult.assignee
            } 
          });
          window.dispatchEvent(event);
        }
        
        setIsUpdating(false);
        return formattedResult;
      }
      
      setIsUpdating(false);
      return { 
        task_id: taskId, 
        effort,
        // Giữ nguyên assignee từ cache nếu có
        assignee: assigneeFromCache 
      };
    } catch (err) {
      console.error('Lỗi khi cập nhật công sức task:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsUpdating(false);
      throw err;
    }
  }, [apolloClient]);

  return {
    updateEffort,
    isUpdating,
    error
  };
}

// Hook cho cập nhật ngày hết hạn (due date) của task
export function useUpdateTaskDueDate() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const apolloClient = useApolloClient();

  const updateDueDate = useCallback(async (taskId: string, dueDate: string) => {
    setIsUpdating(true);
    setError(null);
    
    try {
      // Đảm bảo định dạng ISO đầy đủ cho datetime
      let formattedDueDate = null;
      if (dueDate) {
        formattedDueDate = new Date(dueDate).toISOString();
      }
      
      // Input chỉ chứa taskId và dueDate
      const input = {
        taskId,
        dueDate: formattedDueDate
      };
      
      console.log(`Đang cập nhật hạn: ${formattedDueDate} (gốc: ${dueDate})`);
      
      // Gọi API GraphQL
      const response = await client.mutate({
        mutation: UPDATE_TASK,
        variables: { input },
        errorPolicy: 'all',
        optimisticResponse: {
          updateTask: {
            __typename: 'Task',
            taskId: taskId,
            dueDate: formattedDueDate,
          }
        }
      });
      
      if (response.errors) {
        console.warn("GraphQL errors:", response.errors);
        if (!response.data) {
          throw new Error(response.errors[0].message);
        }
      }
      
      // Xử lý kết quả
      const result = response.data?.updateTask;
      
      // Thông báo cập nhật thành công
      if (result) {
        const formattedResult = {
          task_id: result.taskId,
          due_date: result.dueDate,
        };
        
        // Broadcast event cập nhật
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('task-due-date-updated', { 
            detail: { 
              taskId,
              dueDate: formattedResult.due_date
            } 
          });
          window.dispatchEvent(event);
        }
        
        setIsUpdating(false);
        return formattedResult;
      }
      
      setIsUpdating(false);
      return { task_id: taskId, due_date: dueDate };
    } catch (err) {
      console.error('Lỗi khi cập nhật hạn task:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsUpdating(false);
      throw err;
    }
  }, [apolloClient]);

  return {
    updateDueDate,
    isUpdating,
    error
  };
}

// Hook cho cập nhật người được giao (assignee) của task
export function useUpdateTaskAssignee() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const apolloClient = useApolloClient();

  const updateAssignee = useCallback(async (taskId: string, assigneeId: string | null) => {
    setIsUpdating(true);
    setError(null);
    
    try {
      // Input chỉ chứa taskId và assigneeId
      const input = {
        taskId,
        assigneeId: assigneeId === '' ? null : assigneeId
      };
      
      console.log(`Đang cập nhật người được giao: ${assigneeId}`);
      
      // Gọi API GraphQL
      const response = await client.mutate({
        mutation: UPDATE_TASK,
        variables: { input },
        errorPolicy: 'all',
        optimisticResponse: {
          updateTask: {
            __typename: 'Task',
            taskId: taskId,
            assigneeId: input.assigneeId,
          }
        }
      });
      
      if (response.errors) {
        console.warn("GraphQL errors:", response.errors);
        if (!response.data) {
          throw new Error(response.errors[0].message);
        }
      }
      
      // Xử lý kết quả
      const result = response.data?.updateTask;
      
      // Thông báo cập nhật thành công
      if (result) {
        // Đảm bảo TypeScript nhận assignee có định dạng đúng (undefined thay vì null)
        const formattedResult: Partial<Task> = {
          task_id: result.taskId,
          // Chuyển null thành undefined để phù hợp với kiểu dữ liệu Task
          assignee_id: result.assignee?.userId || undefined,
          // Chuyển assignee từ null thành undefined để phù hợp với Task type
          assignee: result.assignee ? {
            userId: result.assignee.userId,
            username: result.assignee.username,
            avatarUrl: result.assignee.avatarUrl,
            role: result.assignee.role,
          } : undefined // Dùng undefined thay vì null
        };
        
        // Broadcast event cập nhật
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('task-assignee-updated', { 
            detail: { 
              taskId,
              assigneeId: formattedResult.assignee_id,
              assignee: formattedResult.assignee
            } 
          });
          window.dispatchEvent(event);
        }
        
        setIsUpdating(false);
        return formattedResult;
      }
      
      setIsUpdating(false);
      // Trả về đúng kiểu dữ liệu cho Task interface
      return { task_id: taskId, assignee_id: undefined, assignee: undefined };
    } catch (err) {
      console.error('Lỗi khi cập nhật người được giao task:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsUpdating(false);
      throw err;
    }
  }, [apolloClient]);

  return {
    updateAssignee,
    isUpdating,
    error
  };
} 