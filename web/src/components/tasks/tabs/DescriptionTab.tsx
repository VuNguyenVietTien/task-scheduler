import React from 'react';
import { Task } from '@/types/task';
import TaskDescriptionPanel from '../description/TaskDescriptionPanel';

interface DescriptionTabProps {
  task: Task;
  onTaskUpdated?: (updatedTask: Task) => void;
}

export default function DescriptionTab({ task, onTaskUpdated }: DescriptionTabProps) {
  return (
    <div className="bg-white rounded-lg">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Mô tả</h2>
      <TaskDescriptionPanel 
        task={task} 
        onTaskUpdated={onTaskUpdated} 
      />
    </div>
  );
} 