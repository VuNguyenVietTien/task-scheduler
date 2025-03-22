import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Task, TaskStatus, Priority } from '@/types/task';
import { mockTasks } from '@/data/mockTasks';
import { UPDATE_TASK } from '@/graphql/mutations/tasks';
import { client } from '@/lib/apollo-client';
import { useApolloClient } from '@apollo/client';
import { useState, useCallback } from 'react';

// Function to fetch tasks
const fetchTasks = async (): Promise<Task[]> => {
  // For now, using mock data
  return Promise.resolve(mockTasks);
};

// Hook to get tasks
export const useTasks = () => {
  return useQuery(['tasks'], fetchTasks);
};

// API interface for task priority management
const updateTaskPriorityOrderApi = async (taskId: string, newOrder: number) => {
  try {
    // Simulated API call
    return Promise.resolve({ taskId, priority_order: newOrder });
  } catch (error) {
    console.error('Failed to update task priority:', error);
    throw new Error('Failed to update task priority order');
  }
};

const reorderTasksApi = async (input: { 
  projectId: string; 
  taskOrders: { taskId: string; priorityOrder: number }[] 
}) => {
  try {
    if (!input.projectId || !input.taskOrders?.length) {
      throw new Error('Invalid reorder tasks input');
    }
    return Promise.resolve(input.taskOrders);
  } catch (error) {
    console.error('Failed to reorder tasks:', error);
    throw new Error('Failed to reorder tasks');
  }
};

export const useUpdateTaskPriorityOrder = () => {
  const queryClient = useQueryClient();

  return useMutation(
    async ({ taskId, newOrder }: { taskId: string; newOrder: number }) => {
      return updateTaskPriorityOrderApi(taskId, newOrder);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['tasks']);
      },
    }
  );
};

export const useReorderTasks = () => {
  const queryClient = useQueryClient();

  return useMutation(
    async (input: { projectId: string; taskOrders: { taskId: string; priorityOrder: number }[] }) => {
      return reorderTasksApi(input);
    },
    {
      onMutate: async (newData) => {
        await queryClient.cancelQueries(['tasks']);
        const previousTasks = queryClient.getQueryData<Task[]>(['tasks']);

        queryClient.setQueryData<Task[]>(['tasks'], (old) => {
          if (!old) return old;
          
          const updated = [...old];
          newData.taskOrders.forEach(({ taskId, priorityOrder }) => {
            const taskIndex = updated.findIndex(t => t.id === taskId);
            if (taskIndex !== -1) {
              updated[taskIndex] = {
                ...updated[taskIndex],
                priority_order: priorityOrder,
              };
            }
          });
          
          return updated.sort((a, b) => a.priority_order - b.priority_order);
        });

        return { previousTasks };
      },
      onError: (err, newData, context) => {
        if (context?.previousTasks) {
          console.warn('Rolling back task reorder due to error');
          queryClient.setQueryData(['tasks'], context.previousTasks);
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries(['tasks']);
      },
    }
  );
};

// API interface for updating task
const updateTaskApi = async (taskId: string, updates: Partial<Task>) => {
  try {
    // Chuyển đổi các khóa từ snake_case sang camelCase cho GraphQL API và đảm bảo kiểu dữ liệu đúng
    const input: Record<string, any> = {
      taskId,
    };

    // Thêm các trường cập nhật nếu có - CHỈ khi chúng thực sự tồn tại và khác undefined
    if (updates.title !== undefined) input.title = updates.title;
    if (updates.description !== undefined) input.description = updates.description;
    
    // Xử lý đặc biệt cho các trường enum - cần giữ nguyên dạng (UPPERCASE) hoặc lowercase tùy backend
    if (updates.status !== undefined) {
      // Quan trọng: Chuyển đổi giống như cách làm trong KanbanBoard
      // Chuyển từ snake_case sang UPPER_CASE cho API GraphQL
      const statusMapping: Record<string, string> = {
        'todo': 'TODO',
        'doing': 'DOING',
        'done': 'DONE',
        'close': 'CLOSE',
        'pending': 'PENDING',
        'review': 'REVIEW',
        'blocked': 'BLOCKED',
        'rejected': 'REJECTED',
        'archived': 'ARCHIVED'
      };
      
      // Đảm bảo status là lowercase để khớp với mapping
      const statusKey = String(updates.status).toLowerCase();
      // Sau đó chuyển thành dạng UPPER_CASE cho GraphQL API
      input.status = statusMapping[statusKey] || statusKey.toUpperCase();
      console.log(`Status đã chuyển đổi thành: ${input.status} (gốc: ${updates.status})`);
    }
    
    if (updates.priority !== undefined) {
      // Tương tự với priority - chuyển thành dạng UPPER_CASE cho API
      const priorityMapping: Record<string, string> = {
        'low': 'LOW',
        'medium': 'MEDIUM',
        'high': 'HIGH',
        'urgent': 'URGENT',
        'critical': 'CRITICAL'
      };
      
      const priorityKey = String(updates.priority).toLowerCase();
      input.priority = priorityMapping[priorityKey] || priorityKey.toUpperCase();
      console.log(`Priority đã chuyển đổi thành: ${input.priority} (gốc: ${updates.priority})`);
    }
    
    if (updates.effort !== undefined) input.effort = Number(updates.effort);
    if (updates.progress !== undefined) input.progress = Number(updates.progress);
    
    // Chuyển đổi các trường date từ snake_case sang camelCase
    if (updates.start_date !== undefined) input.startDate = updates.start_date;
    if (updates.due_date !== undefined) input.dueDate = updates.due_date;
    if (updates.actual_start_date !== undefined) input.actualStartDate = updates.actual_start_date;
    if (updates.actual_end_date !== undefined) input.actualEndDate = updates.actual_end_date;
    
    // Các trường khác - CHỚ GỬI undefined hoặc null trừ khi thực sự muốn đặt trường về null
    // Đối với assignee_id, CHỈ gửi khi nó được cung cấp trong updates, không gửi undefined
    // vì backend sẽ hiểu undefined là null và xóa assignee hiện tại
    if (updates.assignee_id !== undefined) {
      // Nếu assignee_id là chuỗi rỗng, chuyển thành null
      input.assigneeId = updates.assignee_id === '' ? null : updates.assignee_id;
    }
    
    if (updates.priority_order !== undefined) input.priorityOrder = Number(updates.priority_order);
    if (updates.type !== undefined) input.type = updates.type;
    if (updates.category !== undefined) input.category = updates.category;
    
    // Xử lý đặc biệt cho progress_type - tương tự như status và priority
    if (updates.progress_type !== undefined) {
      const progressTypeMapping: Record<string, string> = {
        'percentage': 'PERCENTAGE',
        'points': 'POINTS',
        'binary': 'BINARY'
      };
      
      const progressTypeKey = String(updates.progress_type).toLowerCase();
      input.progressType = progressTypeMapping[progressTypeKey] || progressTypeKey.toUpperCase();
      console.log(`ProgressType đã chuyển đổi thành: ${input.progressType} (gốc: ${updates.progress_type})`);
    }
    
    if (updates.tags !== undefined) input.tags = updates.tags;

    console.log("Input gửi đến GraphQL:", input);

    // Chuẩn bị optimistic response để cập nhật UI ngay lập tức
    const optimisticResponse = {
      updateTask: {
        __typename: 'Task',
        ...input,
        // Thêm các trường cần thiết từ task hiện tại
        taskId: taskId,
        // Các trường khác không thay đổi
      }
    };

    // Gọi API GraphQL thực tế
    const response = await client.mutate({
      mutation: UPDATE_TASK,
      variables: { input },
      errorPolicy: 'all', // Cho phép vẫn nhận được response kể cả khi có lỗi
      optimisticResponse
    });

    if (response.errors) {
      console.warn("GraphQL errors:", response.errors);
      // Vẫn tiếp tục xử lý nếu có dữ liệu
      if (!response.data) {
        throw new Error(response.errors[0].message);
      }
    }

    // Dự phòng nếu không nhận được dữ liệu từ API
    if (!response.data || !response.data.updateTask) {
      // Trả về dữ liệu cục bộ đã được cập nhật
      console.warn("Không nhận được dữ liệu từ API, sử dụng dữ liệu cục bộ");
      return {
        ...updates,
        task_id: taskId
      } as Task;
    }

    // Kết quả từ API đã được chuyển đổi từ dạng enum thành string trong backend
    const result = response.data.updateTask;
    
    // Chuyển đổi từ camelCase về snake_case cho phù hợp với frontend
    const formattedResult: Partial<Task> = {
      task_id: result.taskId,
      project_id: result.projectId,
      parent_task_id: result.parentTaskId,
      title: result.title,
      description: result.description,
      // Đảm bảo status và priority được chuyển đổi đúng - chuyển về lowercase để khớp với enum ở frontend
      status: result.status?.toLowerCase() as TaskStatus,
      priority: result.priority?.toLowerCase() as Priority,
      priority_order: result.priorityOrder,
      start_date: result.startDate,
      due_date: result.dueDate,
      actual_start_date: result.actualStartDate,
      actual_end_date: result.actualEndDate,
      effort: result.effort,
      progress: result.progress,
      assignee_id: result.assignee?.userId,
      assignee: result.assignee ? {
        userId: result.assignee.userId,
        username: result.assignee.username,
        avatarUrl: result.assignee.avatarUrl,
        role: result.assignee.role,
      } : undefined,
      created_by: result.createdBy,
      created_at: result.createdAt,
      updated_at: result.updatedAt,
      is_deleted: result.isDeleted,
      type: result.type,
      category: result.category,
      progress_type: result.progressType?.toLowerCase() as any,
      tags: result.tags,
    };

    console.log("Kết quả nhận từ GraphQL:", result);
    console.log("Dữ liệu được định dạng lại:", formattedResult);

    // Trả về kết quả từ API đã được định dạng lại
    return formattedResult as Task;
  } catch (error) {
    console.error('Không thể cập nhật công việc:', error);
    // Vẫn trả về dữ liệu cục bộ đã cập nhật để UI có thể hiển thị
    const fallbackResult = {
      ...updates,
      task_id: taskId
    };
    console.log("Sử dụng dữ liệu dự phòng:", fallbackResult);
    return fallbackResult as Task;
  }
};

// Hook để cập nhật task
export function useUpdateTask() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Gọi cache của Apollo Client để cập nhật dữ liệu
  const apolloClient = useApolloClient();

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    setIsUpdating(true);
    setError(null);
    
    try {
      // Gọi API để cập nhật task
      const response = await updateTaskApi(taskId, updates);

      // Cập nhật cache trực tiếp để đảm bảo UI được cập nhật
      try {
        // Lấy query hiện tại từ cache
        const cache = apolloClient.cache;
        const queryTasks = cache.extract();
        
        // Log debug
        console.log('Đang cập nhật cache cho taskId:', taskId);
        console.log('Dữ liệu cập nhật:', response);
        
        // Broadcast event để thông báo cho các component khác về việc cập nhật
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('task-updated', { 
            detail: { 
              taskId: response.task_id,
              updates: response
            } 
          });
          window.dispatchEvent(event);
        }
      } catch (cacheError) {
        console.error('Lỗi khi cập nhật cache:', cacheError);
      }
      
      // Lưu trữ cập nhật trong localStorage để duy trì trạng thái mới nhất
      // Điều này giúp duy trì dữ liệu đã cập nhật ngay cả khi có refresh
      try {
        const tasksInStorage = localStorage.getItem('tasks-cache');
        if (tasksInStorage) {
          const parsedTasks = JSON.parse(tasksInStorage);
          const taskIndex = parsedTasks.findIndex((t: any) => t.task_id === taskId);
          
          if (taskIndex !== -1) {
            // Cập nhật task trong storage
            parsedTasks[taskIndex] = {
              ...parsedTasks[taskIndex],
              ...response
            };
            
            // Lưu lại vào localStorage
            localStorage.setItem('tasks-cache', JSON.stringify(parsedTasks));
            console.log('Đã cập nhật tasks-cache trong localStorage');
          }
        }
      } catch (storageError) {
        console.warn('Không thể cập nhật localStorage:', storageError);
      }
      
      setIsUpdating(false);
      return response;
    } catch (err) {
      console.error('Lỗi khi cập nhật task:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsUpdating(false);
      throw err;
    }
  }, [apolloClient]);

  return {
    updateTask,
    isUpdating,
    error
  };
}
