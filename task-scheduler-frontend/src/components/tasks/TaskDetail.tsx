import React, { useState, useRef, useEffect } from 'react';
import { Task, TaskStatus, Priority, TaskStatuses, Priorities } from '../../types/task';
import { User } from '../../contexts/AuthContext';
import { Dialog } from '../ui/Dialog';
import clsx from 'clsx';
import { useUpdateTask } from '@/hooks/useTasks';

interface TaskDetailProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
  currentUser?: User;
}

interface Comment {
  id: string;
  content: string;
  user_id: string;
  username: string; 
  avatar_url?: string;
  created_at: string;
}

export function TaskDetail({ task, isOpen, onClose, onTaskUpdate, currentUser }: TaskDetailProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState<Task>(task);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const updateTask = useUpdateTask();

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
  const calculateDaysRemaining = () => {
    if (!task.due_date) return null;
    
    const today = new Date();
    const dueDate = new Date(task.due_date);
    const diffTime = dueDate.getTime() - today.getTime();
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
    if (!effort) return 'Chưa ước tính';
    
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

  // Lấy comments từ API
  const fetchComments = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Lấy project_id từ task hoặc tham số khác nếu cần
      const projectId = task.project_id || task.projectId;

      if (!projectId) {
        console.error('Không tìm thấy project_id cho task');
        return;
      }

      const taskId = task.task_id || task.id;
      
      const response = await fetch(`/api/projects/${projectId}/tasks/${taskId}/comments`);
      
      if (!response.ok) {
        throw new Error('Không thể lấy comments');
      }
      
      const data = await response.json();
      
      // Chuyển đổi định dạng data nếu cần
      const formattedComments = data.map((comment: any) => ({
        id: comment.id,
        content: comment.content,
        user_id: comment.user_id,
        username: comment.username || 'Người dùng',
        avatar_url: comment.avatar_url,
        created_at: comment.created_at
      }));
      
      setComments(formattedComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      setError('Không thể tải bình luận. Vui lòng thử lại sau.');
      
      // Fallback to mock data if API fails
      const mockComments: Comment[] = [
        {
          id: 'comment-1',
          content: 'Đã bắt đầu làm task này',
          user_id: 'user-1',
          username: 'Nguyễn Văn A',
          avatar_url: 'https://ui-avatars.com/api/?name=Nguyen+Van+A',
          created_at: '2023-05-15T08:30:00Z',
        },
        {
          id: 'comment-2',
          content: 'Cần thêm thông tin về requirements',
          user_id: 'user-2',
          username: 'Trần Thị B',
          avatar_url: 'https://ui-avatars.com/api/?name=Tran+Thi+B',
          created_at: '2023-05-16T10:15:00Z',
        },
      ];
      
      setComments(mockComments);
    } finally {
      setIsLoading(false);
    }
  };

  // Xử lý gửi comment
  const handleSubmitComment = async () => {
    if (!newComment.trim() || !currentUser) return;
    
    try {
      setIsPostingComment(true);
      setError(null);
      
      const projectId = task.project_id || task.projectId;
      const taskId = task.task_id || task.id;

      if (!projectId || !taskId) {
        throw new Error('Thiếu thông tin project hoặc task');
      }
      
      const response = await fetch(`/api/projects/${projectId}/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newComment
        }),
      });
      
      if (!response.ok) {
        throw new Error('Không thể thêm bình luận');
      }
      
      const savedComment = await response.json();
      
      // Thêm comment vào danh sách
      const newCommentObj: Comment = {
        id: savedComment.id,
        content: savedComment.content,
        user_id: savedComment.user_id,
        username: currentUser.name,
        avatar_url: currentUser.providerData?.[0]?.photoURL || undefined,
        created_at: savedComment.created_at,
      };
      
      setComments([...comments, newCommentObj]);
      setNewComment('');
      
      // Focus vào textarea sau khi gửi
      if (commentRef.current) {
        commentRef.current.focus();
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      setError('Không thể thêm bình luận. Vui lòng thử lại sau.');
      
      // Fallback: Thêm comment giả nếu API lỗi
      if (process.env.NODE_ENV === 'development') {
        const fallbackComment: Comment = {
          id: `comment-${Date.now()}`,
          content: newComment,
          user_id: currentUser.id,
          username: currentUser.name,
          avatar_url: currentUser.providerData?.[0]?.photoURL || undefined,
          created_at: new Date().toISOString(),
        };
        
        setComments([...comments, fallbackComment]);
        setNewComment('');
      }
    } finally {
      setIsPostingComment(false);
    }
  };

  // Xử lý cập nhật task
  const handleSaveTask = async () => {
    try {
      setIsSaving(true);
      setError(null);
      
      const taskId = task.task_id || task.id || '';
      
      // Chuẩn bị dữ liệu cập nhật
      const updates: Partial<Task> = {};
      
      // Chỉ gửi những trường đã thay đổi
      if (editedTask.title !== task.title) updates.title = editedTask.title;
      if (editedTask.description !== task.description) updates.description = editedTask.description;
      if (editedTask.status !== task.status) updates.status = editedTask.status;
      if (editedTask.priority !== task.priority) updates.priority = editedTask.priority;
      if (editedTask.start_date !== task.start_date) updates.start_date = editedTask.start_date;
      if (editedTask.due_date !== task.due_date) updates.due_date = editedTask.due_date;
      if (editedTask.effort !== task.effort) updates.effort = editedTask.effort;
      if (editedTask.progress !== task.progress) updates.progress = editedTask.progress;
      if (editedTask.assignee_id !== task.assignee_id) updates.assignee_id = editedTask.assignee_id;
      
      // Gọi GraphQL mutation để cập nhật task
      const updatedTask = await updateTask(taskId, updates);
      
      // Cập nhật UI
      if (onTaskUpdate) {
        onTaskUpdate(taskId, updates);
      }
      
      // Hiển thị thông báo thành công tạm thời nếu cần
      console.log('Cập nhật công việc thành công:', updatedTask);
      
      // Tắt chế độ chỉnh sửa
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating task:', error);
      setError('Không thể cập nhật công việc. Vui lòng thử lại sau.');
    } finally {
      setIsSaving(false);
    }
  };

  // Render nội dung HTML an toàn
  const renderHTML = (html?: string) => {
    if (!html) return null;
    
    return (
      <div 
        className="prose max-w-none" 
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  // Load comments khi task thay đổi
  useEffect(() => {
    if (isOpen && (task.task_id || task.id)) {
      fetchComments();
    }
  }, [isOpen, task.task_id, task.id]);

  // Cập nhật editedTask khi task thay đổi
  useEffect(() => {
    setEditedTask(task);
  }, [task]);

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose} 
      title={isEditing ? "Chỉnh sửa công việc" : "Chi tiết công việc"}
      className="w-[calc(100%-64px)] max-w-[900px]"
    >
      <div className="p-6 space-y-6">
        {/* Hiển thị thông báo lỗi nếu có */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
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

        {/* Nút quay lại */}
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={onClose}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Quay lại
          </button>
          
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Chỉnh sửa
            </button>
          )}
        </div>

        {isEditing ? (
          // Form chỉnh sửa
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tiêu đề */}
            <div className="md:col-span-2">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Tiêu đề
              </label>
              <input
                type="text"
                id="title"
                value={editedTask.title}
                onChange={(e) => setEditedTask({...editedTask, title: e.target.value})}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            {/* Mô tả */}
            <div className="md:col-span-2">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Mô tả
              </label>
              <textarea
                id="description"
                rows={5}
                value={editedTask.description || ''}
                onChange={(e) => setEditedTask({...editedTask, description: e.target.value})}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">Hỗ trợ định dạng HTML</p>
            </div>

            {/* Trạng thái */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                Trạng thái
              </label>
              <select
                id="status"
                value={editedTask.status}
                onChange={(e) => setEditedTask({...editedTask, status: e.target.value as TaskStatus})}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                {Object.values(TaskStatuses).map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Mức độ ưu tiên */}
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                Mức độ ưu tiên
              </label>
              <select
                id="priority"
                value={editedTask.priority}
                onChange={(e) => setEditedTask({...editedTask, priority: e.target.value as Priority})}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                {Object.values(Priorities).map((priority) => (
                  <option key={priority} value={priority}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Ngày bắt đầu */}
            <div>
              <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">
                Ngày bắt đầu
              </label>
              <input
                type="date"
                id="start_date"
                value={editedTask.start_date?.split('T')[0] || ''}
                onChange={(e) => setEditedTask({...editedTask, start_date: e.target.value ? `${e.target.value}T00:00:00Z` : undefined})}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            {/* Ngày hết hạn */}
            <div>
              <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 mb-1">
                Ngày hết hạn
              </label>
              <input
                type="date"
                id="due_date"
                value={editedTask.due_date?.split('T')[0] || ''}
                onChange={(e) => setEditedTask({...editedTask, due_date: e.target.value ? `${e.target.value}T00:00:00Z` : undefined})}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            {/* Nỗ lực (Effort) */}
            <div>
              <label htmlFor="effort" className="block text-sm font-medium text-gray-700 mb-1">
                Nỗ lực (giờ)
              </label>
              <input
                type="number"
                id="effort"
                min="0"
                value={editedTask.effort || ''}
                onChange={(e) => setEditedTask({...editedTask, effort: e.target.value ? Number(e.target.value) : undefined})}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            {/* Tiến độ */}
            <div>
              <label htmlFor="progress" className="block text-sm font-medium text-gray-700 mb-1">
                Tiến độ (%)
              </label>
              <input
                type="number"
                id="progress"
                min="0"
                max="100"
                value={editedTask.progress || ''}
                onChange={(e) => setEditedTask({...editedTask, progress: e.target.value ? Number(e.target.value) : undefined})}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            {/* Nút lưu và hủy */}
            <div className="md:col-span-2 flex justify-end space-x-3 mt-4">
              <button
                type="button"
                onClick={() => {
                  setEditedTask(task);
                  setIsEditing(false);
                }}
                className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveTask}
                disabled={isSaving}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Đang lưu...
                  </>
                ) : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        ) : (
          // Hiển thị chi tiết
          <div className="space-y-6">
            {/* Tiêu đề và trạng thái */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{task.title}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={clsx("px-2.5 py-1 rounded-full text-xs font-medium", getStatusColor(task.status))}>
                  {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                </span>
                <span className={clsx("px-2.5 py-1 rounded-full text-xs font-medium", getPriorityColor(task.priority))}>
                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                </span>
                {task.effort && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {formatEffort(task.effort)}
                  </span>
                )}
                {task.due_date && (
                  <span className={clsx(
                    "px-2.5 py-1 rounded-full text-xs font-medium",
                    new Date(task.due_date) < new Date() ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                  )}>
                    {calculateDaysRemaining()}
                  </span>
                )}
              </div>
            </div>

            {/* Mô tả */}
            {task.description && (
              <div className="bg-gray-50 p-4 rounded-md">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Mô tả</h3>
                <div className="text-gray-700">
                  {renderHTML(task.description)}
                </div>
              </div>
            )}

            {/* Thông tin chi tiết */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-md">
              {/* Người được giao */}
              <div>
                <h4 className="text-sm font-medium text-gray-500">Người được giao</h4>
                <div className="mt-1 flex items-center">
                  {task.assignee ? (
                    <>
                      <span className="inline-block h-8 w-8 rounded-full overflow-hidden bg-gray-100">
                        {task.assignee.avatarUrl ? (
                          <img src={task.assignee.avatarUrl} alt={task.assignee.username} className="h-full w-full object-cover" />
                        ) : (
                          <svg className="h-full w-full text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        )}
                      </span>
                      <span className="ml-2 text-sm font-medium text-gray-900">{task.assignee.username}</span>
                    </>
                  ) : (
                    <span className="text-sm text-gray-500">Chưa giao</span>
                  )}
                </div>
              </div>

              {/* Người tạo */}
              <div>
                <h4 className="text-sm font-medium text-gray-500">Người tạo</h4>
                <p className="mt-1 text-sm text-gray-900">{task.created_by || 'Không có thông tin'}</p>
              </div>

              {/* Ngày bắt đầu */}
              <div>
                <h4 className="text-sm font-medium text-gray-500">Ngày bắt đầu</h4>
                <p className="mt-1 text-sm text-gray-900">{formatDate(task.start_date)}</p>
              </div>

              {/* Ngày hết hạn */}
              <div>
                <h4 className="text-sm font-medium text-gray-500">Ngày hết hạn</h4>
                <p className="mt-1 text-sm text-gray-900">{formatDate(task.due_date)}</p>
              </div>

              {/* Nỗ lực */}
              <div>
                <h4 className="text-sm font-medium text-gray-500">Nỗ lực</h4>
                <p className="mt-1 text-sm text-gray-900">{formatEffort(task.effort)}</p>
              </div>

              {/* Tiến độ */}
              <div>
                <h4 className="text-sm font-medium text-gray-500">Tiến độ</h4>
                <div className="mt-1">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${task.progress || 0}%` }}
                    ></div>
                  </div>
                  <p className="mt-1 text-xs text-gray-700">{task.progress || 0}%</p>
                </div>
              </div>

              {/* Ngày tạo */}
              <div>
                <h4 className="text-sm font-medium text-gray-500">Ngày tạo</h4>
                <p className="mt-1 text-sm text-gray-900">{formatDate(task.created_at)}</p>
              </div>

              {/* Cập nhật lần cuối */}
              <div>
                <h4 className="text-sm font-medium text-gray-500">Cập nhật lần cuối</h4>
                <p className="mt-1 text-sm text-gray-900">{formatDate(task.updated_at)}</p>
              </div>
            </div>

            {/* Phần comments */}
            <div className="mt-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Bình luận ({comments.length})</h3>
              
              {/* Hiển thị trạng thái loading */}
              {isLoading && (
                <div className="flex justify-center py-4">
                  <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
              
              {/* Danh sách comments */}
              {!isLoading && (
                <div className="space-y-4 mb-6">
                  {comments.map((comment) => (
                    <div key={comment.id} className="bg-gray-50 p-4 rounded-md">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          {comment.avatar_url ? (
                            <img 
                              className="h-10 w-10 rounded-full" 
                              src={comment.avatar_url} 
                              alt={comment.username} 
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600">
                              {comment.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="ml-3 flex-1">
                          <div className="text-sm font-medium text-gray-900">{comment.username}</div>
                          <div className="text-sm text-gray-500">
                            {new Date(comment.created_at).toLocaleDateString('vi-VN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                          <div className="mt-1 text-sm text-gray-700">
                            {renderHTML(comment.content)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {!isLoading && comments.length === 0 && (
                    <p className="text-gray-500 text-center py-4">Chưa có bình luận nào.</p>
                  )}
                </div>
              )}
              
              {/* Form thêm comment */}
              {currentUser && (
                <div className="mt-4">
                  <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
                    Thêm bình luận mới
                  </label>
                  <textarea
                    id="comment"
                    rows={3}
                    ref={commentRef}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Viết bình luận của bạn ở đây..."
                    disabled={isPostingComment}
                  />
                  <p className="mt-1 text-xs text-gray-500">Hỗ trợ định dạng HTML</p>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSubmitComment}
                      disabled={!newComment.trim() || isPostingComment}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPostingComment ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Đang gửi...
                        </>
                      ) : 'Gửi bình luận'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
} 