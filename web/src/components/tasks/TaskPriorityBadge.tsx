import React from 'react';
import { Priority } from '@/types/task';

interface TaskPriorityBadgeProps {
  priority: Priority;
}

export default function TaskPriorityBadge({ priority }: TaskPriorityBadgeProps) {
  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-blue-100 text-blue-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'critical':
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityLabel = (priority: Priority) => {
    switch (priority) {
      case 'low':
        return 'Thấp';
      case 'medium':
        return 'Trung bình';
      case 'high':
        return 'Cao';
      case 'urgent':
        return 'Khẩn cấp';
      case 'critical':
        return 'Rất khẩn cấp';
      default:
        // Trong trường hợp mở rộng type nhưng chưa xử lý tất cả các case
        return String(priority).charAt(0).toUpperCase() + String(priority).slice(1);
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(priority)}`}>
      {getPriorityLabel(priority)}
    </span>
  );
} 