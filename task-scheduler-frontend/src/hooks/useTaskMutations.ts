import { useMutation, ApolloCache } from '@apollo/client';
import { UPDATE_TASK_STATUS } from '@/graphql/mutations/tasks';
import { GET_PROJECT_TASKS } from '@/graphql/queries/tasks';
import { Task } from '@/types/task';

interface UpdateTaskStatusResponse {
  updateTaskStatus: {
    task_id: string;
    project_id: string;
    status: string;
    [key: string]: any;
  };
}

interface UpdateTaskStatusVars {
  taskId: string;
  status: string;
}

export function useUpdateTaskStatus() {
  return useMutation<UpdateTaskStatusResponse, UpdateTaskStatusVars>(UPDATE_TASK_STATUS, {
    onError: (error) => {
      console.error('Error updating task status:', error);
    },
    onCompleted: (data) => {
      console.log('Task status updated:', data);
    },
    update: (cache: ApolloCache<any>, { data }) => {
      if (data?.updateTaskStatus) {
        const projectId = data.updateTaskStatus.project_id;
        if (!projectId) return;

        try {
          const existingData = cache.readQuery<{ tasks: Task[] }>({
            query: GET_PROJECT_TASKS,
            variables: { projectId }
          });

          if (!existingData?.tasks) return;

          const updatedTasks = existingData.tasks.map(task =>
            task.task_id === data.updateTaskStatus.task_id
              ? { ...task, ...data.updateTaskStatus }
              : task
          );

          cache.writeQuery({
            query: GET_PROJECT_TASKS,
            variables: { projectId },
            data: {
              tasks: updatedTasks
            }
          });
        } catch (error) {
          console.error('Error updating cache:', error);
        }
      }
    },
    refetchQueries: (result) => {
      if (result.data?.updateTaskStatus) {
        const projectId = result.data.updateTaskStatus.project_id;
        if (projectId) {
          return [
            {
              query: GET_PROJECT_TASKS,
              variables: { projectId }
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