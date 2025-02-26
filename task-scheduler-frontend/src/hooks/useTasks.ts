/**
 * Task Management Hooks
 * 
 * IMPORTANT: These hooks manage task ordering functionality that is critical
 * for the Gantt chart drag & drop feature. The reordering system maintains
 * synchronization between:
 * 1. Visual order in the priority task list
 * 2. Task bar positions in the Gantt chart
 * 3. Priority orders in the backend
 * 
 * Key Components:
 * - useReorderTasks: Handles bulk reordering of tasks (used by drag & drop)
 * - useUpdateTaskPriorityOrder: Handles single task priority updates
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Task } from '@/types/task';

// API interface for task priority management
/**
 * Updates the priority order of a single task
 * @param taskId The ID of the task to update
 * @param newOrder The new priority order value
 * @returns Promise resolving to the updated task data
 */
const updateTaskPriorityOrderApi = async (taskId: string, newOrder: number) => {
  try {
    // Simulated API call
    return Promise.resolve({ taskId, priorityOrder: newOrder });
  } catch (error) {
    console.error('Failed to update task priority:', error);
    throw new Error('Failed to update task priority order');
  }
};

/**
 * Bulk updates priority orders for multiple tasks
 * IMPORTANT: This is used by the drag & drop reordering feature
 * @param input Object containing projectId and array of task orders
 * @returns Promise resolving to the updated task orders
 */
const reorderTasksApi = async (input: { 
  projectId: string; 
  taskOrders: { taskId: string; priorityOrder: number }[] 
}) => {
  try {
    // Validate input
    if (!input.projectId || !input.taskOrders?.length) {
      throw new Error('Invalid reorder tasks input');
    }

    // Simulated API call
    return Promise.resolve(input.taskOrders);
  } catch (error) {
    console.error('Failed to reorder tasks:', error);
    throw new Error('Failed to reorder tasks');
  }
};

/**
 * Hook for updating a single task's priority order
 * @returns Mutation object for updating task priority
 */
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

/**
 * Hook for reordering multiple tasks via drag & drop
 * IMPORTANT: This hook is essential for the Gantt chart drag & drop functionality
 * It maintains consistency between the UI order and backend priority values
 * @returns Mutation object for reordering tasks
 */
export const useReorderTasks = () => {
  const queryClient = useQueryClient();

  return useMutation(
    async (input: { projectId: string; taskOrders: { taskId: string; priorityOrder: number }[] }) => {
      return reorderTasksApi(input);
    },
    {
      // Optimistically update UI while waiting for backend
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
        // Roll back to previous state if mutation fails
        if (context?.previousTasks) {
          console.warn('Rolling back task reorder due to error');
          queryClient.setQueryData(['tasks'], context.previousTasks);
        }
      },
      onSettled: () => {
        // Refetch after error or success
        queryClient.invalidateQueries(['tasks']);
      },
    }
  );
};
