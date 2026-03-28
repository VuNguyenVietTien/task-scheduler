import React from 'react';
import { TaskStatus } from '@/types/task';

interface TaskStatusBadgeProps {
  status: TaskStatus;
}

export default function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'TODO':
        return 'bg-gray-100 text-gray-800';
      case 'DOING':
        return 'bg-blue-100 text-blue-800';
      case 'DONE':
        return 'bg-green-100 text-green-800';
      case 'CLOSE':
        return 'bg-purple-100 text-purple-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'REVIEW':
        return 'bg-indigo-100 text-indigo-800';
      case 'BLOCKED':
        return 'bg-red-100 text-red-800';
      case 'REJECTED':
        return 'bg-pink-100 text-pink-800';
      case 'ARCHIVED':
        return 'bg-gray-300 text-gray-900';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: TaskStatus) => {
    switch (status) {
      case 'TODO':
        return 'Cần làm';
      case 'DOING':
        return 'Đang làm';
      case 'DONE':
        return 'Hoàn thành';
      case 'CLOSE':
        return 'Đóng';
      case 'PENDING':
        return 'Chờ xử lý';
      case 'REVIEW':
        return 'Đang kiểm tra';
      case 'BLOCKED':
        return 'Bị chặn';
      case 'REJECTED':
        return 'Từ chối';
      case 'ARCHIVED':
        return 'Đã lưu trữ';
      default:
        // Trong trường hợp mở rộng type nhưng chưa xử lý tất cả các case
        return String(status).charAt(0).toUpperCase() + String(status).slice(1).toLowerCase();
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {getStatusLabel(status)}
    </span>
  );
}
