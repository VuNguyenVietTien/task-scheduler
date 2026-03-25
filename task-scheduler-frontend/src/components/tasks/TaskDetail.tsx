import React, { useState, useRef, useEffect } from 'react';
import { Task, TaskStatus, Priority, TaskStatuses, Priorities } from '../../types/task';
import { User } from '../../contexts/AuthContext';
import { Dialog } from '../ui/Dialog';
import clsx from 'clsx';
import { useUpdateTask } from '@/hooks/useTasks';
import { InlineEditableField } from './inline-editable-field';

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
  const [isLoading, setIsLoading] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const { updateTask } = useUpdateTask();

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

  // Inline save: update a single field immediately
  const handleFieldSave = async (field: string, value: string | number | undefined) => {
    try {
      setSavingField(field);
      setError(null);

      const taskId = task.task_id || task.id || '';
      const updates: Partial<Task> = {};

      switch (field) {
        case 'title': updates.title = value as string; break;
        case 'description': updates.description = value as string; break;
        case 'status': updates.status = value as TaskStatus; break;
        case 'priority': updates.priority = value as Priority; break;
        case 'start_date': updates.start_date = value ? `${value}T00:00:00Z` : undefined; break;
        case 'due_date': updates.due_date = value ? `${value}T00:00:00Z` : undefined; break;
        case 'effort': updates.effort = value ? Number(value) : undefined; break;
        case 'progress': updates.progress = value ? Number(value) : undefined; break;
        default: return;
      }

      await updateTask(taskId, updates);
      if (onTaskUpdate) onTaskUpdate(taskId, updates);

      // Dispatch event to refresh task data
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('task-status-updated'));
      }
    } catch (err) {
      console.error('Error updating field:', err);
      setError('Khong the cap nhat. Vui long thu lai.');
    } finally {
      setSavingField(null);
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

  // Status and priority options for inline select
  const statusOptions = Object.values(TaskStatuses).map(s => ({
    value: s, label: s.charAt(0).toUpperCase() + s.slice(1)
  }));
  const priorityOptions = Object.values(Priorities).map(p => ({
    value: p, label: p.charAt(0).toUpperCase() + p.slice(1)
  }));

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title="Chi tiet cong viec"
      className="w-[calc(100%-64px)] max-w-[900px]"
    >
      <div className="p-6 space-y-6">
        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-3 flex items-center gap-2">
            <svg className="h-4 w-4 text-red-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Back button */}
        <button
          onClick={onClose}
          className="flex items-center text-slate-500 hover:text-slate-900 transition-colors text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Quay lai
        </button>

        {/* Inline hint */}
        <p className="text-xs text-slate-400">Click vao gia tri bat ky de chinh sua truc tiep</p>

        {/* Title - inline editable */}
        <InlineEditableField
          value={task.title}
          onSave={(v) => handleFieldSave('title', v)}
          saving={savingField === 'title'}
          className="text-xl font-bold"
          placeholder="Nhap tieu de"
        />

        {/* Status + Priority badges - inline editable */}
        <div className="flex flex-wrap gap-3 items-center">
          <div>
            <span className="text-xs text-slate-500 block mb-1">Trang thai</span>
            <InlineEditableField
              value={task.status}
              onSave={(v) => handleFieldSave('status', v)}
              type="select"
              options={statusOptions}
              saving={savingField === 'status'}
              renderDisplay={(v) => (
                <span className={clsx("px-2.5 py-1 rounded-full text-xs font-medium", getStatusColor(v as TaskStatus))}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </span>
              )}
            />
          </div>
          <div>
            <span className="text-xs text-slate-500 block mb-1">Uu tien</span>
            <InlineEditableField
              value={task.priority}
              onSave={(v) => handleFieldSave('priority', v)}
              type="select"
              options={priorityOptions}
              saving={savingField === 'priority'}
              renderDisplay={(v) => (
                <span className={clsx("px-2.5 py-1 rounded-full text-xs font-medium", getPriorityColor(v as Priority))}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </span>
              )}
            />
          </div>
          {task.due_date && (
            <span className={clsx(
              "px-2.5 py-1 rounded-full text-xs font-medium",
              new Date(task.due_date) < new Date() ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
            )}>
              {calculateDaysRemaining()}
            </span>
          )}
        </div>

        {/* Description - inline editable */}
        <div>
          <span className="text-xs text-slate-500 block mb-1">Mo ta</span>
          {task.description ? (
            <div className="bg-slate-50 p-4 rounded-md">
              <div className="text-slate-700 rich-text-content text-sm">
                {renderHTML(task.description)}
              </div>
            </div>
          ) : (
            <InlineEditableField
              value=""
              onSave={(v) => handleFieldSave('description', v)}
              type="textarea"
              saving={savingField === 'description'}
              placeholder="Them mo ta..."
            />
          )}
        </div>

        {/* Detail grid - all inline editable */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-md">
          {/* Assignee (read-only for now) */}
          <div>
            <span className="text-xs text-slate-500 block mb-1">Nguoi duoc giao</span>
            <div className="flex items-center gap-2 px-2 py-1 text-sm">
              {task.assignee ? (
                <>
                  <span className="inline-block h-6 w-6 rounded-full overflow-hidden bg-slate-200">
                    {task.assignee.avatarUrl ? (
                      <img src={task.assignee.avatarUrl} alt={task.assignee.username} className="h-full w-full object-cover" />
                    ) : (
                      <svg className="h-full w-full text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    )}
                  </span>
                  <span className="text-slate-900">{task.assignee.username}</span>
                </>
              ) : (
                <span className="text-slate-400 italic">Chua giao</span>
              )}
            </div>
          </div>

          {/* Người tạo (read-only) */}
          <div>
            <span className="text-xs text-slate-500 block mb-1">Nguoi tao</span>
            <p className="px-2 py-1 text-sm text-slate-900">
              {typeof task.created_by === 'object' ? (task.created_by as any)?.username : task.created_by || '-'}
            </p>
          </div>

          {/* Start date */}
          <div>
            <span className="text-xs text-slate-500 block mb-1">Ngay bat dau</span>
            <InlineEditableField
              value={task.start_date?.split('T')[0] || ''}
              onSave={(v) => handleFieldSave('start_date', v)}
              type="date"
              saving={savingField === 'start_date'}
              placeholder="Chon ngay"
              renderDisplay={(v) => <span>{v ? new Date(v).toLocaleDateString('vi-VN') : <span className="text-slate-400 italic">Chua thiet lap</span>}</span>}
            />
          </div>

          {/* Due date */}
          <div>
            <span className="text-xs text-slate-500 block mb-1">Ngay het han</span>
            <InlineEditableField
              value={task.due_date?.split('T')[0] || ''}
              onSave={(v) => handleFieldSave('due_date', v)}
              type="date"
              saving={savingField === 'due_date'}
              placeholder="Chon ngay"
              renderDisplay={(v) => <span>{v ? new Date(v).toLocaleDateString('vi-VN') : <span className="text-slate-400 italic">Chua thiet lap</span>}</span>}
            />
          </div>

          {/* Effort */}
          <div>
            <span className="text-xs text-slate-500 block mb-1">No luc (gio)</span>
            <InlineEditableField
              value={task.effort?.toString() || ''}
              onSave={(v) => handleFieldSave('effort', v)}
              type="number"
              min={0}
              step={0.5}
              saving={savingField === 'effort'}
              placeholder="0"
              renderDisplay={(v) => <span>{v ? formatEffort(Number(v)) : <span className="text-slate-400 italic">Chua uoc tinh</span>}</span>}
            />
          </div>

          {/* Progress */}
          <div>
            <span className="text-xs text-slate-500 block mb-1">Tien do (%)</span>
            <InlineEditableField
              value={task.progress?.toString() || '0'}
              onSave={(v) => handleFieldSave('progress', v)}
              type="number"
              min={0}
              max={100}
              saving={savingField === 'progress'}
              renderDisplay={(v) => (
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-slate-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Number(v) || 0}%` }}></div>
                  </div>
                  <span className="text-xs text-slate-700">{v || 0}%</span>
                </div>
              )}
            />
          </div>

          {/* Created at (read-only) */}
          <div>
            <span className="text-xs text-slate-500 block mb-1">Ngay tao</span>
            <p className="px-2 py-1 text-sm text-slate-900">{formatDate(task.created_at)}</p>
          </div>

          {/* Updated at (read-only) */}
          <div>
            <span className="text-xs text-slate-500 block mb-1">Cap nhat lan cuoi</span>
            <p className="px-2 py-1 text-sm text-slate-900">{formatDate(task.updated_at)}</p>
          </div>
        </div>

        {/* Comments section */}
        <div className="mt-4">
          <h3 className="text-base font-semibold text-slate-800 mb-3">Binh luan ({comments.length})</h3>
              
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
                          <div className="mt-1 text-sm text-gray-700 rich-text-content">
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
    </Dialog>
  );
} 