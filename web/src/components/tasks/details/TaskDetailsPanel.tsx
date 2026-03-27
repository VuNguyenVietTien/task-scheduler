'use client';

import React, { useState } from 'react';
import { Task, TaskStatus, Priority, TaskStatuses, Priorities } from '@/types/task';
import { User } from '@/contexts/AuthContext';
import { PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Spinner } from '@/components/ui/Spinner';

// Định nghĩa kiểu Props
interface TaskDetailsPanelProps {
  task: Task;
  onUpdate: (updates: Partial<Task>) => Promise<boolean>;
  className?: string;
  projectMembers?: { 
    role: string;
    joinedAt: string;
    user: {
      userId: string;
      email: string;
      fullName: string;
      username: string;
      avatarUrl: string;
    };
  }[];
}

export default function TaskDetailsPanel({ 
  task, 
  onUpdate, 
  className = '',
  projectMembers = []
}: TaskDetailsPanelProps) {
  const [editedTask, setEditedTask] = useState<Task>(task);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cập nhật editedTask khi task thay đổi
  React.useEffect(() => {
    setEditedTask(task);
  }, [task]);

  // Định dạng ngày tháng
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Chưa thiết lập';
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Tính số ngày còn lại
  const calculateDaysRemaining = (dueDate?: string) => {
    if (!dueDate) return '';
    
    const today = new Date();
    const date = new Date(dueDate);
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `Quá hạn ${Math.abs(diffDays)} ngày`;
    } else if (diffDays === 0) {
      return 'Đến hạn hôm nay';
    } else {
      return `Còn ${diffDays} ngày`;
    }
  };

  // Định dạng effort thành giờ hoặc ngày
  const formatEffort = (effort?: number) => {
    if (!effort && effort !== 0) return 'Chưa ước tính';
    
    if (effort < 8) {
      return `${effort} giờ`;
    } else {
      const days = Math.floor(effort / 8);
      const hours = effort % 8;
      return hours > 0 ? `${days} ngày ${hours} giờ` : `${days} ngày`;
    }
  };

  // Màu sắc trạng thái
  const getStatusColor = (status: TaskStatus) => {
    const colors = {
      'todo': 'bg-gray-100 text-gray-800',
      'doing': 'bg-blue-100 text-blue-800',
      'done': 'bg-green-100 text-green-800',
      'close': 'bg-green-100 text-green-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'review': 'bg-purple-100 text-purple-800',
      'blocked': 'bg-red-100 text-red-800',
      'rejected': 'bg-red-100 text-red-800',
      'archived': 'bg-gray-100 text-gray-800',
    };
    return colors[status] || colors.todo;
  };

  // Màu sắc ưu tiên
  const getPriorityColor = (priority: Priority) => {
    const colors = {
      'low': 'bg-green-100 text-green-800',
      'medium': 'bg-yellow-100 text-yellow-800',
      'high': 'bg-orange-100 text-orange-800',
      'urgent': 'bg-red-100 text-red-800',
      'critical': 'bg-red-100 text-red-800 font-bold',
    };
    return colors[priority] || colors.medium;
  };

  // Bắt đầu chỉnh sửa trường
  const startEditing = (field: string) => {
    setEditingField(field);
  };

  // Hủy chỉnh sửa
  const cancelEditing = () => {
    setEditingField(null);
    setEditedTask(task); // Reset các thay đổi
  };

  // Lưu trường đang chỉnh sửa
  const saveField = async (field: string) => {
    try {
      setIsSaving(true);
      setError(null);
      
      // Chuẩn bị dữ liệu cập nhật
      const updates: Partial<Task> = {};
      
      switch (field) {
        case 'status':
          updates.status = editedTask.status;
          break;
        case 'priority':
          updates.priority = editedTask.priority;
          break;
        case 'start_date':
          updates.start_date = editedTask.start_date;
          break;
        case 'due_date':
          updates.due_date = editedTask.due_date;
          break;
        case 'effort':
          updates.effort = editedTask.effort;
          break;
        case 'progress':
          updates.progress = editedTask.progress;
          break;
        case 'assignee':
          updates.assignee = editedTask.assignee;
          break;
        default:
          break;
      }
      
      // Gọi hàm update từ props
      const success = await onUpdate(updates);
      
      if (success) {
        setEditingField(null);
      } else {
        setError(`Không thể cập nhật ${field}. Vui lòng thử lại sau.`);
      }
    } catch (error) {
      console.error('Error updating task field:', error);
      setError('Đã xảy ra lỗi. Vui lòng thử lại sau.');
    } finally {
      setIsSaving(false);
    }
  };

  // Render field có thể chỉnh sửa
  const renderEditableField = (label: string, fieldName: string, type: string = 'text', options?: { value: string, label: string }[]) => {
    const isEditing = editingField === fieldName;
    let fieldValue: any;
    let displayValue: any;

    switch (fieldName) {
      case 'status':
        fieldValue = editedTask.status;
        displayValue = (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
            {task.status}
          </span>
        );
        break;
      case 'priority':
        fieldValue = editedTask.priority;
        displayValue = (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
            {task.priority}
          </span>
        );
        break;
      case 'start_date':
      case 'due_date':
        fieldValue = editedTask[fieldName]?.split('T')[0] || '';
        displayValue = formatDate(task[fieldName]);
        break;
      case 'effort':
        fieldValue = editedTask.effort || '';
        displayValue = formatEffort(task.effort);
        break;
      case 'progress':
        fieldValue = editedTask.progress || '';
        displayValue = task.progress !== undefined && task.progress !== null ? `${task.progress}%` : 'Chưa cập nhật';
        break;
      case 'assignee':
        fieldValue = editedTask.assignee?.userId || '';
        displayValue = task.assignee ? (
          <div className="flex items-center">
            {task.assignee.avatarUrl ? (
              <img 
                src={task.assignee.avatarUrl} 
                alt={task.assignee.username} 
                className="w-6 h-6 rounded-full mr-2" 
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center mr-2">
                {task.assignee.username?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
            <span>{task.assignee.username || 'Chưa gán'}</span>
          </div>
        ) : (
          'Chưa gán'
        );
        break;
      case 'created_by':
        fieldValue = editedTask.created_by || '';
        displayValue = task.created_by || 'Không có thông tin';
        break;
      default:
        fieldValue = editedTask[fieldName as keyof Task] || '';
        displayValue = task[fieldName as keyof Task] || 'Chưa thiết lập';
    }

    return (
      <div className="mb-4">
        {isEditing ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-500">{label}</div>
            <div className="flex items-center space-x-2">
              {type === 'select' ? (
                <select
                  value={fieldValue}
                  title={`Chọn ${label.toLowerCase()}`}
                  onChange={(e) => {
                    const newEditedTask = {...editedTask};
                    if (fieldName === 'assignee') {
                      if (e.target.value) {
                        // Tìm thông tin member được chọn từ danh sách
                        const selectedMember = projectMembers?.find(member => 
                          member.user.userId === e.target.value
                        );

                        if (selectedMember) {
                          newEditedTask.assignee = {
                            userId: selectedMember.user.userId,
                            username: selectedMember.user.username || selectedMember.user.fullName || selectedMember.user.email,
                            avatarUrl: selectedMember.user.avatarUrl || '',
                            role: selectedMember.role || ''
                          };
                        }
                      } else {
                        // Nếu không chọn ai, gán assignee là undefined
                        newEditedTask.assignee = undefined;
                      }
                    } else {
                      (newEditedTask as any)[fieldName] = e.target.value;
                    }
                    setEditedTask(newEditedTask);
                  }}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  {fieldName === 'assignee' && <option value="">Chưa gán</option>}
                  
                  {fieldName === 'assignee' && projectMembers.length > 0 ? (
                    projectMembers.map((member) => (
                      <option key={member.user.userId} value={member.user.userId}>
                        {member.user.username || member.user.fullName || member.user.email}
                      </option>
                    ))
                  ) : options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : type === 'date' ? (
                <input
                  type="date"
                  title={`Chọn ${label.toLowerCase()}`}
                  placeholder={`Nhập ${label.toLowerCase()}`}
                  value={fieldValue}
                  onChange={(e) => {
                    const newEditedTask = {...editedTask};
                    (newEditedTask as any)[fieldName] = e.target.value ? `${e.target.value}T00:00:00Z` : undefined;
                    setEditedTask(newEditedTask);
                  }}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              ) : type === 'number' ? (
                <input
                  type="number"
                  title={`Nhập ${label.toLowerCase()}`}
                  placeholder={`Nhập ${label.toLowerCase()}`}
                  min="0"
                  max={fieldName === 'progress' ? 100 : undefined}
                  value={fieldValue}
                  onChange={(e) => {
                    const newEditedTask = {...editedTask};
                    (newEditedTask as any)[fieldName] = e.target.value ? Number(e.target.value) : undefined;
                    setEditedTask(newEditedTask);
                  }}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              ) : (
                <input
                  type="text"
                  title={`Nhập ${label.toLowerCase()}`}
                  placeholder={`Nhập ${label.toLowerCase()}`}
                  value={fieldValue}
                  onChange={(e) => {
                    const newEditedTask = {...editedTask};
                    (newEditedTask as any)[fieldName] = e.target.value;
                    setEditedTask(newEditedTask);
                  }}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              )}
              
              {isSaving ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <button 
                    onClick={() => saveField(fieldName)} 
                    className="p-1 text-blue-600 hover:text-blue-800"
                    title="Lưu"
                    aria-label="Lưu thay đổi"
                  >
                    <CheckIcon className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={cancelEditing} 
                    className="p-1 text-red-600 hover:text-red-800"
                    title="Hủy"
                    aria-label="Hủy thay đổi"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">{label}</div>
            <div 
              className="text-sm text-gray-900 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors group"
              onClick={() => startEditing(fieldName)}
              title={`Nhấn để chỉnh sửa ${label.toLowerCase()}`}
            >
              <div className="flex items-center">
                <span className="mr-2">{displayValue}</span>
                <PencilIcon className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" />
              </div>
              
              {/* Hiển thị số ngày còn lại nếu là due_date */}
              {fieldName === 'due_date' && task.due_date && (
                <span className={`mt-1 text-xs px-2 py-1 rounded-md inline-block ${
                  calculateDaysRemaining(task.due_date).includes('Quá hạn') 
                    ? 'bg-red-100 text-red-800' 
                    : calculateDaysRemaining(task.due_date).includes('hôm nay') 
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                }`}>
                  {calculateDaysRemaining(task.due_date)}
                </span>
              )}
              
              {/* Hiển thị thanh tiến độ nếu là progress */}
              {fieldName === 'progress' && task.progress !== undefined && task.progress !== null && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        task.progress < 30 ? 'bg-red-500' : 
                        task.progress < 70 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${task.progress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`task-details-panel ${className}`}>
      <h2 className="text-lg font-medium text-gray-900 mb-4">Chi tiết công việc</h2>
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-base font-medium text-gray-900 mb-3">Thông tin cơ bản</h3>
            
            {renderEditableField('Trạng thái', 'status', 'select', 
              Object.values(TaskStatuses).map(status => ({ value: status, label: status })))}
            
            {renderEditableField('Người được giao', 'assignee', 'select')}
            
            {renderEditableField('Mức ưu tiên', 'priority', 'select',
              Object.values(Priorities).map(priority => ({ value: priority, label: priority })))}
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-base font-medium text-gray-900 mb-3">Thời gian & Tiến độ</h3>
            
            {renderEditableField('Ngày bắt đầu', 'start_date', 'date')}
            
            {renderEditableField('Hạn hoàn thành', 'due_date', 'date')}
            
            {renderEditableField('Nỗ lực (giờ)', 'effort', 'number')}
            
            {renderEditableField('Tiến độ (%)', 'progress', 'number')}
          </div>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-base font-medium text-gray-900 mb-3">Thông tin tạo công việc</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Người tạo</p>
            <div className="mt-1 flex items-center">
              {task.creator ? (
                <>
                  {task.creator.avatarUrl ? (
                    <img 
                      src={task.creator.avatarUrl} 
                      alt={task.creator.username} 
                      className="w-6 h-6 rounded-full mr-2" 
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center mr-2">
                      {task.creator.username?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                  <span className="text-sm text-gray-900">{task.creator.username}</span>
                </>
              ) : (
                <span className="text-sm text-gray-500">Không có thông tin</span>
              )}
            </div>
          </div>
          
          <div>
            <p className="text-sm font-medium text-gray-500">Thời gian tạo</p>
            <p className="mt-1 text-sm text-gray-900">{formatDate(task.created_at)}</p>
          </div>
          
          <div>
            <p className="text-sm font-medium text-gray-500">Lần cập nhật cuối</p>
            <p className="mt-1 text-sm text-gray-900">{formatDate(task.updated_at)}</p>
          </div>
        </div>
      </div>
    </div>
  );
} 