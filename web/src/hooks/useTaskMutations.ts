import { useMutation, ApolloCache } from '@apollo/client';
import { UPDATE_TASK_STATUS } from '@/graphql/mutations/tasks';
import { GET_PROJECT_TASKS } from '@/graphql/queries/tasks';
import { Task } from '@/types/task';

interface UpdateTaskStatusResponse {
  update_task_status: {
    task_id: string;
    project_id: string;
    status: string;
    [key: string]: any;
  };
}

interface UpdateTaskStatusVars {
  input: {
    task_id: string;
    status: string;
  };
}

export function useUpdateTaskStatus() {
  return useMutation<UpdateTaskStatusResponse, UpdateTaskStatusVars>(UPDATE_TASK_STATUS, {
    onError: (error) => {
      console.error('Error updating task status:', error);
    },
    onCompleted: (data) => {
      console.log('Task status updated:', data);

      // Broadcast an event to notify other components about the status change
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('task-status-updated', {
          detail: {
            taskId: data.update_task_status.task_id,
            newStatus: data.update_task_status.status,
            projectId: data.update_task_status.project_id
          }
        });
        window.dispatchEvent(event);
      }
    },
    update: (cache: ApolloCache<any>, { data }) => {
      if (!data?.update_task_status) return;

      const updatedTask = data.update_task_status;
      const projectId = updatedTask.project_id;
      
      try {
        // Read current cache
        const existingData = cache.readQuery<{ tasks: Task[] }>({
          query: GET_PROJECT_TASKS,
          variables: { projectId }
        });

        if (!existingData?.tasks) return;

        // Create updated task list
        const updatedTasks = existingData.tasks.map(task =>
          task.task_id === updatedTask.task_id
            ? { ...task, status: updatedTask.status }
            : task
        );

        // Write updated list back to cache
        cache.writeQuery({
          query: GET_PROJECT_TASKS,
          variables: { projectId },
          data: { tasks: updatedTasks }
        });
        
        // Forcefully mark the cache as changed to trigger UI updates
        cache.modify({
          fields: {
            tasks: (existingTasks = []) => {
              return [...updatedTasks];
            },
          },
        });
        
        // Also update any individual task queries if they exist
        const taskCacheId = cache.identify({
          __typename: 'Task',
          task_id: updatedTask.task_id,
        });
        
        if (taskCacheId) {
          cache.modify({
            id: taskCacheId,
            fields: {
              status: () => updatedTask.status,
            },
          });
        }
      } catch (error) {
        console.error('Error updating cache:', error);
      }
    },
    refetchQueries: (result) => {
      if (result.data?.update_task_status) {
        const projectId = result.data.update_task_status.project_id;
        if (projectId) {
          return [
            {
              query: GET_PROJECT_TASKS,
              variables: { projectId },
              fetchPolicy: 'network-only' // Force refetch from network
            }
          ];
        }
      }
      return [];
    },
    awaitRefetchQueries: true
  });
}

export interface UpdateTaskStatusInput {
  taskId: string;
  status: Task['status'];
}