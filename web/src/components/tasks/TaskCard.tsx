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
    'todo': 'bg-gray-100 text-gray-800',
    'doing': 'bg-blue-100 text-blue-800',
    'done': 'bg-green-100 text-green-800',
    'close': 'bg-green-100 text-green-800',
    'pending': 'bg-yellow-100 text-yellow-800',
    'review': 'bg-purple-100 text-purple-800',
    'blocked': 'bg-red-100 text-red-800',
    'rejected': 'bg-red-100 text-red-800'
  };

  const priorityColors: Record<string, string> = {
    'low': 'bg-green-100 text-green-800',
    'medium': 'bg-yellow-100 text-yellow-800',
    'high': 'bg-orange-100 text-orange-800',
    'urgent': 'bg-red-100 text-red-800',
    'critical': 'bg-red-100 text-red-800 font-bold'
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
            {task.status === 'todo' ? 'Chưa làm' : 
             task.status === 'doing' ? 'Đang làm' : 
             task.status === 'done' ? 'Hoàn thành' : 
             task.status === 'pending' ? 'Chờ xử lý' : 
             task.status === 'review' ? 'Đang xem xét' : 
             task.status === 'blocked' ? 'Bị chặn' : 
             task.status === 'rejected' ? 'Từ chối' : 
             task.status === 'close' ? 'Đã đóng' : 
             task.status}
          </span>
          
          <span className={clsx(
            'text-xs px-2 py-0.5 rounded-full',
            priorityColors[task.priority] || 'bg-gray-100'
          )}>
            {task.priority === 'low' ? 'Thấp' : 
             task.priority === 'medium' ? 'Trung bình' : 
             task.priority === 'high' ? 'Cao' : 
             task.priority === 'urgent' ? 'Khẩn cấp' : 
             task.priority === 'critical' ? 'Nghiêm trọng' : 
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
