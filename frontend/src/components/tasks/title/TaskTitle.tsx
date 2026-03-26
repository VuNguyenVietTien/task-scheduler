'use client';

import React, { useState, useEffect } from 'react';
import { PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Spinner } from '@/components/ui/Spinner';
import { Task } from '@/types/task';

interface TaskTitleProps {
  task: Task;
  onUpdate: (updates: Partial<Task>) => Promise<boolean>;
  className?: string;
}

export default function TaskTitle({ task, onUpdate, className = '' }: TaskTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(task.title || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cập nhật tiêu đề khi task thay đổi
  useEffect(() => {
    setTitle(task.title || '');
  }, [task]);

  // Bắt đầu chỉnh sửa
  const startEditing = () => {
    setIsEditing(true);
  };

  // Hủy chỉnh sửa
  const cancelEditing = () => {
    setIsEditing(false);
    setTitle(task.title || '');
    setError(null);
  };

  // Lưu tiêu đề
  const saveTitle = async () => {
    if (!title.trim()) {
      setError('Tiêu đề không được để trống');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      // Gọi hàm update từ props
      const success = await onUpdate({ title });

      if (success) {
        setIsEditing(false);
      } else {
        setError('Không thể cập nhật tiêu đề. Vui lòng thử lại sau.');
      }
    } catch (error) {
      console.error('Error updating task title:', error);
      setError('Đã xảy ra lỗi. Vui lòng thử lại sau.');
    } finally {
      setIsSaving(false);
    }
  };

  // Xử lý khi nhấn phím
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveTitle();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  return (
    <div className={`task-title mb-4 ${className}`}>
      {isEditing ? (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập tiêu đề công việc"
              title="Nhập tiêu đề công việc"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xl font-semibold py-2"
              autoFocus
            />
            
            {isSaving ? (
              <Spinner size="sm" />
            ) : (
              <>
                <button 
                  onClick={saveTitle} 
                  className="p-2 text-blue-600 hover:text-blue-800"
                  title="Lưu"
                  aria-label="Lưu tiêu đề"
                >
                  <CheckIcon className="h-5 w-5" />
                </button>
                <button 
                  onClick={cancelEditing} 
                  className="p-2 text-red-600 hover:text-red-800"
                  title="Hủy"
                  aria-label="Hủy thay đổi"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
          
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
        </div>
      ) : (
        <div 
          className="flex items-center group cursor-pointer"
          onClick={startEditing}
        >
          <h1 className="text-2xl font-bold text-gray-900 mr-2 break-words">{task.title || 'Chưa có tiêu đề'}</h1>
          <PencilIcon className="h-5 w-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}
      
      {/* Hiển thị mã công việc */}
      <div className="flex items-center mt-1">
        <span className="text-sm font-medium text-gray-500">Mã công việc:</span>
        <span className="ml-2 text-sm text-gray-700">{task.task_id}</span>
      </div>
    </div>
  );
} 