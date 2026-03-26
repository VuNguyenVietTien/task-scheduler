import { useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { GET_PROJECT_TASKS } from '@/graphql/queries/tasks';
import { Task } from '@/types/task';

const UPDATE_TASK_PRIORITY_ORDER = gql`
  mutation UpdateTaskPriorityOrder($taskId: ID!, $priorityOrder: Int!) {
    updateTaskPriorityOrder(taskId: $taskId, priorityOrder: $priorityOrder) {
      taskId
      projectId
      priorityOrder
      priority
      status
    }
  }
`;

interface UpdateTaskPriorityOrderResponse {
  updateTaskPriorityOrder: {
    taskId: string;
    projectId: string;
    priorityOrder: number;
    priority: string;
    status: string;
  };
}

interface UpdateTaskPriorityOrderVars {
  taskId: string;
  priorityOrder: number;
}

export function useTaskPriorityOrder() {
  const [updatePriorityOrder] = useMutation<UpdateTaskPriorityOrderResponse, UpdateTaskPriorityOrderVars>(
    UPDATE_TASK_PRIORITY_ORDER,
    {
      onError: (error) => {
        console.error('Error updating task priority order:', error);
      },
      update: (cache, { data }) => {
        if (!data?.updateTaskPriorityOrder) return;

        try {
          const { taskId, projectId, priorityOrder } = data.updateTaskPriorityOrder;

          const existingData = cache.readQuery<{ tasks: Task[] }>({
            query: GET_PROJECT_TASKS,
            variables: { projectId }
          });

          if (!existingData?.tasks) return;

          const updatedTasks = existingData.tasks.map(task => {
            if (task.task_id === taskId) {
              return {
                ...task,
                priority_order: priorityOrder
              };
            }
            return task;
          });

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
    }
  );

  const reorderTask = async (taskId: string, newPriorityOrder: number) => {
    try {
      await updatePriorityOrder({
        variables: {
          taskId,
          priorityOrder: newPriorityOrder
        }
      });
    } catch (error) {
      console.error('Failed to update task priority order:', error);
      throw error;
    }
  };

  return { reorderTask };
}