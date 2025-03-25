'use client';

import React, { useState, useEffect, useCallback, useRef, forwardRef } from 'react';
import { Task, TaskStatus, Priority, TaskStatuses, Priorities } from '@/types/task';
import { User } from '@/contexts/AuthContext';
import dynamic from 'next/dynamic';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { CommentCard } from '@/components/common/CommentCard';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { formatDistance } from 'date-fns';
import { vi } from 'date-fns/locale';
import { PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useMutation, useQuery } from '@apollo/client';
import { GET_TASK_COMMENTS } from '@/graphql/queries/tasks';
import { CREATE_TASK_COMMENT } from '@/graphql/mutations/tasks';

// RichTextEditor với dynamic import để tránh lỗi SSR
const RichTextEditor = dynamic(
  () => import('@/components/common/RichTextEditor'),
  { 
    ssr: false,
    loading: () => (
      <div className="h-[300px] bg-gray-50 rounded-md animate-pulse flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    ),
  }
);

interface TaskDetailPageProps {
  task: Task;
  projectId: string;
  currentUser?: User;
  onTaskUpdate: (updates: Partial<Task>) => Promise<boolean>;
  isLoadingProp?: boolean;
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

interface Comment {
  id: string;
  content: string;
  user_id: string;
  username: string; 
  avatar_url?: string;
  created_at: string;
  status?: 'pending' | 'failed' | 'saved' | 'local';
}

// Định nghĩa kiểu dữ liệu cho API GraphQL
interface TaskComment {
  id: string;
  content: string;
  authorId: string;
  username: string;
  createdAt: string;
  updatedAt: string;
}

interface TaskCommentsData {
  taskComments: TaskComment[];
}

interface CreateCommentInput {
  content: string;
  taskId: string;
  parentId?: string;
  metadata?: Record<string, any>;
}

interface CreateCommentData {
  createComment: TaskComment;
}

export function TaskDetailPage({ task, projectId, currentUser, onTaskUpdate, isLoadingProp = false, projectMembers }: TaskDetailPageProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isDescriptionEditing, setIsDescriptionEditing] = useState(false);
  const [editedTask, setEditedTask] = useState<Task>(task);
  const [isLoading, setIsLoading] = useState(isLoadingProp);
  const [isSaving, setIsSaving] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const commentRef = React.useRef<HTMLTextAreaElement>(null);
  const [activeTab, setActiveTab] = useState('details');
  const [userId, setUserId] = useState<string | null>(null);
  
  // Sử dụng useRef để theo dõi các editor
  const descriptionEditorRef = useRef<any>(null);
  const commentEditorRef = useRef<any>(null);
  
  // Các trường có thể edit
  const [editingField, setEditingField] = useState<string | null>(null);

  // GraphQL Queries và Mutations
  const taskId = task.task_id || task.id || '';
  const { loading: commentsLoading, data: commentsData, refetch: refetchComments } = 
    useQuery<TaskCommentsData>(GET_TASK_COMMENTS, {
      variables: { taskId },
      skip: !taskId,
    });

  const [createComment, { loading: createCommentLoading }] = 
    useMutation<CreateCommentData, { input: CreateCommentInput }>(CREATE_TASK_COMMENT);

  // Khởi tạo tất cả modules Quill khi component mount
  useEffect(() => {
    // Chúng ta đã chuyển phần này vào dynamic import của ReactQuill
  }, []);

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
  
  // Render field có thể chỉnh sửa
  const renderEditableField = (label: string, fieldName: string, type: string = 'text', options?: any[]) => {
    const isEditing = editingField === fieldName;
    let fieldValue: any;
    let displayValue: any;

    switch (fieldName) {
      case 'status':
        fieldValue = editedTask.status;
        displayValue = <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
          {task.status}
        </span>;
        break;
      case 'priority':
        fieldValue = editedTask.priority;
        displayValue = <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
          {task.priority}
        </span>;
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
        displayValue = task.progress ? `${task.progress}%` : 'Chưa cập nhật';
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
        
        // Hiển thị created_by dựa trên kiểu dữ liệu
        if (typeof task.created_by === 'object' && task.created_by !== null) {
          displayValue = (
            <div className="flex items-center">
              {task.created_by.avatarUrl ? (
                <img 
                  src={task.created_by.avatarUrl} 
                  alt={task.created_by.username} 
                  className="w-6 h-6 rounded-full mr-2" 
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center mr-2">
                  {task.created_by.username?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
              <span>{task.created_by.username}</span>
            </div>
          );
        } else {
          // Fallback cho trường hợp không có thông tin hoặc chỉ có ID
          displayValue = task.created_by === 'system' ? 'Hệ thống' : task.created_by || 'Không có thông tin';
        }
        break;
      default:
        fieldValue = editedTask[fieldName as keyof Task] || '';
        displayValue = task[fieldName as keyof Task] || 'Chưa thiết lập';
    }

    return (
      <div>
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
                  
                  {fieldName === 'assignee' && projectMembers && projectMembers.length > 0 ? (
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
                    (newEditedTask as any)[fieldName] = e.target.value;
                    setEditedTask(newEditedTask);
                  }}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              ) : type === 'number' ? (
                <input
                  type="number"
                  title={`Nhập ${label.toLowerCase()}`}
                  placeholder={`Nhập ${label.toLowerCase()}`}
                  value={fieldValue}
                  min={0}
                  max={fieldName === 'progress' ? 100 : undefined}
                  onChange={(e) => {
                    const newEditedTask = {...editedTask};
                    (newEditedTask as any)[fieldName] = e.target.valueAsNumber || 0;
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
              <button
                type="button"
                onClick={() => saveField(fieldName)}
                className="inline-flex items-center rounded-md border border-transparent bg-green-600 p-1 text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                title="Lưu"
              >
                <CheckIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white p-1 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                title="Hủy"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-start group">
            <div>
              <div className="text-xs font-medium text-gray-500">{label}</div>
              <div className="mt-1">{displayValue}</div>
            </div>
            <button
              type="button"
              onClick={() => startEditing(fieldName)}
              className="hidden group-hover:block p-1 text-gray-400 hover:text-gray-500"
              title={`Chỉnh sửa ${label.toLowerCase()}`}
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  // Xử lý gửi comment với GraphQL - đã khôi phục API call
  const handleSubmitComment = async () => {
    if (!newComment.trim() || !currentUser) return;
    
    try {
      setError(null);
      setIsPostingComment(true);
      
      if (!taskId) {
        throw new Error('Thiếu thông tin task');
      }
      
      const commentContent = newComment.trim();
      setNewComment('');
      
      // Tạo ID tạm thời cho comment
      const tempId = `temp-${Date.now()}`;
      
      // Thêm comment tạm thời vào danh sách ngay lập tức
      const tempComment: Comment = {
        id: tempId,
        content: commentContent,
        user_id: currentUser.id,
        username: currentUser.name, // Tạm thời dùng currentUser.name cho UI
        avatar_url: currentUser.providerData?.[0]?.photoURL || undefined,
        created_at: new Date().toISOString(),
        status: 'pending'
      };
      
      // Cập nhật UI trước
      setComments(prevComments => [...prevComments, tempComment]);
      
      // Focus vào textarea sau khi gửi
      if (commentRef.current) {
        commentRef.current.focus();
      }
      
      try {
        // Gọi API GraphQL bất đồng bộ
        const { data } = await createComment({
          variables: {
            input: {
              content: commentContent,
              taskId,
            }
          }
        });
        
        if (data && data.createComment) {
          // Nếu API thành công, cập nhật comment tạm thời với dữ liệu thực
          setComments(prevComments => 
            prevComments.map(comment => 
              comment.id === tempId 
                ? {
                    id: data.createComment.id,
                    content: data.createComment.content,
                    user_id: data.createComment.authorId,
                    username: data.createComment.username, // Sử dụng username từ backend
                    avatar_url: currentUser.providerData?.[0]?.photoURL || undefined,
                    created_at: data.createComment.createdAt,
                    status: 'saved'
                  }
                : comment
            )
          );
        }
      } catch (apiError) {
        console.error('Error posting comment to API:', apiError);
        // Đánh dấu comment là thất bại, nhưng vẫn giữ lại
        setComments(prevComments => 
          prevComments.map(comment => 
            comment.id === tempId 
              ? { ...comment, status: 'failed' }
              : comment
          )
        );
      }
    } catch (error) {
      console.error('Error in comment handling:', error);
      setError('Không thể thêm bình luận. Vui lòng thử lại sau.');
    } finally {
      setIsPostingComment(false);
    }
  };

  // Thêm hàm thử lại gửi bình luận
  const handleRetryComment = async (commentId: string, content: string) => {
    try {
      setError(null);
      
      // Cập nhật trạng thái comment thành đang xử lý
      setComments(prevComments => 
        prevComments.map(comment => 
          comment.id === commentId 
            ? { ...comment, status: 'pending' }
            : comment
        )
      );
      
      try {
        // Gọi API GraphQL
        const { data } = await createComment({
          variables: {
            input: {
              content: content,
              taskId,
            }
          }
        });
        
        if (data && data.createComment) {
          // Nếu API thành công, cập nhật comment với dữ liệu thực
          setComments(prevComments => 
            prevComments.map(comment => 
              comment.id === commentId 
                ? {
                    id: data.createComment.id,
                    content: data.createComment.content,
                    user_id: data.createComment.authorId,
                    username: currentUser?.name || 'Người dùng',
                    avatar_url: currentUser?.providerData?.[0]?.photoURL || undefined,
                    created_at: data.createComment.createdAt,
                    status: 'saved'
                  }
                : comment
            )
          );
        }
      } catch (apiError) {
        console.error('Error retrying comment:', apiError);
        // Đánh dấu comment là thất bại
        setComments(prevComments => 
          prevComments.map(comment => 
            comment.id === commentId 
              ? { ...comment, status: 'failed' }
              : comment
          )
        );
      }
    } catch (error) {
      console.error('Error in retry handling:', error);
      setError('Không thể gửi lại bình luận. Vui lòng thử lại sau.');
    }
  };

  // Hàm xóa bình luận thất bại
  const handleDeleteFailedComment = (commentId: string) => {
    setComments(prevComments => 
      prevComments.filter(comment => comment.id !== commentId)
    );
  };

  // Chuyển đổi dữ liệu comment từ GraphQL sang định dạng cần thiết
  useEffect(() => {
    if (commentsData && commentsData.taskComments) {
      const formattedComments = commentsData.taskComments.map(comment => {
        return {
          id: comment.id,
          content: comment.content,
          user_id: comment.authorId,
          username: comment.username || 'Người dùng',
          avatar_url: undefined,
          created_at: comment.createdAt,
        };
      });
      
      setComments(formattedComments);
      setIsLoading(false);
    }
  }, [commentsData]);

  // Cập nhật editedTask khi task thay đổi
  useEffect(() => {
    setEditedTask(task);
  }, [task]);

  // Xử lý cập nhật task
  const handleSaveTask = async (fieldName?: string) => {
    try {
      setIsSaving(true);
      setError(null);
      
      // Chuẩn bị dữ liệu cập nhật
      const updates: Partial<Task> = {};
      
      if (fieldName) {
        // Nếu cập nhật trường cụ thể
        switch (fieldName) {
          case 'title':
            updates.title = editedTask.title;
            break;
          case 'description':
            updates.description = editedTask.description;
            break;
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
      } else {
        // Chỉ gửi những trường đã thay đổi
        if (editedTask.title !== task.title) updates.title = editedTask.title;
        if (editedTask.description !== task.description) updates.description = editedTask.description;
        if (editedTask.status !== task.status) updates.status = editedTask.status;
        if (editedTask.priority !== task.priority) updates.priority = editedTask.priority;
        if (editedTask.start_date !== task.start_date) updates.start_date = editedTask.start_date;
        if (editedTask.due_date !== task.due_date) updates.due_date = editedTask.due_date;
        if (editedTask.effort !== task.effort) updates.effort = editedTask.effort;
        if (editedTask.progress !== task.progress) updates.progress = editedTask.progress;
        if (JSON.stringify(editedTask.assignee) !== JSON.stringify(task.assignee)) updates.assignee = editedTask.assignee;
      }
      
      // Gọi hàm update từ props
      const success = await onTaskUpdate(updates);
      
      if (success) {
        setIsEditing(false);
        setIsDescriptionEditing(false);
        setEditingField(null);
      }
    } catch (error) {
      console.error('Error updating task:', error);
      setError('Không thể cập nhật công việc. Vui lòng thử lại sau.');
    } finally {
      setIsSaving(false);
    }
  };

  // Xử lý cập nhật riêng phần mô tả
  const handleSaveDescription = async () => {
    try {
      setIsSaving(true);
      setError(null);
      
      const updates: Partial<Task> = {
        description: editedTask.description
      };
      
      // Gọi hàm update từ props
      const success = await onTaskUpdate(updates);
      
      if (success) {
        setIsDescriptionEditing(false);
      }
    } catch (error) {
      console.error('Error updating task description:', error);
      setError('Không thể cập nhật mô tả. Vui lòng thử lại sau.');
    } finally {
      setIsSaving(false);
    }
  };

  // Chức năng edit inline
  const startEditing = (field: string) => {
    setEditingField(field);
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditedTask(task); // Reset các thay đổi
  };

  const saveField = (field: string) => {
    handleSaveTask(field);
    setEditingField(null);
  };

  // Thêm biến taskIdString
  const taskIdString: string = task.task_id || task.id || 'unknown-task';

  // Cập nhật hàm renderComment để tương thích với CommentCard
  const renderComment = (comment: Comment) => {
    // Chuyển đổi Comment nội bộ sang định dạng CommentCard
    const commentForCard = {
      id: comment.id,
      content: comment.content,
      user_id: comment.user_id,
      username: comment.username,
      avatar_url: comment.avatar_url,
      created_at: comment.created_at,
      task_id: task.task_id || task.id || 'unknown'  // Sử dụng giá trị mặc định
    };

    // Hiển thị bình luận đã lưu
    if (!comment.status || comment.status === 'saved') {
      return (
        <CommentCard
          key={comment.id}
          comment={commentForCard}
          currentUserId={currentUser?.id}
          onDelete={comment.user_id === currentUser?.id ? 
            (id) => handleDeleteFailedComment(id) : undefined}
        />
      );
    }

    // Hiển thị bình luận local (chỉ lưu ở client)
    if (comment.status === 'local') {
      return (
        <div key={comment.id} className="p-4 rounded-lg border border-blue-200 bg-blue-50">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {comment.avatar_url ? (
                <img src={comment.avatar_url} alt={comment.username} className="h-10 w-10 rounded-full" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                  <span className="text-gray-600 font-medium text-sm">{comment.username.substring(0, 2).toUpperCase()}</span>
                </div>
              )}
            </div>
            <div className="ml-3 flex-1">
              <div className="flex items-center">
                <p className="text-sm font-medium text-gray-900">{comment.username}</p>
                <span className="ml-2 text-xs text-blue-500 italic">Chỉ hiển thị cho bạn</span>
              </div>
              <div 
                className="mt-1 text-sm text-gray-700 rich-text-content"
                dangerouslySetInnerHTML={{ __html: comment.content }}
              />
            </div>
          </div>
        </div>
      );
    }

    // Hiển thị bình luận đang được gửi
    if (comment.status === 'pending') {
      return (
        <div key={comment.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 opacity-70">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {comment.avatar_url ? (
                <img src={comment.avatar_url} alt={comment.username} className="h-10 w-10 rounded-full" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                  <span className="text-gray-600 font-medium text-sm">{comment.username.substring(0, 2).toUpperCase()}</span>
                </div>
              )}
            </div>
            <div className="ml-3 flex-1">
              <div className="flex items-center">
                <p className="text-sm font-medium text-gray-900">{comment.username}</p>
                <span className="ml-2 text-xs text-gray-500 italic">Đang gửi...</span>
                <span className="ml-2">
                  <Spinner size="sm" />
                </span>
              </div>
              <div 
                className="mt-1 text-sm text-gray-700 rich-text-content"
                dangerouslySetInnerHTML={{ __html: comment.content }}
              />
            </div>
          </div>
        </div>
      );
    }

    // Hiển thị bình luận thất bại
    if (comment.status === 'failed') {
      return (
        <div key={comment.id} className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {comment.avatar_url ? (
                <img src={comment.avatar_url} alt={comment.username} className="h-10 w-10 rounded-full" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                  <span className="text-gray-600 font-medium text-sm">{comment.username.substring(0, 2).toUpperCase()}</span>
                </div>
              )}
            </div>
            <div className="ml-3 flex-1">
              <div className="flex items-center">
                <p className="text-sm font-medium text-gray-900">{comment.username}</p>
                <span className="ml-2 text-xs text-red-500 italic">Gửi thất bại</span>
              </div>
              <div 
                className="mt-1 text-sm text-gray-700 rich-text-content"
                dangerouslySetInnerHTML={{ __html: comment.content }}
              />
              <div className="mt-2 flex space-x-2">
                <button 
                  onClick={() => handleRetryComment(comment.id, comment.content)}
                  className="text-xs text-blue-600 hover:text-blue-800 border border-blue-500 hover:bg-blue-50 rounded px-2 py-1"
                >
                  Thử lại
                </button>
                <button 
                  onClick={() => handleDeleteFailedComment(comment.id)}
                  className="text-xs text-red-600 hover:text-red-800 border border-red-500 hover:bg-red-50 rounded px-2 py-1"
                >
                  Xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    return null;
  };

  // Cập nhật hàm handleDescriptionChange
  const handleDescriptionChange = useCallback((content: string) => {
    console.log('Description changed:', content?.substring(0, 50));
    setEditedTask((prev) => {
      if (prev.description === content) return prev;
      return {
        ...prev,
        description: content || ''
      };
    });
  }, []);

  // Cập nhật hàm handleCommentChange
  const handleCommentChange = useCallback((content: string) => {
    console.log('Comment changed:', content?.substring(0, 50));
    setNewComment(content || '');
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
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

      {/* Card chính chứa nội dung task */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header với tiêu đề task (có thể edit) */}
        <div className="p-6 border-b border-gray-200">
          {editingField === 'title' ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={editedTask.title}
                onChange={(e) => setEditedTask({...editedTask, title: e.target.value})}
                className="block w-full text-xl md:text-2xl font-bold rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Tiêu đề công việc"
                aria-label="Tiêu đề công việc"
              />
              <button 
                onClick={() => saveField('title')} 
                className="p-2 text-blue-600 hover:text-blue-800 rounded-full hover:bg-blue-50"
                title="Lưu"
                aria-label="Lưu thay đổi"
              >
                <CheckIcon className="h-5 w-5" />
              </button>
              <button 
                onClick={cancelEditing}
                className="p-2 text-red-600 hover:text-red-800 rounded-full hover:bg-red-50"
                title="Hủy"
                aria-label="Hủy thay đổi"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 cursor-pointer hover:bg-gray-50 p-1 rounded-sm group transition-colors" onClick={() => startEditing('title')}>
                {task.title}
                <PencilIcon className="inline-block ml-2 h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h1>
            </div>
          )}
          
          <div className="flex flex-wrap gap-2 mt-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
              {task.status}
            </span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
              {task.priority}
            </span>
          </div>
        </div>
        
        {/* Phần mô tả */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-lg font-medium text-gray-900">Mô tả chi tiết</h2>
            
            {!isDescriptionEditing && (
              <button 
                onClick={() => {
                  // Đảm bảo giá trị mô tả hợp lệ trước khi bắt đầu chỉnh sửa
                  setEditedTask(prev => ({
                    ...prev,
                    description: prev.description || ''
                  }));
                  setIsDescriptionEditing(true);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                title="Chỉnh sửa mô tả"
                aria-label="Chỉnh sửa mô tả"
              >
                <PencilIcon className="h-5 w-5" />
              </button>
            )}
          </div>
          
          {isDescriptionEditing ? (
            <div className="space-y-4">
              <RichTextEditor
                ref={descriptionEditorRef}
                value={editedTask.description || ''}
                onChange={handleDescriptionChange}
                placeholder="Thêm mô tả chi tiết cho task..."
                mode="full"
                minHeight="300px"
                readOnly={isSaving}
              />
              
              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Reset lại giá trị và tắt chế độ chỉnh sửa
                    setEditedTask(prev => ({
                      ...prev,
                      description: task.description || ''
                    }));
                    setIsDescriptionEditing(false);
                  }}
                  disabled={isSaving}
                >
                  Hủy
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSaveDescription}
                  disabled={isSaving}
                >
                  {isSaving ? <Spinner size="sm" className="mr-2" /> : null}
                  Lưu mô tả
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="prose max-w-none rich-text-content cursor-pointer hover:bg-gray-50 p-4 rounded-md transition-colors"
              dangerouslySetInnerHTML={{ __html: task.description || '<p class="text-gray-500 italic">Không có mô tả</p>' }}
              onClick={() => {
                // Đảm bảo giá trị mô tả hợp lệ trước khi bắt đầu chỉnh sửa
                setEditedTask(prev => ({
                  ...prev,
                  description: prev.description || ''
                }));
                setIsDescriptionEditing(true);
              }}
            />
          )}
        </div>
        
        {/* CSS cho chế độ xem rich text, đặc biệt là bảng */}
        <style jsx global>{`
          .rich-text-content table {
            border-collapse: collapse;
            margin: 1rem 0;
            overflow: hidden;
            width: 100%;
            border: 2px solid #d1d5db;
            table-layout: fixed;
          }
          
          .rich-text-content table td,
          .rich-text-content table th {
            border: 2px solid #d1d5db;
            box-sizing: border-box;
            min-width: 1em;
            padding: 0.75rem;
            position: relative;
            vertical-align: top;
          }
          
          .rich-text-content table th {
            background-color: #f3f4f6;
            font-weight: 600;
            border-bottom: 3px solid #9ca3af;
          }
          
          .rich-text-content img {
            max-width: 100%;
            height: auto;
          }
          
          .rich-text-content blockquote {
            border-left: 3px solid #e5e7eb;
            padding-left: 1rem;
            margin-left: 0;
            margin-right: 0;
            color: #6b7280;
          }

          .rich-text-content ul,
          .rich-text-content ol {
            padding-left: 1.5rem;
          }

          .rich-text-content ul {
            list-style-type: disc;
          }

          .rich-text-content ol {
            list-style-type: decimal;
          }
        `}</style>

        {/* Bảng thông tin chi tiết */}
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Thông tin chi tiết</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {renderEditableField('Trạng thái', 'status', 'select', 
                Object.entries(TaskStatuses).map(([_, value]) => ({ 
                  value, 
                  label: value.charAt(0).toUpperCase() + value.slice(1) 
                })))}
              
              {renderEditableField('Mức độ ưu tiên', 'priority', 'select', 
                Object.entries(Priorities).map(([_, value]) => ({ 
                  value, 
                  label: value.charAt(0).toUpperCase() + value.slice(1) 
                })))}
              
              {renderEditableField('Nỗ lực (giờ)', 'effort', 'number')}
              {renderEditableField('Tiến độ (%)', 'progress', 'number')}
            </div>
            
            <div className="space-y-4">
              {renderEditableField('Ngày bắt đầu', 'start_date', 'date')}
              {renderEditableField('Ngày đến hạn', 'due_date', 'date')}
              
              {/* Cập nhật renderEditableField cho assignee, kiểm tra projectMembers có tồn tại không */}
              {renderEditableField('Người được giao', 'assignee', 'select',
                projectMembers && projectMembers.length > 0 ? 
                  [{ value: '', label: 'Chưa gán' }, ...projectMembers.map(member => ({ 
                    value: member.user.userId, 
                    label: member.user.username || member.user.fullName || member.user.email 
                  }))] : 
                  [{ value: '', label: 'Chưa gán' }]
              )}
              
              {renderEditableField('Người tạo', 'created_by')}
            </div>
          </div>
        </div>
        
        {/* Phần bình luận */}
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Bình luận và hoạt động</h2>
          
          {/* Danh sách bình luận */}
          <div className="space-y-4 mb-6">
            {commentsLoading || isLoading ? (
              <div className="flex justify-center py-10">
                <Spinner size="lg" />
              </div>
            ) : comments.length > 0 ? (
              <div className="space-y-4">
                {comments.map((comment) => renderComment(comment))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">Chưa có bình luận nào</p>
            )}
          </div>
          
          {/* Form thêm bình luận */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <RichTextEditor
              ref={commentEditorRef}
              value={newComment}
              onChange={handleCommentChange}
              mode="compact"
              minHeight="150px"
              placeholder="Nhập bình luận của bạn..."
            />
            <div className="mt-2 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || createCommentLoading}
              >
                {createCommentLoading ? <Spinner size="sm" className="mr-2" /> : null}
                Gửi bình luận
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 