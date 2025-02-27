import { useMutation } from '@tanstack/react-query';
import { Task, TaskStatus, TaskStatuses } from '@/types/task';
import { queryClient } from '@/lib/queryClient';

interface UpdateTaskStatusVariables {
  taskId: string;
  newStatus: TaskStatus;
  previousStatus: TaskStatus;
  projectId: string;
}

const mockApiCall = async (task: Task, newStatus: TaskStatus): Promise<Task> => {
  await new Promise(resolve => setTimeout(resolve, 200));
  return {
    ...task,
    status: newStatus,
    updatedAt: new Date().toISOString()
  };
};

export function useTaskStatusUpdate() {
  return useMutation({
    mutationKey: ['updateTaskStatus'],
    mutationFn: async (variables: UpdateTaskStatusVariables) => {
      const tasks = queryClient.getQueryData<Task[]>(['tasks', variables.projectId]) || [];
      const task = tasks.find(t => t.id === variables.taskId);

      if (!task) {
        throw new Error('Task not found');
      }

      const updatedTask = await mockApiCall(task, variables.newStatus);
      return updatedTask;
    },
    onMutate: async (variables) => {
      const queryKey = ['tasks', variables.projectId];
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey,
        exact: true
      });

      // Snapshot current value
      const previousTasks = queryClient.getQueryData<Task[]>(queryKey);

      // Optimistically update to the new value
      if (previousTasks) {
        const newTasks = previousTasks.map(task =>
          task.id === variables.taskId
            ? { ...task, status: variables.newStatus }
            : task
        );

        queryClient.setQueryData(queryKey, newTasks);
      }

      // Return context for rollback
      return { previousTasks };
    },
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        // Rollback to the snapshot on error
        queryClient.setQueryData(
          ['tasks', variables.projectId],
          context.previousTasks
        );
      }
    },
    onSuccess: (updatedTask, variables) => {
      // Synchronously update the cache with the server response
      queryClient.setQueryData<Task[]>(
        ['tasks', variables.projectId],
        (oldTasks = []) => {
          return oldTasks.map(task =>
            task.id === updatedTask.id ? updatedTask : task
          );
        }
      );
    }
  });
}
