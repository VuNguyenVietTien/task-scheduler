import React from 'react';
import Link from 'next/link';
import { Task, TaskStatus } from '@/types/task';
import clsx from 'clsx';

interface TaskCardProps {
  task: Task;
  onClick: (taskId: string) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}

export const TaskCard = ({ task, onClick, onStatusChange }: TaskCardProps) => {
  const taskId = task.id || task.task_id || '';
  const projectId = task.project_id;
  
  // Sử dụng dynamic routing NextJS để tạo đường dẫn
  const taskDetailUrl = `/projects/${projectId}/tasks/${taskId}`;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick(taskId);
  };

  const isOverdue = task.deadline && new Date(task.deadline) < new Date();
  const isNearDeadline = task.deadline && 
    new Date(task.deadline).getTime() - Date.now() < 24 * 60 * 60 * 1000;

  const statusColors: Record<string, string> = {
    'TODO': 'bg-gray-100 text-gray-800',
    'DOING': 'bg-blue-100 text-blue-800',
    'DONE': 'bg-green-100 text-green-800',
    'CLOSE': 'bg-green-100 text-green-800',
    'PENDING': 'bg-yellow-100 text-yellow-800',
    'REVIEW': 'bg-purple-100 text-purple-800',
    'BLOCKED': 'bg-red-100 text-red-800',
    'REJECTED': 'bg-red-100 text-red-800'
  };

  const priorityColors: Record<string, string> = {
    'LOW': 'bg-green-100 text-green-800',
    'MEDIUM': 'bg-yellow-100 text-yellow-800',
    'HIGH': 'bg-orange-100 text-orange-800',
    'URGENT': 'bg-red-100 text-red-800',
    'CRITICAL': 'bg-red-100 text-red-800 font-bold'
  };

  return (
    <Link 
      href={taskDetailUrl}
      className="block"
      prefetch={false} // Không prefetch để tối ưu hiệu suất
      shallow={true} // Sử dụng shallow routing để không tải lại layout
    >
      <div 
        className="bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 h-full cursor-pointer"
        onClick={handleClick}
        aria-label={`Task: ${task.title}`}
      >
        <h3 className="text-lg font-medium mb-2 text-gray-900 line-clamp-2" title={task.title}>
          {task.title}
        </h3>
        
        <div className="flex flex-wrap gap-2 mb-2">
          <span className={clsx(
            'text-xs px-2 py-0.5 rounded-full',
            statusColors[task.status] || 'bg-gray-100'
          )}>
            {task.status === 'TODO' ? 'Chưa làm' :
             task.status === 'DOING' ? 'Đang làm' :
             task.status === 'DONE' ? 'Hoàn thành' :
             task.status === 'PENDING' ? 'Chờ xử lý' :
             task.status === 'REVIEW' ? 'Đang xem xét' :
             task.status === 'BLOCKED' ? 'Bị chặn' :
             task.status === 'REJECTED' ? 'Từ chối' :
             task.status === 'CLOSE' ? 'Đã đóng' :
             task.status}
          </span>
          
          <span className={clsx(
            'text-xs px-2 py-0.5 rounded-full',
            priorityColors[task.priority] || 'bg-gray-100'
          )}>
            {task.priority === 'LOW' ? 'Thấp' :
             task.priority === 'MEDIUM' ? 'Trung bình' :
             task.priority === 'HIGH' ? 'Cao' :
             task.priority === 'URGENT' ? 'Khẩn cấp' :
             task.priority === 'CRITICAL' ? 'Nghiêm trọng' :
             task.priority}
          </span>
        </div>
        
        {/* Hiển thị ngày hết hạn nếu có */}
        {task.due_date && (
          <div className="text-xs text-gray-500 mb-2">
            Hết hạn: {new Date(task.due_date).toLocaleDateString('vi-VN')}
          </div>
        )}
        
        {/* Hiển thị người được giao nếu có */}
        {task.assignee && task.assignee.userId && (
          <div className="flex items-center mt-2">
            <div className="flex -space-x-1 overflow-hidden">
              <div className="inline-block h-6 w-6 rounded-full ring-2 ring-white overflow-hidden bg-gray-200 flex items-center justify-center">
                {task.assignee.avatarUrl ? (
                  <img src={task.assignee.avatarUrl} alt={task.assignee.username || ''} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs font-medium">
                    {task.assignee.username ? task.assignee.username.charAt(0).toUpperCase() : '?'}
                  </span>
                )}
              </div>
            </div>
            <span className="text-xs ml-2 text-gray-600 truncate">
              {task.assignee.username || 'Không xác định'}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
};
