import { useMutation } from '@tanstack/react-query';
import { Task, TaskStatus } from '@/types/task';
import { queryClient } from '@/lib/queryClient';
import { useMutation as useApolloMutation } from '@apollo/client';
import { UPDATE_TASK_STATUS } from '@/graphql/mutations/tasks';

interface UpdateTaskStatusVariables {
  taskId: string;
  newStatus: TaskStatus;
  previousStatus: TaskStatus;
  projectId: string;
}

export function useTaskStatusUpdate() {
  const [updateTaskStatusMutation] = useApolloMutation(UPDATE_TASK_STATUS);

  return useMutation({
    mutationKey: ['updateTaskStatus'],
    mutationFn: async (variables: UpdateTaskStatusVariables) => {
      try {
        const tasks = queryClient.getQueryData<Task[]>(['tasks', variables.projectId]) || [];
        const task = tasks.find(t => t.task_id === variables.taskId || t.id === variables.taskId);

        if (!task) {
          throw new Error('Task not found');
        }

        console.log('Calling updateTaskStatus API with:', {
          taskId: variables.taskId,
          status: variables.newStatus.toLowerCase()
        });

        // Gọi API GraphQL để cập nhật task status
        const response = await updateTaskStatusMutation({
          variables: {
            input: {
              taskId: variables.taskId,
              status: variables.newStatus.toLowerCase()
            }
          }
        });

        const updatedTask = response.data?.updateTaskStatus;
        
        if (!updatedTask) {
          throw new Error('Failed to update task status');
        }

        console.log('Task status updated successfully:', updatedTask);
        
        // Chuyển đổi từ camelCase sang snake_case để phù hợp với định dạng UI
        return {
          ...task,
          status: variables.newStatus,
          updated_at: new Date().toISOString()
        };
      } catch (error) {
        console.error('Error updating task status:', error);
        throw error;
      }
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
          (task.task_id === variables.taskId || task.id === variables.taskId)
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
      // Phát event để thông báo cho các component khác
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('task-status-updated', {
          detail: {
            taskId: variables.taskId,
            newStatus: variables.newStatus,
            oldStatus: variables.previousStatus,
            projectId: variables.projectId
          }
        });
        window.dispatchEvent(event);
      }

      // Cập nhật cache react-query
      queryClient.setQueryData<Task[]>(
        ['tasks', variables.projectId],
        (oldTasks = []) => {
          return oldTasks.map(task =>
            (task.task_id === variables.taskId || task.id === variables.taskId)
              ? { ...task, status: variables.newStatus }
              : task
          );
        }
      );
    }
  });
}
