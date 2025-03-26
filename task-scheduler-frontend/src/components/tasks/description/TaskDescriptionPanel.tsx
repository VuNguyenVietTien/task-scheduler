'use client';

import React, { useState, useEffect } from 'react';
import { Task } from '@/types/task';
import TaskDescription from './TaskDescription';
import { UPDATE_TASK } from '@/graphql/mutations/tasks';
import { useMutation } from '@apollo/client';
import { toast } from 'react-hot-toast';

interface TaskDescriptionPanelProps {
  task: Task;
  onTaskUpdated?: (updatedTask: Task) => void;
  className?: string;
}

export default function TaskDescriptionPanel({ 
  task, 
  onTaskUpdated,
  className = ''
}: TaskDescriptionPanelProps) {
  const [currentTask, setCurrentTask] = useState<Task>(task);
  
  // Update task mutation
  const [updateTask, { loading: updateLoading }] = useMutation(UPDATE_TASK);
  
  // Cập nhật currentTask khi task thay đổi
  useEffect(() => {
    setCurrentTask(task);
  }, [task]);
  
  // Hàm cập nhật task chỉ khi cần thiết, không làm refetch các dữ liệu khác
  const handleTaskUpdate = async (updates: Partial<Task>): Promise<boolean> => {
    try {
      console.log('Cập nhật task với dữ liệu:', updates);
      
      // Lấy ID của task
      const taskId = task.task_id || task.id;
      if (!taskId) {
        console.error('Không tìm thấy ID của task');
        return false;
      }
      
      console.log(`Gọi GraphQL mutation updateTask với taskId=${taskId}`);
      
      // Tạo mutation variables
      const variables = {
        input: {
          taskId,
          ...updates
        }
      };
      
      console.log('Variables cho mutation:', JSON.stringify(variables));
      
      // Gọi mutation để cập nhật task
      const { data } = await updateTask({
        variables,
        // Chỉ cập nhật cache nếu cần thiết, không làm refetch
        update: (cache, { data }) => {
          if (data?.updateTask) {
            console.log('Mutation trả về data thành công:', data.updateTask);
            // Cập nhật state local
            const updatedTask = {
              ...currentTask,
              ...updates
            };
            setCurrentTask(updatedTask);
            
            // Callback để thông báo task đã được cập nhật
            if (onTaskUpdated) {
              onTaskUpdated(updatedTask);
            }
          } else {
            console.warn('Mutation không trả về data');
          }
        }
      });
      
      console.log('Kết quả mutation:', data);
      
      if (data?.updateTask) {
        toast.success('Cập nhật mô tả thành công!');
        return true;
      } else {
        console.error('Mutation thành công nhưng không có data');
        toast.error('Không thể cập nhật mô tả');
        return false;
      }
    } catch (error) {
      console.error('Lỗi khi cập nhật task:', error);
      console.error('Chi tiết lỗi:', JSON.stringify(error));
      toast.error('Đã xảy ra lỗi khi cập nhật mô tả');
      return false;
    }
  };
  
  return (
    <div className={`task-description-panel ${className}`}>
      <TaskDescription 
        task={currentTask}
        onUpdate={handleTaskUpdate}
      />
    </div>
  );
} 