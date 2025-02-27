import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Task } from '@/types/task';
import { mockTasks } from '@/data/mockTasks';

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
    return Promise.resolve({ taskId, priorityOrder: newOrder });
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
                priorityOrder,
              };
            }
          });
          
          return updated.sort((a, b) => a.priorityOrder - b.priorityOrder);
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
