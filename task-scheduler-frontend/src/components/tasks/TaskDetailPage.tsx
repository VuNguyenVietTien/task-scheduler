'use client';

import React, { useState, useEffect, useCallback, useRef, forwardRef } from 'react';
import { Task, TaskStatus, Priority, TaskStatuses, Priorities, UserBasic } from '@/types/task';
import { User } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { CommentCard } from '@/components/common/CommentCard';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { formatDistance } from 'date-fns';
import { vi } from 'date-fns/locale';
import Link from 'next/link';
import { PencilIcon, CheckIcon, XMarkIcon, MagnifyingGlassIcon, BookOpenIcon, DocumentTextIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';
import { useMutation, useQuery } from '@apollo/client';
import { GET_TASK_COMMENTS } from '@/graphql/queries/tasks';
import { CREATE_TASK_COMMENT, DELETE_TASK_COMMENT } from '@/graphql/mutations/tasks';
import { GET_PROJECT_TASKS } from '@/graphql/queries/tasks';
import TaskDescriptionPanel from './description/TaskDescriptionPanel';
import { AdvancedEditor } from '@/components/common/AdvancedEditor';
import { imageService } from "@/services/imageService";
import { useAppDispatch, useAppSelector } from '@/redux/hooks';

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
  hideTitleHeader?: boolean;
  refetchMembers?: () => void;
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

export function TaskDetailPage({ task, projectId, currentUser, onTaskUpdate, isLoadingProp = false, projectMembers, hideTitleHeader = false, refetchMembers }: TaskDetailPageProps) {
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
  const [activeTab, setActiveTab] = useState('description');
  const [userId, setUserId] = useState<string | null>(null);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [availableParentTasks, setAvailableParentTasks] = useState<Task[]>([]);
  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const [isSearchingParent, setIsSearchingParent] = useState(false);
  const [parentSearchTimeout, setParentSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [parentTaskIdInput, setParentTaskIdInput] = useState('');
  const [showParentResults, setShowParentResults] = useState(false);
  const [parentTaskDetails, setParentTaskDetails] = useState<Task | null>(null);
  
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
    
  const [deleteComment] = useMutation(DELETE_TASK_COMMENT);

  // Query để lấy danh sách các task có thể là parent
  const { loading: tasksLoading, data: tasksData } = 
    useQuery(GET_PROJECT_TASKS, {
      variables: { projectId },
      skip: !projectId
    });

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
  
  // Hiển thị các trường editable
  const renderEditableField = (label: string, fieldName: string, type: 'text' | 'number' | 'date' | 'select' = 'text', options?: {value: string, label: string}[]) => {
    // Lấy giá trị hiện tại từ trạng thái editedTask
    const value = (editedTask as any)[fieldName];
    
    // Xác định giá trị hiển thị dựa trên loại trường
    let displayValue: string | React.ReactNode = '';
    
    if (type === 'date') {
      displayValue = value ? formatDate(value) : 'Chưa thiết lập';
    } else if (fieldName === 'effort') {
      displayValue = formatEffort(value);
    } else if (fieldName === 'assignee') {
      // Xử lý đặc biệt cho assignee vì có thể là object hoặc id
      if (typeof value === 'object' && value !== null) {
        // Nếu value là object
        displayValue = (
          <div className="flex items-center">
            {value.avatarUrl ? (
              <img src={value.avatarUrl} alt={value.username} className="h-5 w-5 rounded-full mr-2" />
            ) : (
              <div className="h-5 w-5 bg-gray-300 rounded-full flex items-center justify-center mr-2">
                <span className="text-xs font-medium text-gray-700">
                  {value.username ? value.username.charAt(0).toUpperCase() : '?'}
                </span>
              </div>
            )}
            <span>{value.username || value.fullName || 'Chưa gán'}</span>
          </div>
        );
      } else if (value) {
        // Nếu value là ID
        const assigneeData = projectMembers?.find(member => member.user.userId === value);
        displayValue = (
          <div className="flex items-center">
            {assigneeData?.user?.avatarUrl ? (
              <img src={assigneeData.user.avatarUrl} alt={assigneeData.user.username} className="h-5 w-5 rounded-full mr-2" />
            ) : (
              <div className="h-5 w-5 bg-gray-300 rounded-full flex items-center justify-center mr-2">
                <span className="text-xs font-medium text-gray-700">
                  {assigneeData?.user?.username ? assigneeData.user.username.charAt(0).toUpperCase() : '?'}
                </span>
              </div>
            )}
            <span>{assigneeData?.user?.username || assigneeData?.user?.fullName || String(value)}</span>
          </div>
        );
      } else {
        displayValue = 'Chưa gán';
      }
    } else if (fieldName === 'created_by') {
      // Đặc biệt xử lý người tạo - hiển thị username thay vì ID
      if (typeof value === 'object' && value !== null) {
          displayValue = (
            <div className="flex items-center">
            {value.avatarUrl ? (
              <img src={value.avatarUrl} alt={value.username} className="h-5 w-5 rounded-full mr-2" />
            ) : (
              <div className="h-5 w-5 bg-gray-300 rounded-full flex items-center justify-center mr-2">
                <span className="text-xs font-medium text-gray-700">
                  {value.username ? value.username.charAt(0).toUpperCase() : '?'}
                </span>
                </div>
              )}
            <span>{value.username || 'Không xác định'}</span>
          </div>
        );
      } else if (typeof value === 'string') {
        // Nếu chỉ có ID, tìm thông tin từ danh sách members
        const creatorData = projectMembers?.find(member => member.user.userId === value);
        if (creatorData) {
          displayValue = (
            <div className="flex items-center">
              {creatorData.user.avatarUrl ? (
                <img src={creatorData.user.avatarUrl} alt={creatorData.user.username} className="h-5 w-5 rounded-full mr-2" />
              ) : (
                <div className="h-5 w-5 bg-gray-300 rounded-full flex items-center justify-center mr-2">
                  <span className="text-xs font-medium text-gray-700">
                    {creatorData.user.username ? creatorData.user.username.charAt(0).toUpperCase() : '?'}
                  </span>
                </div>
              )}
              <span>{creatorData.user.username || creatorData.user.fullName || 'Người dùng'}</span>
            </div>
          );
        } else {
          // Nếu không tìm thấy thông tin từ projectMembers, hiển thị ID ngắn gọn hơn
          const shortId = value.length > 8 ? `${value.substring(0, 8)}...` : value;
          displayValue = (
            <div className="flex items-center">
              <div className="h-5 w-5 bg-gray-300 rounded-full flex items-center justify-center mr-2">
                <span className="text-xs font-medium text-gray-700">?</span>
              </div>
              <span title={value}>{shortId}</span>
            </div>
          );
        }
      } else {
        displayValue = 'Không xác định';
      }
    } else if (fieldName === 'progress') {
      displayValue = value ? `${value}%` : '0%';
    } else {
      // Đảm bảo displayValue luôn là string hoặc ReactNode, không phải object
      displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value || '');
    }

    return (
      <div className="mb-3">
        {editingField === fieldName ? (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700" htmlFor={`field-${fieldName}`}>{label}</label>
            
            {type === 'select' && options ? (
                <select
                id={`field-${fieldName}`}
                  title={`Chọn ${label.toLowerCase()}`}
                value={typeof value === 'object' ? (value?.userId || value?.id || '') : (value || '')}
                  onChange={(e) => {
                    if (fieldName === 'assignee') {
                    // Đặc biệt xử lý cho trường assignee để tránh lưu trữ object
                      if (e.target.value) {
                      // Tìm dữ liệu người dùng từ projectMembers
                        const selectedMember = projectMembers?.find(member => 
                          member.user.userId === e.target.value
                        );

                        if (selectedMember) {
                        // Tạo đối tượng UserBasic hợp lệ
                        const userBasic: UserBasic = {
                            userId: selectedMember.user.userId,
                            username: selectedMember.user.username || selectedMember.user.fullName || selectedMember.user.email,
                          avatarUrl: selectedMember.user.avatarUrl,
                          role: selectedMember.role
                        };
                        
                        setEditedTask({
                          ...editedTask,
                          assignee: userBasic
                        });
                      } else {
                        // Nếu không tìm thấy, xoá assignee
                        setEditedTask({
                          ...editedTask,
                          assignee: undefined
                        });
                        }
                      } else {
                      // Nếu không chọn người dùng nào, xoá assignee
                      setEditedTask({
                        ...editedTask,
                        assignee: undefined
                      });
                      }
                    } else {
                    setEditedTask({...editedTask, [fieldName]: e.target.value});
                  }
                }}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              >
                {options.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              ) : type === 'date' ? (
                <input
                id={`field-${fieldName}`}
                  type="date"
                  title={`Chọn ${label.toLowerCase()}`}
                  placeholder={`Nhập ${label.toLowerCase()}`}
                value={value || ''}
                onChange={(e) => setEditedTask({...editedTask, [fieldName]: e.target.value})}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                />
              ) : type === 'number' ? (
                <input
                id={`field-${fieldName}`}
                  type="number"
                  title={`Nhập ${label.toLowerCase()}`}
                  placeholder={`Nhập ${label.toLowerCase()}`}
                value={value || ''}
                onChange={(e) => setEditedTask({...editedTask, [fieldName]: parseInt(e.target.value) || 0})}
                  min={0}
                  max={fieldName === 'progress' ? 100 : undefined}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                />
              ) : (
                <input
                id={`field-${fieldName}`}
                  type="text"
                  title={`Nhập ${label.toLowerCase()}`}
                  placeholder={`Nhập ${label.toLowerCase()}`}
                value={typeof value === 'object' ? JSON.stringify(value) : (value || '')}
                onChange={(e) => setEditedTask({...editedTask, [fieldName]: e.target.value})}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              />
            )}
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => saveField(fieldName)}
                className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                disabled={isSaving}
              >
                {isSaving ? 'Đang lưu...' : 'Lưu'}
              </button>
              <button
                onClick={cancelEditing}
                className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
              >
                Hủy
              </button>
            </div>
          </div>
        ) : (
          <div 
            className="flex items-center p-1.5 rounded-md group hover:bg-gray-50 cursor-pointer transition-colors"
            onClick={() => startEditing(fieldName)}
          >
            <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">{label}:</div>
            <div className="flex-1 text-sm text-gray-900 flex items-center">
              {fieldName === 'status' && (
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(value as TaskStatus)}`}>
                  {displayValue}
                </span>
              )}
              {fieldName === 'priority' && (
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getPriorityColor(value as Priority)}`}>
                  {displayValue}
                </span>
              )}
              {fieldName !== 'status' && fieldName !== 'priority' && displayValue}
              
            <button
              type="button"
                className="ml-1.5 p-1 text-gray-400 hover:text-gray-700 bg-gray-100 opacity-0 group-hover:opacity-100 rounded-full transition-opacity"
              title={`Chỉnh sửa ${label.toLowerCase()}`}
            >
                <PencilIcon className="h-3 w-3" />
            </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Cập nhật hàm handleCommentChange
  const handleCommentChange = useCallback((content: string) => {
    console.log('Comment changed:', content?.substring(0, 50));
    setNewComment(content || '');
  }, []);

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
      
      // Kiểm tra xem có hình ảnh không
      const hasImages = commentContent.includes('<img');
      const containsBlob = commentContent.includes('blob:');
      
      console.log('Phân tích bình luận:', {
        hasImages,
        containsBlob,
        contentLength: commentContent.length
      });
      
      // Xử lý hình ảnh trước khi gửi comment
      let processedContent = commentContent;
      
      if (hasImages && containsBlob) {
        try {
          setIsProcessingImages(true);
          console.log('Bắt đầu xử lý hình ảnh trong bình luận...');
          processedContent = await imageService.processHtmlContent(commentContent);
          console.log('Xử lý hình ảnh hoàn tất, độ dài nội dung mới:', processedContent.length);
          
          // Kiểm tra nếu còn blob URL trong processedContent
          if (processedContent.includes('blob:')) {
            console.warn('Vẫn còn URL blob trong nội dung sau khi xử lý');
            setError('Lưu ý: Một số hình ảnh có thể chưa được tải lên. Vui lòng thử lại.');
            setIsPostingComment(false);
            setIsProcessingImages(false);
            return;
          }
        } catch (imageError) {
          console.error('Lỗi khi xử lý hình ảnh:', imageError);
          let errorMessage = 'Một số hình ảnh không thể tải lên. Vui lòng thử lại.';
          if (imageError instanceof Error) {
            const errorText = imageError.message;
            if (errorText.includes('File too large')) {
              errorMessage = 'Hình ảnh quá lớn. Vui lòng sử dụng ảnh có kích thước nhỏ hơn 5MB.';
            }
          }
          setError(`Lỗi: ${errorMessage}`);
          setIsPostingComment(false);
          setIsProcessingImages(false);
          return;
        } finally {
          setIsProcessingImages(false);
        }
      }
      
      // Đặt lại trường newComment
      setNewComment('');
      
      // Tạo ID tạm thời cho comment
      const tempId = `temp-${Date.now()}`;
      
      // Thêm comment tạm thời vào danh sách ngay lập tức
      const tempComment: Comment = {
        id: tempId,
        content: processedContent,
        user_id: currentUser.id,
        username: currentUser.name, // Tạm thời dùng currentUser.name cho UI
        avatar_url: currentUser.providerData?.[0]?.photoURL || undefined,
        created_at: new Date().toISOString(),
        status: 'pending'
      };
      
      // Cập nhật UI trước
      setComments(prevComments => [...prevComments, tempComment]);
      
      // Focus vào textarea sau khi gửi
      if (commentEditorRef.current) {
        commentEditorRef.current.focus();
      }
      
      try {
        // Gọi API GraphQL bất đồng bộ
        const { data } = await createComment({
          variables: {
            input: {
              content: processedContent,
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
          
          // Dọn dẹp hình ảnh không sử dụng
          imageService.cleanupUnusedImages();
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
      
      // Kiểm tra xem có hình ảnh không
      const hasImages = content.includes('<img');
      const containsBlob = content.includes('blob:');
      
      console.log('Phân tích bình luận:', {
        hasImages,
        containsBlob,
        contentLength: content.length
      });
      
      // Xử lý hình ảnh trước khi gửi comment
      let processedContent = content;
      
      if (hasImages && containsBlob) {
        try {
          setIsProcessingImages(true);
          console.log('Bắt đầu xử lý hình ảnh trong bình luận...');
          processedContent = await imageService.processHtmlContent(content);
          console.log('Xử lý hình ảnh hoàn tất, độ dài nội dung mới:', processedContent.length);
          
          // Kiểm tra nếu còn blob URL trong processedContent
          if (processedContent.includes('blob:')) {
            console.warn('Vẫn còn URL blob trong nội dung sau khi xử lý');
            setError('Lưu ý: Một số hình ảnh có thể chưa được tải lên. Vui lòng thử lại.');
            setIsProcessingImages(false);
            return;
          }
        } catch (imageError) {
          console.error('Lỗi khi xử lý hình ảnh:', imageError);
          let errorMessage = 'Một số hình ảnh không thể tải lên. Vui lòng thử lại.';
          if (imageError instanceof Error) {
            const errorText = imageError.message;
            if (errorText.includes('File too large')) {
              errorMessage = 'Hình ảnh quá lớn. Vui lòng sử dụng ảnh có kích thước nhỏ hơn 5MB.';
            }
          }
          setError(`Lỗi: ${errorMessage}`);
          setIsProcessingImages(false);
          return;
        } finally {
          setIsProcessingImages(false);
        }
      }
      
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
              content: processedContent,
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
          
          // Dọn dẹp hình ảnh không sử dụng
          imageService.cleanupUnusedImages();
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

  // Hàm xóa bình luận
  const handleDeleteFailedComment = (commentId: string) => {
    // Trước tiên xóa comment khỏi UI để phản hồi ngay lập tức
    setComments(prevComments => 
      prevComments.filter(comment => comment.id !== commentId)
    );
    
    // Check if it's a pending or failed local comment
    const comment = comments.find(c => c.id === commentId);
    if (comment && comment.status && (comment.status === 'pending' || comment.status === 'failed')) {
      // This is a local comment that hasn't been saved to the server yet, không cần gọi API
      return;
    }
    
    // Nếu là comment đã lưu, gọi API xóa
    try {
      deleteComment({
        variables: {
          commentId: commentId
        }
      })
      .catch((error) => {
        console.error('Error deleting comment:', error);
        // Thông báo lỗi cho người dùng
        setError('Không thể xóa bình luận. Vui lòng thử lại sau.');
        // Nếu lỗi, cũng không cần refetch lại dữ liệu
      });
    } catch (error) {
      console.error('Error processing delete comment:', error);
      setError('Đã xảy ra lỗi khi xóa bình luận.');
      // Không cần refetch
    }
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

  // Thêm hàm xử lý bình luận với url localhost:3000 thành localhost:8080
  const processCommentContent = (content: string): string => {
    // Thay thế localhost:3000 bằng localhost:8080 trong đường dẫn hình ảnh
    if (!content) return '';
    
    // Sử dụng regex để thay thế URL trong thẻ img
    return content.replace(
      /(src=["'])(http:\/\/localhost:3000|https:\/\/localhost:3000|localhost:3000)/g, 
      '$1http://localhost:8080'
    );
  };

  // Sửa lại renderComment để xử lý URL trước khi hiển thị
  const renderComment = (comment: Comment) => {
    // Xử lý nội dung comment để thay đổi URL
    const processedContent = processCommentContent(comment.content);
    
    // Chuyển đổi Comment nội bộ sang định dạng CommentCard
    const commentForCard = {
      id: comment.id,
      content: processedContent,
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
                dangerouslySetInnerHTML={{ __html: processedContent }}
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
                dangerouslySetInnerHTML={{ __html: processedContent }}
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
                dangerouslySetInnerHTML={{ __html: processedContent }}
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

  // Xử lý danh sách các task có thể là parent
  useEffect(() => {
    if (tasksData && tasksData.tasks) {
      // Lọc ra những task có thể là parent (không phải chính nó và không phải child của nó)
      const filteredTasks = tasksData.tasks.filter((t: any) => {
        // Không chọn chính nó làm parent
        if (t.taskId === taskId) return false;
        
        // Kiểm tra nếu task hiện tại đã là parent của t, thì t không thể là parent của task hiện tại (tránh vòng lặp)
        return !isChildTask(t.taskId, task);
      });
      
      // Chuyển đổi từ camelCase sang snake_case để phù hợp với định nghĩa Task
      const formattedTasks = filteredTasks.map((t: any) => ({
        task_id: t.taskId,
        id: t.taskId,
        title: t.title,
        parent_task_id: t.parentTaskId,
        // Các trường khác nếu cần
      }));
      
      setAvailableParentTasks(formattedTasks);
    }
  }, [tasksData, taskId, task]);
  
  // Hàm kiểm tra nếu potentialChildId là child hoặc descendant của potentialParent
  const isChildTask = (potentialChildId: string, potentialParent: Task): boolean => {
    if (!potentialParent.child_tasks) return false;
    
    // Kiểm tra trực tiếp
    const isDirectChild = potentialParent.child_tasks.some(child => 
      child.task_id === potentialChildId || child.id === potentialChildId
    );
    
    if (isDirectChild) return true;
    
    // Kiểm tra đệ quy thông qua các child
    return potentialParent.child_tasks.some(child => isChildTask(potentialChildId, child));
  };

  // Hàm debounce cho tìm kiếm parent task
  const handleParentTaskSearch = (query: string) => {
    setParentSearchQuery(query);
    
    // Xóa timeout cũ nếu có
    if (parentSearchTimeout) {
      clearTimeout(parentSearchTimeout);
    }
    
    // Tạo timeout mới để delay 2s trước khi thực hiện tìm kiếm
    const timeout = setTimeout(() => {
      setIsSearchingParent(true);
      // Ở đây có thể gọi API riêng để tìm kiếm task, nhưng chúng ta đã có sẵn API lấy tất cả task
      // nên chỉ cần áp dụng filter với query
      setIsSearchingParent(false);
    }, 2000);
    
    setParentSearchTimeout(timeout);
  };

  // Lọc danh sách parent tasks dựa trên query
  const filteredParentTasks = parentSearchQuery
    ? availableParentTasks.filter(t => 
        t.title.toLowerCase().includes(parentSearchQuery.toLowerCase()) ||
        t.task_id.toLowerCase().includes(parentSearchQuery.toLowerCase())
      )
    : availableParentTasks.slice(0, 5); // Chỉ hiển thị 5 task gần nhất nếu không có query

  // Thêm hàm để lấy task con
  const childTasks = task.child_tasks || [];

  // Thêm hàm để xử lý khi chọn task cha
  const handleSelectParentTask = (parentTask: Task) => {
              setEditedTask(prev => ({
                ...prev,
      parent_task_id: parentTask.task_id
    }));
    setParentSearchQuery('');
    setShowParentResults(false);
  };

  // Thêm hàm để xử lý khi nhấn tìm kiếm task cha
  const handleSearchClick = () => {
    handleSearchParentTasks(parentTaskIdInput);
  };

  // Thêm hàm để xử lý khi tìm kiếm task cha
  const handleSearchParentTasks = (query: string) => {
    handleParentTaskSearch(query);
  };

  // Thêm đoạn JavaScript để tính toán vị trí sticky dựa trên chiều cao header
  useEffect(() => {
    function calculateStickyPosition() {
      const appHeader = document.querySelector('header'); // Lấy header chính của ứng dụng
      const sidebar = document.getElementById('task-tabs-sidebar');
      
      if (sidebar) {
        // Tính toán khoảng cách top cho sidebar
        if (appHeader) {
          // Lấy chiều cao của header ứng dụng
          const appHeaderHeight = appHeader.getBoundingClientRect().height;
          
          // Gán vị trí top cho sidebar bằng chiều cao của header
          sidebar.style.position = 'sticky';
          sidebar.style.top = `${appHeaderHeight}px`;
        } else {
          // Nếu không tìm thấy header ứng dụng, dùng giá trị mặc định
          sidebar.style.position = 'sticky';
          sidebar.style.top = '0px';
        }
      }
    }
    
    // Gọi hàm khi scroll
    window.addEventListener('scroll', calculateStickyPosition);
    // Gọi hàm khi resize cửa sổ
    window.addEventListener('resize', calculateStickyPosition);
    // Gọi lần đầu để thiết lập vị trí ban đầu
    calculateStickyPosition();
    
    // Cleanup event listeners khi component unmount
    return () => {
      window.removeEventListener('scroll', calculateStickyPosition);
      window.removeEventListener('resize', calculateStickyPosition);
    };
  }, []);

  // Sử dụng Redux để lắng nghe sự thay đổi của members
  const { members: reduxMembers } = useAppSelector(state => state.members);
  
  // Theo dõi sự thay đổi trong Redux store để cập nhật UI
  useEffect(() => {
    if (reduxMembers && reduxMembers.length >= 0 && refetchMembers) {
      // Khi danh sách members trong Redux thay đổi, gọi hàm refetchMembers
      refetchMembers();
    }
  }, [reduxMembers, refetchMembers]);

  return (
    <div className="w-full space-y-8">
      {/* CSS cho rich text content và tabs */}
      <style jsx={true} global={true}>{`
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
            margin: 0.5rem 0;
          }

          .rich-text-content ul {
            list-style-type: disc;
          }

          .rich-text-content ol {
            list-style-type: decimal;
          }
          
          /* Thêm style cho nested lists */
          .rich-text-content ul ul,
          .rich-text-content ol ol,
          .rich-text-content ul ol,
          .rich-text-content ol ul {
            margin-top: 0.25rem;
            margin-bottom: 0;
          }
          
          .rich-text-content ul ul {
            list-style-type: circle;
          }
          
          .rich-text-content ul ul ul {
            list-style-type: square;
          }
          
          .rich-text-content ol ol {
            list-style-type: lower-alpha;
          }
          
          .rich-text-content ol ol ol {
            list-style-type: lower-roman;
          }
          
          /* Style cho heading */
          .rich-text-content h1 {
            font-size: 1.75rem;
            font-weight: 700;
            margin-top: 1.5rem;
            margin-bottom: 1rem;
            line-height: 1.25;
          }
          
          .rich-text-content h2 {
            font-size: 1.5rem;
            font-weight: 600;
            margin-top: 1.4rem;
            margin-bottom: 0.8rem;
            line-height: 1.3;
          }
          
          .rich-text-content h3 {
            font-size: 1.25rem;
            font-weight: 600;
            margin-top: 1.3rem;
            margin-bottom: 0.6rem;
            line-height: 1.35;
          }
          
          /* Style cho text-align */
          .rich-text-content [style*="text-align: center"] {
            text-align: center;
          }
          
          .rich-text-content [style*="text-align: right"] {
            text-align: right;
          }
          
          .rich-text-content [style*="text-align: justify"] {
            text-align: justify;
          }
          
          /* Style cho line-height */
          .rich-text-content [style*="line-height"] {
            line-height: inherit;
          }
          
          /* Style cho các thẻ p */
          .rich-text-content p {
            margin-bottom: 0.75rem;
          }
          
          /* Style cho inline text formatting */
          .rich-text-content strong {
            font-weight: 600;
          }
          
          .rich-text-content em {
            font-style: italic;
          }
          
          .rich-text-content u {
            text-decoration: underline;
          }
          
          .rich-text-content s {
            text-decoration: line-through;
          }

        /* CSS cho tabs */
        .task-detail-page-container {
          display: flex;
          flex-direction: column;
          width: 100%;
        }

        .task-header {
          width: 100%;
          margin-bottom: 1rem;
          flex: 0 0 auto;
        }

        .tabs-content-wrapper {
          display: flex;
          flex-direction: row;
          width: 100%;
          align-items: flex-start;
        }

        .task-tabs-sidebar {
          flex: 0 0 auto;
          width: fit-content;
          min-width: 180px;
          max-width: 220px;
          padding: 1.25rem 1rem;
          background-color: #f9fafb;
          position: sticky;
          left: 0;
          top: 0;
          border-radius: 0.5rem 0 0 0.5rem;
          box-shadow: 4px 0 10px rgba(0, 0, 0, 0.1);
          z-index: 10;
          height: fit-content;
          overflow-y: auto;
          border: 1px solid #e5e7eb;
          border-right: none;
        }

        .task-content-area {
          flex: 1 1 auto;
          padding: 1.5rem;
          background-color: white;
          border-radius: 0.5rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          border: 1px solid #e5e7eb;
          overflow-x: auto;
          min-width: 0;
        }

        .tabs-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .tab-item {
          display: flex;
          align-items: center;
          padding: 0.5rem 0.75rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          transition: all 0.2s ease;
          cursor: pointer;
          color: #4b5563;
          white-space: nowrap;
        }

        .tab-item:hover {
          background-color: #e5e7eb;
          color: #1f2937;
        }

        .tab-item.active {
          background-color: #e0e7ff;
          color: #4f46e5;
          font-weight: 500;
        }

        .tab-content {
          animation: fadeIn 0.3s ease-in-out;
          display: none;
          opacity: 0;
          transition: opacity 0.3s ease-in-out;
        }

        .tab-content.active {
          display: block;
          opacity: 1;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .tab-item {
          position: relative;
          overflow: hidden;
        }

        .tab-item::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 0;
          height: 3px;
          background-color: #4f46e5;
          transition: width 0.3s ease;
        }

        .tab-item:hover::after {
          width: 30%;
        }

        .tab-item.active::after {
          width: 100%;
          }
        `}</style>

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

      {/* Container chính cho trang chi tiết task - 2 hàng */}
      <div className="task-detail-page-container">
        {/* Hàng 1: Header ở trên cùng */}
        <div id="task-header" className="task-header bg-white p-4 mb-4 border border-gray-200 rounded-lg shadow-sm">
          <div className="flex flex-col space-y-3">
            {/* Task title */}
            {editingField === 'title' ? (
              <div className="flex flex-col space-y-2">
                <input
                  type="text"
                  value={editedTask.title}
                  onChange={(e) => setEditedTask({...editedTask, title: e.target.value})}
                  className="block w-full text-lg font-bold rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Tiêu đề công việc"
                  aria-label="Tiêu đề công việc"
                />
                <div className="flex space-x-2">
                  <button 
                    onClick={() => saveField('title')} 
                    className="p-1 text-blue-600 hover:text-blue-800 rounded-full hover:bg-blue-50 flex items-center"
                    title="Lưu"
                    aria-label="Lưu thay đổi"
                  >
                    <CheckIcon className="h-4 w-4" />
                    <span className="ml-1 text-sm">Lưu</span>
                  </button>
                  <button 
                    onClick={cancelEditing}
                    className="p-1 text-red-600 hover:text-red-800 rounded-full hover:bg-red-50 flex items-center"
                    title="Hủy"
                    aria-label="Hủy thay đổi"
                  >
                    <XMarkIcon className="h-4 w-4" />
                    <span className="ml-1 text-sm">Hủy</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <h1 
                  className="font-semibold text-xl cursor-pointer hover:text-blue-600" 
                  onClick={() => startEditing('title')}
                  title="Nhấp để chỉnh sửa tiêu đề"
                >
                  {task.title}
                </h1>
                <button 
                  onClick={() => startEditing('title')} 
                  className="p-1 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100"
                  title="Chỉnh sửa tiêu đề"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Ô tìm kiếm parent task */}
            <div className="relative">
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Tìm parent task..."
                  value={parentTaskIdInput}
                  onChange={(e) => {
                    setParentTaskIdInput(e.target.value);
                    handleSearchParentTasks(e.target.value);
                  }}
                  className="text-sm pl-2 py-1 h-9 w-full max-w-md border rounded-md"
                />
                <Button
                  className="px-2 h-9 w-9 flex items-center justify-center"
                  onClick={handleSearchClick}
                  title="Tìm kiếm parent task"
                >
                  <MagnifyingGlassIcon className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Dropdown results */}
              {showParentResults && filteredParentTasks.length > 0 && (
                <div className="absolute z-10 w-full max-w-md mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                  {filteredParentTasks.map((parentTask) => (
                    <div 
                      key={parentTask.task_id} 
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                      onClick={() => handleSelectParentTask(parentTask)}
                    >
                      <div className="font-medium truncate">{parentTask.title}</div>
                      <div className="text-xs text-gray-500 truncate">ID: {parentTask.task_id}</div>
                    </div>
                  ))}
                </div>
              )}
              
              {task.parent_task_id && (
                <div className="mt-2 text-sm">
                  <div className="flex items-center">
                    <span className="text-gray-600">Parent:</span>
                    <Link 
                      href={`/projects/${projectId}/tasks/${task.parent_task_id}`}
                      className="ml-1 text-blue-600 hover:text-blue-800 truncate"
                    >
                      {parentTaskDetails?.title || task.parent_task_id}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hàng 2: Container chứa tabs và content */}
        <div className="tabs-content-wrapper">
          {/* Cột 1: Left sidebar contains the tab menu */}
          <div id="task-tabs-sidebar" className="task-tabs-sidebar">
            <div className="tabs-list">
              <button 
                className={`tab-item ${activeTab === 'description' ? 'active' : ''}`}
                onClick={() => setActiveTab('description')}
              >
                <BookOpenIcon className="h-4 w-4 mr-2" />
                Mô tả
              </button>
              <button 
                className={`tab-item ${activeTab === 'details' ? 'active' : ''}`}
                onClick={() => setActiveTab('details')}
              >
                <DocumentTextIcon className="h-4 w-4 mr-2" />
                Chi tiết
              </button>
              <button 
                className={`tab-item ${activeTab === 'comments' ? 'active' : ''}`}
                onClick={() => setActiveTab('comments')}
              >
                <ChatBubbleLeftIcon className="h-4 w-4 mr-2" />
                Bình luận
              </button>
              <button 
                className={`tab-item ${activeTab === 'subtasks' ? 'active' : ''}`}
                onClick={() => setActiveTab('subtasks')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Task con ({childTasks.length})
              </button>
            </div>
          </div>

          {/* Cột 2: Tab content area */}
          <div className="task-content-area">
            <div className={`tab-content ${activeTab === 'description' ? 'active' : ''}`}>
              <div className="bg-white rounded-lg">
                <TaskDescriptionPanel 
                  task={task}
                  onTaskUpdated={(updatedTask) => {
                    setEditedTask(prev => ({
                      ...prev,
                      description: updatedTask.description
                    }));
                  }}
                  className="w-full"
                />
              </div>
            </div>
            
            <div className={`tab-content ${activeTab === 'details' ? 'active' : ''}`}>
              <div className="bg-white rounded-lg">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Thông tin chi tiết</h2>
          
                <div className="grid grid-cols-1 gap-2">
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
              
              {renderEditableField('Ngày bắt đầu', 'start_date', 'date')}
              {renderEditableField('Ngày đến hạn', 'due_date', 'date')}
              
                  {calculateDaysRemaining() && (
                    <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
                      <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">Thời gian còn lại:</div>
                      <div className="flex-1">
                        <span className={`inline-block px-2 py-1 text-sm rounded ${calculateDaysRemaining()?.includes('Quá hạn') ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                          {calculateDaysRemaining()}
                        </span>
                      </div>
                    </div>
                  )}
                    
              {renderEditableField('Người được giao', 'assignee', 'select',
                projectMembers && projectMembers.length > 0 ? 
                  [{ value: '', label: 'Chưa gán' }, ...projectMembers.map(member => ({ 
                    value: member.user.userId, 
                    label: member.user.username || member.user.fullName || member.user.email 
                  }))] : 
                  [{ value: '', label: 'Chưa gán' }]
              )}
                  
                  {renderEditableField('Nỗ lực (giờ)', 'effort', 'number')}
                  {renderEditableField('Tiến độ (%)', 'progress', 'number')}
              
              {renderEditableField('Người tạo', 'created_by')}
                  
                  <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
                    <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">Thời gian tạo:</div>
                    <div className="flex-1 text-sm text-gray-900">
                      {formatDate(task.created_at)}
                    </div>
                  </div>
                  
                  <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
                    <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">Cập nhật cuối:</div>
                    <div className="flex-1 text-sm text-gray-900">
                      {formatDate(task.updated_at)}
                    </div>
                  </div>
            </div>
          </div>
        </div>
        
            <div className={`tab-content ${activeTab === 'comments' ? 'active' : ''}`}>
              <div className="bg-white rounded-lg">
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
                  
            <AdvancedEditor
              ref={commentEditorRef}
              value={newComment}
                    onChange={setNewComment}
                    placeholder="Thêm bình luận..."
              mode="compact"
            />
                  
                  <div className="mt-3 flex justify-end">
              <Button
                onClick={handleSubmitComment}
                      disabled={isPostingComment || !newComment}
                      isLoading={isPostingComment}
              >
                      {isPostingComment ? 'Đang gửi...' : 'Gửi bình luận'}
              </Button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className={`tab-content ${activeTab === 'subtasks' ? 'active' : ''}`}>
              <div className="bg-white rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-medium text-gray-900">Task con ({childTasks.length})</h2>
                  <Button size="sm" variant="outline">
                    <span className="mr-1">+</span> Thêm task con
                  </Button>
                </div>
                
                {childTasks.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">Chưa có task con nào</p>
                ) : (
                  <div className="space-y-4">
                    {childTasks.map((childTask) => (
                      <div key={childTask.task_id || childTask.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                        <div className="flex justify-between items-start">
                          <div>
                            <Link href={`/projects/${projectId}/tasks/${childTask.task_id || childTask.id}`} className="text-lg font-medium text-blue-600 hover:text-blue-800">
                              {childTask.title}
                            </Link>
                            <div className="flex items-center mt-1 space-x-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(childTask.status)}`}>
                                {childTask.status}
                              </span>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(childTask.priority)}`}>
                                {childTask.priority}
                              </span>
                            </div>
                          </div>
                          {childTask.assignee && (
                            <div className="flex items-center">
                              {childTask.assignee.avatarUrl ? (
                                <img 
                                  src={childTask.assignee.avatarUrl} 
                                  alt={childTask.assignee.username} 
                                  title={childTask.assignee.username}
                                  className="h-6 w-6 rounded-full" 
                                />
                              ) : (
                                <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center">
                                  <span className="text-gray-600 text-xs">{childTask.assignee.username?.charAt(0).toUpperCase() || '?'}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 