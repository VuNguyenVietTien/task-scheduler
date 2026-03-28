import { useCallback, useState } from 'react';
import { client } from '@/lib/apollo-client';
import { gql } from '@apollo/client';
import { Task } from '@/types/task';

// Định nghĩa mutation riêng cho việc cập nhật effort
const UPDATE_TASK_EFFORT = gql`
  mutation UpdateTaskEffort($input: UpdateTaskEffortInput!) {
    update_task_effort(input: $input) {
      task_id
      effort
    }
  }
`;

// Hook chuyên biệt để cập nhật effort mà không ảnh hưởng tới các trường khác
export function useUpdateTaskEffort() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateEffort = useCallback(async (taskId: string, effort: number) => {
    setIsUpdating(true);
    setError(null);
    
    try {
      // Trích xuất các thông tin task hiện tại từ cache (nếu có)
      const taskFromCache = getTaskFromCache(taskId);
      
      // Chuẩn bị input chỉ chứa taskId và effort
      const input = {
        task_id: taskId,
        effort: Number(effort)
      };
      
      console.log(`Đang cập nhật công sức: ${effort} cho task ID: ${taskId}`);
      
      // Thực hiện api call
      const response = await client.mutate({
        mutation: UPDATE_TASK,
        variables: { input },
        errorPolicy: 'all',
        optimisticResponse: {
          update_task: {
            __typename: 'Task',
            task_id: taskId,
            effort: Number(effort),
            assignee: taskFromCache?.assignee,
            // no assignee_id needed
          }
        }
      });
      
      if (response.errors) {
        console.warn("GraphQL errors:", response.errors);
        if (!response.data) {
          throw new Error(response.errors[0].message);
        }
      }
      
      // Xử lý kết quả
      const result = response.data?.update_task;

      if (result) {
        const formattedResult = {
          task_id: result.task_id,
          effort: result.effort,
          // Đảm bảo giữ nguyên thông tin assignee
          assignee: result.assignee || taskFromCache?.assignee,
          // assignee_id derived from assignee.user_id if needed
        };
        
        // Broadcast event để thông báo cập nhật
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('task-effort-updated', { 
            detail: { 
              taskId,
              effort: formattedResult.effort,
              // Thêm thông tin của assignee để các component khác có thể giữ nguyên
              assignee: formattedResult.assignee,
              assigneeId: (formattedResult.assignee as any)?.user_id
            } 
          });
          window.dispatchEvent(event);
        }
        
        setIsUpdating(false);
        return formattedResult;
      }
      
      setIsUpdating(false);
      return { 
        task_id: taskId, 
        effort,
        // Giữ nguyên thông tin assignee từ cache
        assignee: taskFromCache?.assignee, 
        // no assignee_id needed 
      };
    } catch (err) {
      console.error('Lỗi khi cập nhật công sức task:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsUpdating(false);
      throw err;
    }
  }, []);

  // Hàm hỗ trợ để lấy thông tin task từ cache
  function getTaskFromCache(taskId: string): Partial<Task> | null {
    try {
      // Thử lấy từ local storage trước
      const tasksCache = localStorage.getItem('tasks-cache');
      if (tasksCache) {
        const tasks = JSON.parse(tasksCache);
        const task = tasks.find((t: any) => t.task_id === taskId);
        if (task) return task;
      }
      
      // Hoặc từ Apollo cache nếu có
      const cache = client.cache.extract();
      for (const key in cache) {
        if (key.includes('Task:') && key.includes(taskId)) {
          return cache[key] as Partial<Task>;
        }
      }
      
      return null;
    } catch (e) {
      console.error('Lỗi khi lấy task từ cache:', e);
      return null;
    }
  }

  return {
    updateEffort,
    isUpdating,
    error
  };
}

// Định nghĩa lại mutation UPDATE_TASK
const UPDATE_TASK = gql`
  mutation UpdateTask($input: UpdateTaskInput!) {
    update_task(input: $input) {
      task_id
      effort
      assignee {
        user_id
        username
        avatar_url
        role
      }
    }
  }
`; 