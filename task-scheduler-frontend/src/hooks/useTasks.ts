import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Task } from '@/types/task';

// In a real app, these would be API calls
const updateTaskPriorityOrderApi = async (taskId: string, newOrder: number) => {
  // Simulated API call
  return Promise.resolve({ taskId, priorityOrder: newOrder });
};

const reorderTasksApi = async (input: { projectId: string; taskOrders: { taskId: string; priorityOrder: number }[] }) => {
  // Simulated API call
  return Promise.resolve(input.taskOrders);
};

export const useUpdateTaskPriorityOrder = () => {
  const queryClient = useQueryClient();

  return useMutation(
    async ({ taskId, newOrder }: { taskId: string; newOrder: number }) => {
      return updateTaskPriorityOrderApi(taskId, newOrder);
    },
    {
      onSuccess: () => {
        // Invalidate and refetch tasks query
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
        // Cancel outgoing refetches
        await queryClient.cancelQueries(['tasks']);

        // Snapshot current tasks
        const previousTasks = queryClient.getQueryData<Task[]>(['tasks']);

        // Optimistically update tasks order
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
        // Roll back on error
        queryClient.setQueryData(['tasks'], context?.previousTasks);
      },
      onSettled: () => {
        // Refetch after error or success
        queryClient.invalidateQueries(['tasks']);
      },
    }
  );
};
