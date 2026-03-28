import { useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { GET_PROJECT_TASKS } from '@/graphql/queries/tasks';
import { Task } from '@/types/task';

const UPDATE_TASK_PRIORITY_ORDER = gql`
  mutation UpdateTaskPriorityOrder($input: UpdateTaskInput!) {
    update_task(input: $input) {
      task_id
      project_id
      priority_order
      priority
      status
    }
  }
`;

interface UpdateTaskPriorityOrderResponse {
  update_task: {
    task_id: string;
    project_id: string;
    priority_order: number;
    priority: string;
    status: string;
  };
}

interface UpdateTaskPriorityOrderVars {
  input: {
    task_id: string;
    priority_order: number;
  };
}

export function useTaskPriorityOrder() {
  const [updatePriorityOrder] = useMutation<UpdateTaskPriorityOrderResponse, UpdateTaskPriorityOrderVars>(
    UPDATE_TASK_PRIORITY_ORDER,
    {
      onError: (error) => {
        console.error('Error updating task priority order:', error);
      },
      update: (cache, { data }) => {
        if (!data?.update_task) return;

        try {
          const { task_id, project_id, priority_order } = data.update_task;

          const existingData = cache.readQuery<{ tasks: Task[] }>({
            query: GET_PROJECT_TASKS,
            variables: { projectId: project_id }
          });

          if (!existingData?.tasks) return;

          const updatedTasks = existingData.tasks.map(task => {
            if (task.task_id === task_id) {
              return {
                ...task,
                priority_order
              };
            }
            return task;
          });

          cache.writeQuery({
            query: GET_PROJECT_TASKS,
            variables: { projectId: project_id },
            data: {
              tasks: updatedTasks
            }
          });
        } catch (error) {
          console.error('Error updating cache:', error);
        }
      }
    }
  );

  const reorderTask = async (taskId: string, newPriorityOrder: number) => {
    try {
      await updatePriorityOrder({
        variables: {
          input: {
            task_id: taskId,
            priority_order: newPriorityOrder
          }
        }
      });
    } catch (error) {
      console.error('Failed to update task priority order:', error);
      throw error;
    }
  };

  return { reorderTask };
}
