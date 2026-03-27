import React from 'react';
import { TaskStatus } from '@/types/task';

interface TaskStatusBadgeProps {
  status: TaskStatus;
}

export default function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'todo':
        return 'bg-gray-100 text-gray-800';
      case 'doing':
        return 'bg-blue-100 text-blue-800';
      case 'done':
        return 'bg-green-100 text-green-800';
      case 'close':
        return 'bg-purple-100 text-purple-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'review':
        return 'bg-indigo-100 text-indigo-800';
      case 'blocked':
        return 'bg-red-100 text-red-800';
      case 'rejected':
        return 'bg-pink-100 text-pink-800';
      case 'archived':
        return 'bg-gray-300 text-gray-900';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: TaskStatus) => {
    switch (status) {
      case 'todo':
        return 'Cần làm';
      case 'doing':
        return 'Đang làm';
      case 'done':
        return 'Hoàn thành';
      case 'close':
        return 'Đóng';
      case 'pending':
        return 'Chờ xử lý';
      case 'review':
        return 'Đang kiểm tra';
      case 'blocked':
        return 'Bị chặn';
      case 'rejected':
        return 'Từ chối';
      case 'archived':
        return 'Đã lưu trữ';
      default:
        // Trong trường hợp mở rộng type nhưng chưa xử lý tất cả các case
        return String(status).charAt(0).toUpperCase() + String(status).slice(1);
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {getStatusLabel(status)}
    </span>
  );
} 