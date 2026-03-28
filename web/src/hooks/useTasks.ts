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
    // Input uses snake_case to match backend schema
    const input: Record<string, any> = {
      task_id: taskId,
    };

    // Thêm các trường cập nhật nếu có - CHỈ khi chúng thực sự tồn tại và khác undefined
    if (updates.title !== undefined) input.title = updates.title;
    if (updates.description !== undefined) input.description = updates.description;
    
    if (updates.status !== undefined) {
      input.status = updates.status;
    }

    if (updates.priority !== undefined) {
      input.priority = updates.priority;
    }
    
    if (updates.effort !== undefined) input.effort = Number(updates.effort);
    if (updates.progress !== undefined) input.progress = Number(updates.progress);
    
    if (updates.start_date !== undefined) {
      input.start_date = updates.start_date ? new Date(updates.start_date).toISOString() : null;
    }

    if (updates.due_date !== undefined) {
      input.due_date = updates.due_date ? new Date(updates.due_date).toISOString() : null;
    }

    if (updates.actual_start_date !== undefined) {
      input.actual_start_date = updates.actual_start_date ? new Date(updates.actual_start_date).toISOString() : null;
    }

    if (updates.actual_end_date !== undefined) {
      input.actual_end_date = updates.actual_end_date ? new Date(updates.actual_end_date).toISOString() : null;
    }

    if (updates.assignee !== undefined) {
      input.assignee_id = updates.assignee?.userId || null;
    }

    if (updates.priority_order !== undefined) input.priority_order = Number(updates.priority_order);
    if (updates.type !== undefined) input.type_ = updates.type;
    if (updates.category !== undefined) input.category = updates.category;

    if (updates.progress_type !== undefined) {
      input.progress_type = String(updates.progress_type).toLowerCase();
    }
    
    if (updates.tags !== undefined) input.tags = updates.tags;

    console.log("Input gửi đến GraphQL:", input);

    const optimisticResponse = {
      update_task: {
        __typename: 'Task',
        ...input,
        task_id: taskId,
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
    if (!response.data || !response.data.update_task) {
      // Trả về dữ liệu cục bộ đã được cập nhật
      console.warn("Không nhận được dữ liệu từ API, sử dụng dữ liệu cục bộ");
      return {
        ...updates,
        task_id: taskId
      } as Task;
    }

    // Result is already snake_case from backend
    const result = response.data.update_task;

    const formattedResult: Partial<Task> = {
      task_id: result.task_id,
      project_id: result.project_id,
      parent_task_id: result.parent_task_id,
      title: result.title,
      description: result.description,
      status: result.status?.toUpperCase() as TaskStatus,
      priority: result.priority?.toUpperCase() as Priority,
      priority_order: result.priority_order,
      start_date: result.start_date,
      due_date: result.due_date,
      actual_start_date: result.actual_start_date,
      actual_end_date: result.actual_end_date,
      effort: result.effort,
      progress: result.progress,
      assignee: result.assignee ? {
        userId: result.assignee.user_id,
        username: result.assignee.username,
        avatarUrl: result.assignee.avatar_url,
        role: result.assignee.role,
      } : undefined,
      created_by: result.created_by,
      created_at: result.created_at,
      updated_at: result.updated_at,
      is_deleted: result.is_deleted,
      type: result.type_,
      category: result.category,
      progress_type: result.progress_type?.toLowerCase() as any,
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
