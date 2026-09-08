import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Task } from '@/types/task';
import { mockTasks } from '@/data/mockTasks';
import { UPDATE_TASK, REORDER_TASKS } from '@/graphql/mutations/tasks';
import { client } from '@/lib/apollo-client';
import { useApolloClient } from '@apollo/client';
import { useState, useCallback } from 'react';
import { transformTaskFromAPI } from '@/redux/features/tasksSlice';

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

interface ReorderInput {
  projectId: string;
  taskOrders: { taskId: string; priorityOrder: number }[];
  expectedOrder?: string[];
}

// Optional on the wire for old callers; Gantt supplies the full pre-edit order.
export const mapReorderInput = (input: ReorderInput) => ({
  project_id: input.projectId,
  ...(input.expectedOrder !== undefined ? { expected_order: input.expectedOrder } : {}),
  tasks: input.taskOrders.map((o) => ({
    task_id: o.taskId,
    priority_order: o.priorityOrder,
  })),
});

// Normalize the Rust [Task!] return contract into the shape the optimistic
// cache updater expects ({ taskId, priorityOrder }[]).
export const normalizeReorderResult = (result: any): { taskId: string; priorityOrder: number }[] => {
  if (!Array.isArray(result)) {
    throw new Error('reorder_tasks must return [Task!]');
  }
  return result
    .filter((t) => t && t.task_id != null)
    .map((t) => ({ taskId: t.task_id, priorityOrder: t.priority_order ?? 0 }));
};

const reorderTasksApi = async (input: ReorderInput) => {
  try {
    if (!input.projectId || !input.taskOrders?.length) {
      throw new Error('Invalid reorder tasks input');
    }
    const response = await client.mutate({
      mutation: REORDER_TASKS,
      variables: { input: mapReorderInput(input) },
    });
    if (response.errors?.length) {
      throw new Error(response.errors[0].message);
    }
    // Rust contract: reorder_tasks returns [Task!]
    return normalizeReorderResult(response.data?.reorder_tasks);
  } catch (error) {
    console.error('Failed to reorder tasks:', error);
    throw error instanceof Error ? error : new Error('Failed to reorder tasks');
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

// Timeline owns optimistic display order and Redux network recovery. The
// unrelated mock-backed React Query ['tasks'] cache is not a task authority.
export const useReorderTasks = () => useMutation(reorderTasksApi);

// API interface for updating task
export const updateTaskApi = async (taskId: string, updates: Partial<Task>) => {
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
    if (updates.progressCatalogItemId !== undefined) input.progress_catalog_item_id = updates.progressCatalogItemId;
    if (updates.categoryCatalogItemId !== undefined) input.category_catalog_item_id = updates.categoryCatalogItemId;
    if (updates.taskTypeCatalogItemId !== undefined) input.task_type_catalog_item_id = updates.taskTypeCatalogItemId;
    if (updates.tags !== undefined) input.tags = updates.tags;

    console.log("Input gửi đến GraphQL:", input);

    const response = await client.mutate({
      mutation: UPDATE_TASK,
      variables: { input },
      errorPolicy: 'all',
    });

    if (response.errors?.length) throw new Error(response.errors.map((error) => error.message).join('; '));
    if (!response.data?.update_task) throw new Error('Task update returned no task result.');

    // Result is already snake_case from backend
    const result = response.data.update_task;

    // Keep every mutation surface on the Redux task normalizer.
    return transformTaskFromAPI(result) as Task;
  } catch (error) {
    console.error('Không thể cập nhật công việc:', error);
    throw error instanceof Error ? error : new Error('Task update failed.');
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
