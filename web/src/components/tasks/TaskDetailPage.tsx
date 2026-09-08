'use client';

import React, { useState, useEffect, useCallback, useRef, forwardRef, useMemo } from 'react';
import { Task, TaskStatus, Priority, TaskStatuses, Priorities, UserBasic, TaskComment } from '@/types/task';
import { STATUS_LABELS, PRIORITY_LABELS, getStatusLabel, getPriorityLabel } from '@/constants/task-display-labels';
import { User } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui/Spinner';
import { TagInput } from '@/components/ui/tag-input';
import { Card } from '@/components/ui/Card';
import { CommentCard } from '@/components/common/CommentCard';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { formatDistance } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { PencilIcon, CheckIcon, XMarkIcon, MagnifyingGlassIcon, BookOpenIcon, DocumentTextIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';
import { useMutation, useQuery, useApolloClient } from '@apollo/client';
import { GET_TASK_COMMENTS, GET_TASK_BY_ID, GET_TASK_BASIC_INFO } from '@/graphql/queries/tasks';
import { CREATE_TASK_COMMENT, DELETE_TASK_COMMENT } from '@/graphql/mutations/tasks';
import TaskDescriptionPanel from './description/TaskDescriptionPanel';
import { AdvancedEditor } from '@/components/common/AdvancedEditor';
import { imageService } from "@/services/imageService";
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { 
  deleteTask,
  updateTaskStatus, 
  updateTaskPriority, 
  updateTaskEffort, 
  updateTaskAssignee
} from '@/redux/features/tasksSlice';
import { 
  fetchTaskDetail, 
  fetchComments, 
  updateTaskParent,
  searchParentTaskById,
  clearParentTaskSearch
} from '@/redux/features/taskDetailSlice';
import TaskDetailSubtasks from './TaskDetailSubtasks';
import CommentsTab from './tabs/CommentsTab';
import { isTiptapContentEmpty } from '@/utils/mentionUtils';
import { toast } from "sonner";
import { ProjectCatalogSelect } from '@/components/projects/ProjectCatalogSettingsPanel';
import type { ProjectCatalogKind } from '@/types/project-catalog';
import { taskDeletionConfirmationMessage } from '@/utils/task-deletion';

interface TaskDetailPageProps {
  task: Task;
  projectId: string;
  currentUser?: User;
  onTaskUpdate: (updates: Partial<Task>) => Promise<boolean>;
  isLoadingProp?: boolean;
  projectMembers?: {
    role: string;
    joinedAt: string;
    position?: string | null;
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
  initialCommentId?: string | null;
  initialActiveTab?: string;
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

// Đổi tên từ TaskComment thành LocalTaskComment để tránh xung đột
interface LocalTaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  username?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

interface TaskCommentsData {
  task_comments: LocalTaskComment[];
}

interface CreateCommentInput {
  content: string;
  taskId: string;
  parentId?: string;
  metadata?: Record<string, any>;
}

interface CreateCommentData {
  create_comment: LocalTaskComment;
}

export function TaskDetailPage({ 
  task, 
  projectId, 
  currentUser, 
  onTaskUpdate, 
  isLoadingProp = false, 
  projectMembers, 
  hideTitleHeader = false, 
  refetchMembers,
  initialCommentId = null,
  initialActiveTab = 'description'
}: TaskDetailPageProps) {
  const { t } = useTranslation();
  const router = useRouter();
  // Khai báo các biến cần dùng chung
  const taskId = task.task_id || task.id || '';
  const taskIdString = taskId.toString();
  
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isDescriptionEditing, setIsDescriptionEditing] = useState(false);
  const [editedTask, setEditedTask] = useState<Task>(task);
  const [isLoading, setIsLoading] = useState(isLoadingProp);
  const [isSaving, setIsSaving] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const commentRef = React.useRef<HTMLTextAreaElement>(null);
  const [activeTab, setActiveTab] = useState(initialActiveTab || 'description');
  const [userId, setUserId] = useState<string | null>(null);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [subtasks, setSubtasks] = useState<Task[]>(
    () => task.child_tasks?.filter((child) => child.parent_task_id === taskId) ?? []
  );
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(initialCommentId);
  
  // Thêm refs để theo dõi trạng thái API call và tránh gọi trùng lặp
  const apiCallsInProgressRef = useRef<{[key: string]: boolean}>({});
  const prevTaskIdRef = useRef<string | null>(null);
  const lastFetchTimeRef = useRef<{[key: string]: number}>({});
  
  // Apollo Client
  const apolloClient = useApolloClient();
  
  // Redux Dispatch
  const dispatch = useAppDispatch();
  
  // Dữ liệu từ Redux store
  const taskDetailState = useAppSelector(state => state.taskDetail);
  const { data: latestTaskData } = useQuery(GET_TASK_BY_ID, {
    variables: { taskId },
    skip: !taskId,
    fetchPolicy: 'cache-and-network',
  });
  
  // State cho parent task search
  const [availableParentTasks, setAvailableParentTasks] = useState<Task[]>([]);
  const [parentSearchQuery, setParentSearchQuery] = useState<string>('');
  const [parentTaskIdInput, setParentTaskIdInput] = useState<string>('');
  const [parentSearchTimeout, setParentSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isSearchingParent, setIsSearchingParent] = useState<boolean>(false);
  const [showParentResults, setShowParentResults] = useState<boolean>(false);
  const [tasksData, setTasksData] = useState<{tasks: any[]} | null>(null);
  const [parentTaskTitle, setParentTaskTitle] = useState<string>('');
  
  // Sử dụng useRef để theo dõi các editor
  const descriptionEditorRef = useRef<any>(null);
  const commentEditorRef = useRef<any>(null);
  
  // Các trường có thể edit
  const [editingField, setEditingField] = useState<string | null>(null);

  // GraphQL Queries và Mutations
  // Xóa dòng khai báo taskId và taskIdString ở đây vì đã được khai báo ở đầu component
  
  // Thêm state để lưu dữ liệu đã xử lý trước đó
  const [processedTaskIds, setProcessedTaskIds] = useState<Set<string>>(new Set());
  const isNavigatingRef = useRef<boolean>(false);
  const CACHE_TTL = 60000; // 1 phút cache

  // Hàm kiểm tra xem có nên gọi API không dựa trên thời gian gọi trước đó
  const shouldFetchData = useCallback((key: string, minInterval: number = 10000) => {
    const now = Date.now();
    const lastFetchTime = lastFetchTimeRef.current[key] || 0;
    const timeSinceLastFetch = now - lastFetchTime;
    const shouldFetch = timeSinceLastFetch >= minInterval;
    
    console.log(`[TaskDetailPage] Check if should fetch ${key}: time since last fetch = ${timeSinceLastFetch}ms, threshold = ${minInterval}ms, result = ${shouldFetch}`);
    return shouldFetch;
  }, []);

  // Hàm đánh dấu bắt đầu và kết thúc API call
  const markApiCallStatus = useCallback((key: string, inProgress: boolean) => {
    apiCallsInProgressRef.current[key] = inProgress;
    if (!inProgress) {
      lastFetchTimeRef.current[key] = Date.now();
    }
  }, []);

  // Fetch dữ liệu dựa trên taskId và kiểm tra các điều kiện
  useEffect(() => {
    if (!taskId) return;
    
    // Kiểm tra xem taskId có thay đổi không
    const isNewTask = prevTaskIdRef.current !== taskId;
    
    if (isNewTask) {
      console.log(`[TaskDetailPage] Task ID changed from ${prevTaskIdRef.current} to ${taskId}`);
      prevTaskIdRef.current = taskId;
      
      // Đánh dấu đang trong quá trình navigation
      isNavigatingRef.current = true;
      
      // Kiểm tra xem task này đã được xử lý gần đây chưa
      const isRecentlyProcessed = processedTaskIds.has(taskId);
      console.log(`[TaskDetailPage] Task ${taskId} recently processed: ${isRecentlyProcessed}`);
      
      // Reset API tracking nếu là task mới và chưa được xử lý gần đây
      if (!isRecentlyProcessed) {
        apiCallsInProgressRef.current = {};
        // Giữ lại lastFetchTimeRef để duy trì cache
      }
      
      // Thêm taskId vào danh sách đã xử lý
      setProcessedTaskIds(prev => {
        const newSet = new Set(prev);
        newSet.add(taskId);
        return newSet;
      });
      
      // Đặt lại trạng thái navigation sau một khoảng thời gian ngắn
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 500);
    }
    
    // Tạo ID key duy nhất cho mỗi call API dựa trên taskId hiện tại
    const currentTaskDetailKey = `task_detail_${taskId}`;
    const currentCommentsKey = `comments_${taskId}`;
    
    // Kiểm tra xem có đang trong quá trình navigation không
    if (isNavigatingRef.current) {
      console.log(`[TaskDetailPage] In navigation process, waiting to settle before new API calls`);
      return;
    }
    
    // Chỉ fetch task detail nếu chưa có hoặc taskId thay đổi
    const hasValidTaskDetail = taskDetailState.task && taskDetailState.task.task_id === taskId;
    const shouldFetchTaskDetail = (isNewTask || !hasValidTaskDetail) && 
                                 !apiCallsInProgressRef.current[currentTaskDetailKey] && 
                                 shouldFetchData(currentTaskDetailKey, CACHE_TTL);
    
    if (shouldFetchTaskDetail) {
      console.log(`[TaskDetailPage] Fetching task detail for task ID: ${taskId}`);
      markApiCallStatus(currentTaskDetailKey, true);
      
      dispatch(fetchTaskDetail(taskId))
        .then(() => markApiCallStatus(currentTaskDetailKey, false))
        .catch(err => {
          console.error(`[TaskDetailPage] Error fetching task detail:`, err);
          markApiCallStatus(currentTaskDetailKey, false);
        });
    } else if (!shouldFetchTaskDetail) {
      console.log(`[TaskDetailPage] Skipping task detail fetch for ${taskId} - already fetched or in progress`);
    }
    
    // Chỉ fetch comments nếu chưa có hoặc taskId thay đổi
    const hasValidComments = taskDetailState.comments.length > 0;
    const shouldFetchComments = (isNewTask || !hasValidComments) && 
                               !apiCallsInProgressRef.current[currentCommentsKey] && 
                               shouldFetchData(currentCommentsKey, CACHE_TTL);
    
    if (shouldFetchComments) {
      console.log(`[TaskDetailPage] Fetching comments for task ID: ${taskId}`);
      markApiCallStatus(currentCommentsKey, true);
      
      dispatch(fetchComments(taskId))
        .then(() => markApiCallStatus(currentCommentsKey, false))
        .catch(err => {
          console.error(`[TaskDetailPage] Error fetching comments:`, err);
          markApiCallStatus(currentCommentsKey, false);
        });
    } else if (!shouldFetchComments) {
      console.log(`[TaskDetailPage] Skipping comments fetch for ${taskId} - already fetched or in progress`);
    }
    
    // Xóa các taskId quá cũ từ danh sách đã xử lý
    const now = Date.now();
    if (now % 10 === 0) { // Chỉ thực hiện định kỳ để giảm tải
      console.log('[TaskDetailPage] Cleaning up processed tasks cache');
      setProcessedTaskIds(prev => {
        const newSet = new Set(prev);
        if (newSet.size > 20) { // Giới hạn số lượng taskId lưu trữ
          // Giữ lại 10 taskId gần nhất
          const toKeep = Array.from(newSet).slice(-10);
          return new Set(toKeep);
        }
        return newSet;
      });
    }
  }, [dispatch, taskId, taskDetailState.task?.task_id, shouldFetchData, markApiCallStatus, processedTaskIds, taskDetailState.comments.length]);
  
  // Di chuyển useMemo ra khỏi useEffect và đặt nó trực tiếp trong component
  // Tạo hàm utility để so sánh dữ liệu thay vì dùng useMemo trong useEffect
  const compareSubtasks = (currentSubtasks: Task[], newSubtasks: Task[]) => {
    if (!currentSubtasks || !newSubtasks) return false;
    if (currentSubtasks.length !== newSubtasks.length) return true;
    
    // So sánh ID để kiểm tra xem danh sách có thay đổi không
    const currentIds = currentSubtasks.map(task => task.task_id).sort().join(',');
    const newIds = newSubtasks.map(task => task.task_id).sort().join(',');
    return currentIds !== newIds;
  };

  const compareComments = (currentComments: TaskComment[], newComments: TaskComment[]) => {
    if (!currentComments || !newComments) return false;
    if (currentComments.length !== newComments.length) return true;
    
    // So sánh ID để kiểm tra xem danh sách có thay đổi không
    const currentIds = currentComments.map(comment => comment.id).sort().join(',');
    const newIds = newComments.map(comment => comment.id).sort().join(',');
    return currentIds !== newIds;
  };

  // Đồng bộ dữ liệu từ Redux store vào local state
  useEffect(() => {
    // Prefer the matching network detail; never show another task's cached children.
    const nextSubtasks = taskDetailState.task?.task_id === taskId
      ? taskDetailState.subtasks
      : task.child_tasks?.filter((child) => child.parent_task_id === taskId) ?? [];
    const hasSubtasksChanged = compareSubtasks(subtasks, nextSubtasks);
    const hasCommentsChanged = compareComments(comments, taskDetailState.comments);

    // The detail query is authoritative for direct children, including an empty list.
    if (hasSubtasksChanged) {
      setSubtasks(nextSubtasks);
    }
    
    // Cập nhật comments từ Redux nếu có sự thay đổi
    if (hasCommentsChanged && taskDetailState.comments.length > 0) {
      console.log('[TaskDetailPage] Updating comments from Redux store');
      setComments(taskDetailState.comments);
    }
    
    // Cập nhật task từ Redux store và xử lý parent task
    if (taskDetailState.task && taskDetailState.task.task_id === taskId) {
      const reduxTask = taskDetailState.task;
      
      // Chỉ cập nhật parent_task_id nếu đã thay đổi
      if (reduxTask.parent_task_id !== editedTask.parent_task_id) {
        console.log('[TaskDetailPage] Updating parent_task_id in editedTask', {
          old: editedTask.parent_task_id,
          new: reduxTask.parent_task_id
        });
        
        setEditedTask(prev => ({
          ...prev,
          parent_task_id: reduxTask.parent_task_id
        }));
        
        // Fetch parent task info nếu cần
        if (reduxTask.parent_task_id && 
            (!parentTaskTitle || parentTaskTitle.trim() === '')) {
          const PARENT_INFO_KEY = `parent_info_${reduxTask.parent_task_id}`;
          
          if (!apiCallsInProgressRef.current[PARENT_INFO_KEY]) {
            console.log('[TaskDetailPage] Fetching parent task info:', reduxTask.parent_task_id);
            markApiCallStatus(PARENT_INFO_KEY, true);
            
            apolloClient.query({
              query: GET_TASK_BASIC_INFO,
              variables: { taskId: reduxTask.parent_task_id },
              fetchPolicy: 'network-only'
            })
            .then(response => {
              if (response.data?.task) {
                const title = response.data.task.title || '';
                console.log('[TaskDetailPage] Parent task title fetched:', title);
                setParentTaskTitle(title);
              }
              markApiCallStatus(PARENT_INFO_KEY, false);
            })
            .catch(error => {
              console.error('Lỗi khi lấy thông tin task cha:', error);
              markApiCallStatus(PARENT_INFO_KEY, false);
            });
          }
        } else if (!reduxTask.parent_task_id) {
          // Xóa title nếu không có parent task
          console.log('[TaskDetailPage] No parent task, clearing parent task title');
          setParentTaskTitle('');
        }
      }
    }
  }, [
    taskDetailState,
    task,
    apolloClient, 
    editedTask.parent_task_id, 
    parentTaskTitle, 
    taskId, 
    subtasks, 
    comments, 
    markApiCallStatus
  ]);

  const { loading: commentsLoading, data: commentsData, refetch: refetchComments } = 
    useQuery<TaskCommentsData>(GET_TASK_COMMENTS, {
      variables: { taskId },
      skip: !taskId,
    });

  const [createComment, { loading: createCommentLoading }] = 
    useMutation<CreateCommentData, { input: CreateCommentInput }>(CREATE_TASK_COMMENT);
    
  const [deleteComment] = useMutation(DELETE_TASK_COMMENT);

  // Khởi tạo tất cả modules Quill khi component mount
  useEffect(() => {
    // Chúng ta đã chuyển phần này vào dynamic import của ReactQuill
  }, []);

  // Định dạng ngày tháng
  const formatDate = (dateString?: string) => {
    if (!dateString) return t('common.notSet');
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
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

  // Tính số ngày còn lại
  const calculateDaysRemaining = () => {
    if (!task.due_date) return null;
    
    const today = new Date();
    const dueDate = new Date(task.due_date);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return t('common.overdue', { count: Math.abs(diffDays) });
    } else if (diffDays === 0) {
      return t('common.dueToday');
    } else {
      return t('common.daysRemaining', { count: diffDays });
    }
  };

  // Định dạng effort thành giờ hoặc ngày
  const formatEffort = (effort?: number) => {
    if (!effort) return t('common.notSet');

    if (effort < 8) {
      return `${effort} ${t('common.hours')}`;
    } else {
      const days = Math.floor(effort / 8);
      const hours = effort % 8;
      return hours > 0
        ? `${days} ${t('common.days')} ${hours} ${t('common.hours')}`
        : `${days} ${t('common.days')}`;
    }
  };

  // Màu sắc trạng thái
  const getStatusColor = (status: TaskStatus) => {
    const colors: Record<string, string> = {
      'TODO': 'bg-gray-100 text-gray-800',
      'DOING': 'bg-blue-100 text-blue-800',
      'DONE': 'bg-green-100 text-green-800',
      'CLOSE': 'bg-green-100 text-green-800',
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'REVIEW': 'bg-purple-100 text-purple-800',
      'BLOCKED': 'bg-red-100 text-red-800',
      'REJECTED': 'bg-red-100 text-red-800',
      'ARCHIVED': 'bg-gray-100 text-gray-800',
    };
    return colors[status] || colors['TODO'];
  };

  // Màu sắc ưu tiên
  const getPriorityColor = (priority: Priority) => {
    const colors: Record<string, string> = {
      'LOW': 'bg-green-100 text-green-800',
      'MEDIUM': 'bg-yellow-100 text-yellow-800',
      'HIGH': 'bg-orange-100 text-orange-800',
      'URGENT': 'bg-red-100 text-red-800',
      'CRITICAL': 'bg-red-100 text-red-800 font-bold',
    };
    return colors[priority] || colors['MEDIUM'];
  };
  
  // Hiển thị các trường editable
  const renderEditableField = (label: string, fieldName: string, type: 'text' | 'number' | 'date' | 'select' = 'text', options?: {value: string, label: string}[]) => {
    // Lấy giá trị hiển thị cho từng trường
    let displayValue: string | React.ReactNode = '';
    const value = (editedTask as any)[fieldName];
    
    // Xác định giá trị hiển thị dựa trên loại trường
    if (fieldName === 'status') {
      displayValue = getStatusLabel(value as TaskStatus) || value || t('common.notSet');
    } else if (fieldName === 'priority') {
      displayValue = getPriorityLabel(value as Priority) || value || t('common.notSet');
    } else if (type === 'date') {
      displayValue = value ? formatDate(value) : t('common.notSet');
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
            <span>{value.username || value.fullName || t('common.notAssigned')}{value.position ? ` (${value.position})` : ''}</span>
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
            <span>
              {assigneeData?.user?.username || assigneeData?.user?.fullName || String(value)}
              {assigneeData?.position ? ` (${assigneeData.position})` : ''}
            </span>
          </div>
        );
      } else {
        displayValue = t('common.notAssigned');
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
            <span>{value.username || t('common.unknown')}</span>
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
              <span>{creatorData.user.username || creatorData.user.fullName || t('common.unknown')}{creatorData.position ? ` (${creatorData.position})` : ''}</span>
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
        displayValue = t('common.unknown');
      }
    } else if (fieldName === 'progress') {
      displayValue = value ? `${value}%` : '0%';
    } else if (fieldName === 'effort') {
      displayValue = formatEffort(value);
    } else if (fieldName === 'progress_type') {
      displayValue = value ? (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          {value}
        </span>
      ) : t('common.notSet');
    } else {
      // Đảm bảo displayValue luôn là string hoặc ReactNode, không phải object
      displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value || '');
    }

    return (
      <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50 mb-2">
        {editingField === fieldName ? (
          <div className="w-full space-y-2">
            <label className="block text-sm font-medium text-gray-700" htmlFor={`field-${fieldName}`}>{label}</label>
            
            {type === 'select' && options ? (
                <select
                id={`field-${fieldName}`}
                  title={`Chọn ${label.toLowerCase()}`}
                value={typeof value === 'object' ? (value?.userId || value?.id || '') : (value || '')}
                  onChange={(e) => {
                    if (fieldName === 'assignee') {
                      if (e.target.value) {
                        const selectedMember = projectMembers?.find(member => 
                          member.user.userId === e.target.value
                        );

                        if (selectedMember) {
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
                        setEditedTask({
                          ...editedTask,
                          assignee: undefined
                        });
                        }
                      } else {
                      setEditedTask({
                        ...editedTask,
                        assignee: undefined
                      });
                      }
                    } else {
                    setEditedTask({...editedTask, [fieldName]: e.target.value});
                  }
                }}
                className="block w-full max-w-md rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2.5 bg-white"
                style={{ height: "42px", fontSize: "15px" }}
              >
                {options.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              ) : type === 'date' ? (
                <div className="flex items-center gap-2 max-w-md">
                  <input
                    id={`field-${fieldName}`}
                    type="date"
                    title={`Chọn ${label.toLowerCase()}`}
                    placeholder={`Nhập ${label.toLowerCase()}`}
                    value={value || ''}
                    onChange={(e) => setEditedTask({...editedTask, [fieldName]: e.target.value || null})}
                    className="block flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2.5"
                    style={{ height: "42px", fontSize: "15px" }}
                  />
                  {value && (
                    <button
                      type="button"
                      onClick={() => setEditedTask({...editedTask, [fieldName]: null})}
                      className="text-gray-400 hover:text-gray-600 text-sm px-2"
                      title={t('tasks.actions.clearDate')}
                    >
                      ✕
                    </button>
                  )}
                </div>
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
                className="block w-full max-w-md rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2.5"
                style={{ height: "42px", fontSize: "15px" }}
                />
              ) : (
                <input
                id={`field-${fieldName}`}
                  type="text"
                  title={`Nhập ${label.toLowerCase()}`}
                  placeholder={`Nhập ${label.toLowerCase()}`}
                value={typeof value === 'object' ? JSON.stringify(value) : (value || '')}
                onChange={(e) => setEditedTask({...editedTask, [fieldName]: e.target.value})}
                className="block w-full max-w-md rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2.5"
                style={{ height: "42px", fontSize: "15px" }}
              />
            )}
            
            <div className="flex mt-3 space-x-3">
              <button
                onClick={() => saveField(fieldName)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                disabled={isSaving}
              >
                {isSaving ? t('tasks.actions.saving') : t('tasks.actions.save')}
              </button>
              <button
                onClick={cancelEditing}
                className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 transition-colors"
              >
                {t('tasks.actions.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <>
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
                className="ml-1.5 p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                title={`Chinh sua ${label.toLowerCase()}`}
                onClick={() => startEditing(fieldName)}
              >
                <PencilIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderCatalogEditableField = (
    label: string,
    fieldName: 'progressCatalogItemId' | 'categoryCatalogItemId' | 'taskTypeCatalogItemId',
    kind: ProjectCatalogKind,
    legacyLabel?: string | null,
  ) => (
    <div className="py-1.5 rounded-md hover:bg-gray-50 mb-2">
      <div className="flex items-start gap-3">
        <div className="w-1/3 pt-2 text-sm font-medium text-gray-700">{label}:</div>
        <div className="flex-1">
          <ProjectCatalogSelect
            projectId={projectId}
            kind={kind}
            label={label}
            value={editedTask[fieldName]}
            legacyLabel={legacyLabel}
            disabled={editingField !== fieldName || isSaving}
            onChange={(value) => setEditedTask({ ...editedTask, [fieldName]: value })}
          />
          {editingField === fieldName ? (
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => void saveField(fieldName)} disabled={isSaving} className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50">{isSaving ? t('tasks.actions.saving') : t('tasks.actions.save')}</button>
              <button type="button" onClick={cancelEditing} className="rounded bg-gray-200 px-3 py-1.5 text-sm text-gray-700">{t('tasks.actions.cancel')}</button>
            </div>
          ) : (
            <button type="button" onClick={() => startEditing(fieldName)} className="mt-1 text-xs text-blue-600">Edit {label.toLowerCase()}</button>
          )}
        </div>
      </div>
    </div>
  );

  // Cập nhật hàm handleCommentChange
  const handleCommentChange = useCallback((content: string) => {
    console.log('Comment changed:', content?.substring(0, 50));
    setNewComment(content || '');
  }, []);

  // Xử lý gửi comment với GraphQL - đã khôi phục API call
  const handleSubmitComment = async () => {
    if (isTiptapContentEmpty(newComment) || !currentUser) return;
    
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
      const tempComment: TaskComment = {
        id: tempId,
        content: processedContent,
        user_id: currentUser?.id || 'unknown', // Sửa từ uid thành id
        username: currentUser?.name || t('common.unknown'),
        avatar_url: currentUser?.providerData?.[0]?.photoURL || undefined,
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
              task_id: taskId,
            }
          }
        });
        
        if (data && data.create_comment) {
          // Nếu API thành công, cập nhật comment tạm thời với dữ liệu thực
          const updatedComment: TaskComment = {
            id: data.create_comment.id,
            content: data.create_comment.content,
            user_id: data.create_comment.user_id,
            username: data.create_comment.username || currentUser?.name || '',
            avatar_url: data.create_comment.avatar_url || currentUser?.providerData?.[0]?.photoURL || undefined,
            created_at: data.create_comment.created_at,
            status: 'saved'
          };
          
          setComments(prevComments => 
            prevComments.map(comment => 
              comment.id === tempId ? updatedComment : comment
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
            comment.id === tempId ? { ...comment, status: 'failed' } : comment
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

  // Xử lý khi người dùng chọn một thành viên để mention
  const handleMentionSelect = (userId: string, username: string) => {
    console.log(`Mentioned user: ${username} (${userId})`);
    // Có thể thêm logic bổ sung ở đây nếu cần
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
              task_id: taskId,
            }
          }
        });
        
        if (data && data.create_comment) {
          // Nếu API thành công, cập nhật comment với dữ liệu thực
          const updatedComment: TaskComment = {
            id: data.create_comment.id,
            content: data.create_comment.content,
            user_id: data.create_comment.user_id,
            username: data.create_comment.username || currentUser?.name || '',
            avatar_url: data.create_comment.avatar_url || currentUser?.providerData?.[0]?.photoURL || undefined,
            created_at: data.create_comment.created_at,
            status: 'saved'
          };
          
          setComments(prevComments => 
            prevComments.map(comment => 
              comment.id === commentId ? updatedComment : comment
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
            comment.id === commentId ? { ...comment, status: 'failed' } : comment
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
      toast.success('Đã xóa bình luận thành công');
      return;
    }
    
    // Nếu là comment đã lưu, gọi API xóa
    try {
      deleteComment({
        variables: {
          commentId: commentId
        }
      })
      .then(() => {
        toast.success('Đã xóa bình luận thành công');
      })
      .catch((error) => {
        console.error('Error deleting comment:', error);
        // Thông báo lỗi cho người dùng
        toast.error('Không thể xóa bình luận. Vui lòng thử lại sau.');
        // Nếu lỗi, khôi phục comment
        if (commentsData && commentsData.task_comments) {
          const formattedComments: TaskComment[] = commentsData.task_comments.map(comment => ({
            id: comment.id,
            content: comment.content,
            user_id: comment.user_id,
            username: comment.username || '',
            avatar_url: comment.avatar_url,
            created_at: comment.created_at,
            updated_at: comment.updated_at
          }));
          setComments(formattedComments);
        }
      });
    } catch (error) {
      console.error('Error processing delete comment:', error);
      toast.error('Đã xảy ra lỗi khi xóa bình luận.');
      // Không cần refetch
    }
  };

  // Chuyển đổi dữ liệu comment từ GraphQL sang định dạng cần thiết
  useEffect(() => {
    if (commentsData && commentsData.task_comments) {
      const formattedComments: TaskComment[] = commentsData.task_comments.map(comment => ({
        id: comment.id,
        content: comment.content,
        user_id: comment.user_id,
        username: comment.username || '',
        avatar_url: comment.avatar_url,
        created_at: comment.created_at,
        updated_at: comment.updated_at
      }));
      setComments(formattedComments);
      setIsLoading(false);
    }
  }, [commentsData]);

  // Parent-page normalization predates catalog IDs. Merge the mounted task query
  // without collapsing explicit null (clear) into undefined (omitted).
  useEffect(() => {
    const apiTask = latestTaskData?.task?.task_id === taskId ? latestTaskData.task : undefined;
    const catalogValue = (snakeCase: string, camelCase: keyof Task) => {
      if (apiTask && Object.prototype.hasOwnProperty.call(apiTask, snakeCase)) return apiTask[snakeCase];
      return task[camelCase];
    };
    setEditedTask({
      ...task,
      progressCatalogItemId: catalogValue('progress_catalog_item_id', 'progressCatalogItemId'),
      categoryCatalogItemId: catalogValue('category_catalog_item_id', 'categoryCatalogItemId'),
      taskTypeCatalogItemId: catalogValue('task_type_catalog_item_id', 'taskTypeCatalogItemId'),
    });
  }, [task, taskId, latestTaskData]);

  const handleDelete = async (reason: 'delete' | 'reject') => {
    if (!window.confirm(taskDeletionConfirmationMessage(task, reason))) return false;
    try {
      setIsSaving(true);
      setError(null);
      await dispatch(deleteTask({ taskId })).unwrap();
      router.replace(`/projects/${projectId}`);
      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      setError('Could not delete task.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

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
          case 'actual_start_date':
            updates.actual_start_date = editedTask.actual_start_date;
            break;
          case 'actual_end_date':
            updates.actual_end_date = editedTask.actual_end_date;
            break;
          case 'progressCatalogItemId':
            updates.progressCatalogItemId = editedTask.progressCatalogItemId ?? null;
            break;
          case 'categoryCatalogItemId':
            updates.categoryCatalogItemId = editedTask.categoryCatalogItemId ?? null;
            break;
          case 'taskTypeCatalogItemId':
            updates.taskTypeCatalogItemId = editedTask.taskTypeCatalogItemId ?? null;
            break;
          case 'tags':
            updates.tags = editedTask.tags;
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
        if (editedTask.actual_start_date !== task.actual_start_date) updates.actual_start_date = editedTask.actual_start_date;
        if (editedTask.actual_end_date !== task.actual_end_date) updates.actual_end_date = editedTask.actual_end_date;
        if (editedTask.progressCatalogItemId !== task.progressCatalogItemId) updates.progressCatalogItemId = editedTask.progressCatalogItemId ?? null;
        if (editedTask.categoryCatalogItemId !== task.categoryCatalogItemId) updates.categoryCatalogItemId = editedTask.categoryCatalogItemId ?? null;
        if (editedTask.taskTypeCatalogItemId !== task.taskTypeCatalogItemId) updates.taskTypeCatalogItemId = editedTask.taskTypeCatalogItemId ?? null;
      }
      
      if (updates.status === TaskStatuses.REJECTED) {
        await handleDelete('reject');
        return;
      }

      // Gọi hàm update từ props
      const success = await onTaskUpdate(updates);
      
      if (success) {
        setIsEditing(false);
        setIsDescriptionEditing(false);
        setEditingField(null);
      } else {
        setError('Không thể cập nhật công việc. Vui lòng thử lại sau.');
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

  const saveField = async (field: string) => {
    await handleSaveTask(field);
  };

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
  const renderComment = (comment: TaskComment) => {
    const isHighlighted = highlightedCommentId === comment.id;
    const isAuthor = currentUser && comment.user_id === currentUser.id;
    
    return (
      <div 
        id={`comment-${comment.id}`}
        key={comment.id}
        className={`comment-container ${isHighlighted ? 'highlight-comment' : ''}`}
      >
        <CommentCard
          comment={comment}
          currentUserId={currentUser?.id}
          onDelete={
            // Show delete option for failed comments or if user is the comment author
            comment.status === 'failed' || isAuthor
              ? () => handleDeleteFailedComment(comment.id)
              : undefined
          }
        />
      </div>
    );
  };

  // Thêm useEffect mới để đảm bảo luôn fetch parent task title khi component mount
  useEffect(() => {
    // Kiểm tra xem task có parent_task_id không và parentTaskTitle chưa được thiết lập
    if (task?.parent_task_id && (!parentTaskTitle || parentTaskTitle.trim() === '')) {
      const PARENT_INFO_KEY = `parent_info_${task.parent_task_id}`;
      
      if (!apiCallsInProgressRef.current[PARENT_INFO_KEY]) {
        console.log('[TaskDetailPage] Fetching parent task title on mount:', task.parent_task_id);
        markApiCallStatus(PARENT_INFO_KEY, true);
        
        apolloClient.query({
          query: GET_TASK_BASIC_INFO,
          variables: { taskId: task.parent_task_id },
          fetchPolicy: 'cache-first' // Sử dụng cache nếu có, nếu không thì gọi network
        })
        .then(response => {
          if (response.data?.task) {
            const title = response.data.task.title || '';
            console.log('[TaskDetailPage] Parent task title fetched on mount:', title);
            setParentTaskTitle(title);
          }
          markApiCallStatus(PARENT_INFO_KEY, false);
        })
        .catch(error => {
          console.error('[TaskDetailPage] Error fetching parent task info on mount:', error);
          markApiCallStatus(PARENT_INFO_KEY, false);
        });
      }
    }
  }, [task?.parent_task_id, apolloClient, parentTaskTitle, markApiCallStatus]);

  // Add effect to scroll to and highlight comment when initialCommentId changes
  useEffect(() => {
    if (initialCommentId && comments.length > 0) {
      console.log(`[TaskDetailPage] Highlighting comment: ${initialCommentId}`);
      
      // Set active tab to comments
      setActiveTab('comments');
      
      // Set highlighted comment
      setHighlightedCommentId(initialCommentId);
      
      // Small delay to ensure DOM is ready and comments are rendered
      setTimeout(() => {
        const commentElement = document.getElementById(`comment-${initialCommentId}`);
        if (commentElement) {
          console.log(`[TaskDetailPage] Scrolling to comment element`);
          commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          commentElement.classList.add('comment-highlight-animation');
        } else {
          console.log(`[TaskDetailPage] Comment element not found`);
        }
      }, 300);
    }
  }, [initialCommentId, comments.length]);

  // Add parent task search handlers
  const handleTaskSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParentTaskIdInput(e.target.value);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchClick();
    }
  };

  const handleSearchClick = () => {
    if (parentTaskIdInput) {
      dispatch(searchParentTaskById(parentTaskIdInput));
      setShowParentResults(true);
    }
  };
  
  // Add missing utility functions for subtasks effort and progress
  const formatEffortWithRemaining = (tasks: Task[]) => {
    let totalEffort = 0;
    let completedEffort = 0;
    
    tasks.forEach(task => {
      const effort = task.effort || 0;
      totalEffort += effort;
      
      if (task.status === 'DONE') {
        completedEffort += effort;
      }
    });

    return `${completedEffort}/${totalEffort} giờ`;
  };

  const calculateProgress = (tasks: Task[]) => {
    if (!tasks || tasks.length === 0) return 0;

    let totalEffort = 0;
    let completedEffort = 0;

    tasks.forEach(task => {
      const effort = task.effort || 0;
      totalEffort += effort;

      if (task.status === 'DONE') {
        completedEffort += effort;
      } else if (task.status === 'DOING' && task.progress) {
        completedEffort += (effort * (task.progress / 100));
      }
    });
    
    if (totalEffort === 0) return 0;
    return Math.round((completedEffort / totalEffort) * 100);
  };

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

          /* Code block styles */
          .rich-text-content pre {
            background-color: #1e1e1e;
            color: #d4d4d4;
            border-radius: 0.375rem;
            padding: 1rem;
            margin: 0.75rem 0;
            overflow-x: auto;
            font-family: 'Cascadia Code', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 0.875rem;
            line-height: 1.6;
            white-space: pre;
            tab-size: 2;
          }

          .rich-text-content pre code {
            background: none;
            border: none;
            padding: 0;
            font-family: inherit;
            font-size: inherit;
            color: inherit;
            white-space: pre;
          }

          /* Inline code */
          .rich-text-content code {
            background-color: #f3f4f6;
            color: #e11d48;
            border-radius: 0.25rem;
            padding: 0.1rem 0.35rem;
            font-family: 'Cascadia Code', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 0.85em;
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
          top: 80px; /* 64px header + 16px spacing so content isn't hidden behind fixed header */
          border-radius: 0.5rem 0 0 0.5rem;
          box-shadow: 4px 0 10px rgba(0, 0, 0, 0.1);
          z-index: 10;
          height: fit-content;
          max-height: calc(100vh - 96px); /* viewport minus header and padding */
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

        /* Add highlighting styles for comments */
        .comment-highlight {
          position: relative;
          background-color: rgba(59, 130, 246, 0.08);
          border-radius: 0.5rem;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
        }
        
        @keyframes highlightFade {
          0% { background-color: rgba(59, 130, 246, 0.3); }
          100% { background-color: rgba(59, 130, 246, 0.08); }
        }
        
        .comment-highlight-animation {
          animation: highlightFade 2s ease;
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
                  placeholder={t('tasks.titlePlaceholder')}
                  aria-label={t('tasks.titlePlaceholder')}
                />
                <div className="flex space-x-2">
                  <button 
                    onClick={() => saveField('title')} 
                    className="p-1 text-blue-600 hover:text-blue-800 rounded-full hover:bg-blue-50 flex items-center"
                    title={t('tasks.actions.save')}
                    aria-label={t('tasks.actions.save')}
                  >
                    <CheckIcon className="h-4 w-4" />
                    <span className="ml-1 text-sm">{t('tasks.actions.save')}</span>
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="p-1 text-red-600 hover:text-red-800 rounded-full hover:bg-red-50 flex items-center"
                    title={t('tasks.actions.cancel')}
                    aria-label={t('tasks.actions.cancel')}
                  >
                    <XMarkIcon className="h-4 w-4" />
                    <span className="ml-1 text-sm">{t('tasks.actions.cancel')}</span>
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
                  {editedTask.title}
                </h1>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void handleDelete('delete')}
                    className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => startEditing('title')}
                    className="p-1 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100"
                    title="Chỉnh sửa tiêu đề"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Hiển thị parent task nếu có */}
            <div className="mt-2 mb-3">
              <div className="text-sm font-medium text-gray-700 mb-1">Parent task:</div>
              {task.parent_task_id ? (
                <div className="flex items-center">
                  <Link 
                    href={`/projects/${projectId}/tasks/${task.parent_task_id}`}
                    className="text-blue-600 hover:text-blue-800 truncate flex items-center"
                  >
                    {parentTaskTitle ? (
                      <span>{parentTaskTitle}</span>
                    ) : (
                      <>
                        <span className="mr-2">
                          <Spinner size="sm" />
                        </span>
                        <span className="text-gray-500">{t('tasks.actions.loadingInfo')}</span>
                      </>
                    )}
                  </Link>
                  <button 
                    onClick={() => {
                      dispatch(updateTaskParent({ 
                        taskId: task.task_id, 
                        parentTaskId: "" // Gửi string rỗng để xóa parent
                      }));
                    }}
                    className="ml-2 p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100"
                    title={t('tasks.actions.removeParentLink')}
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                // Phần còn lại của form tìm kiếm và thêm parent task (giữ nguyên)
                <div className="p-2 border border-gray-200 rounded-md bg-gray-50">
                  <div className="relative mb-2">
                    <input 
                      type="text"
                      value={parentTaskIdInput}
                      onChange={handleTaskSearchInputChange}
                      onKeyDown={handleSearchKeyDown}
                      placeholder={t('tasks.actions.searchParentTask')}
                      className="w-full border border-gray-300 rounded-md p-2 pr-10 text-sm"
                    />
                    <button
                      onClick={handleSearchClick}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-blue-600"
                      title={t('tasks.actions.search')}
                    >
                      <MagnifyingGlassIcon className="h-5 w-5" />
                    </button>
                  </div>
                  
                  {taskDetailState.searchingParent && (
                    <div className="flex justify-center py-2">
                      <Spinner size="sm" />
              </div>
            )}
                  
                  {/* Hiển thị kết quả tìm kiếm */}
                  {showParentResults && taskDetailState.potentialParentTask && (
                    <div className="mt-2 border border-gray-200 rounded-md bg-white shadow-sm">
                      <div className="p-2 hover:bg-blue-50 cursor-pointer flex justify-between items-center">
                        <div className="truncate">
                          <span className="font-medium">{taskDetailState.potentialParentTask.title}</span>
                          <span className="text-xs text-gray-500 ml-2">({taskDetailState.potentialParentTask.taskId})</span>
          </div>
                        <button 
                          className="ml-2 text-blue-600 text-sm hover:text-blue-800 whitespace-nowrap"
                          onClick={() => {
                            dispatch(updateTaskParent({ 
                              taskId: task.task_id, 
                              parentTaskId: taskDetailState.potentialParentTask!.taskId 
                            }));
                            setParentTaskIdInput('');
                            setShowParentResults(false);
                          }}
                        >
                          {t('tasks.actions.addParentTask')}
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Thông báo không tìm thấy */}
                  {showParentResults && !taskDetailState.potentialParentTask && !taskDetailState.searchingParent && taskDetailState.error && (
                    <div className="text-sm text-red-500 py-2 text-center">
                      {taskDetailState.error}
                    </div>
                  )}
                  
                  {/* Nút đóng kết quả tìm kiếm */}
                  {showParentResults && (
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => {
                          setShowParentResults(false);
                          dispatch(clearParentTaskSearch());
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        {t('tasks.actions.closeResults')}
                      </button>
                    </div>
                  )}
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
                {t('tasks.tabs.description')}
              </button>
              <button
                className={`tab-item ${activeTab === 'details' ? 'active' : ''}`}
                onClick={() => setActiveTab('details')}
              >
                <DocumentTextIcon className="h-4 w-4 mr-2" />
                {t('tasks.tabs.details')}
              </button>
              <button
                className={`tab-item ${activeTab === 'comments' ? 'active' : ''}`}
                onClick={() => setActiveTab('comments')}
              >
                <ChatBubbleLeftIcon className="h-4 w-4 mr-2" />
                {t('tasks.tabs.comments')}
              </button>
              <button 
                className={`tab-item ${activeTab === 'subtasks' ? 'active' : ''}`}
                onClick={() => setActiveTab('subtasks')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                {t('tasks.subtasks.subtaskCount', { count: subtasks.length })}
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
                <h2 className="text-lg font-medium text-gray-900 mb-4">{t('tasks.sections.detailedInfo')}</h2>
                
                <div className="grid grid-cols-1 gap-2">
                  {/* Status */}
                  {renderEditableField(t('tasks.fields.status'), 'status', 'select',
                    Object.values(TaskStatuses).map(value => ({
                      value,
                      label: getStatusLabel(value)
                    })))}

                  {/* Priority */}
                  {renderEditableField(t('tasks.fields.priority'), 'priority', 'select',
                    Object.values(Priorities).map(value => ({
                      value,
                      label: getPriorityLabel(value)
                    })))}

                  {/* Timeline */}
                  <div className="mt-6 border-t border-gray-200 pt-4">
                    <h3 className="text-base font-medium text-gray-900 mb-3">{t('tasks.sections.timeline')}</h3>
                    {renderEditableField(t('tasks.fields.startDate'), 'start_date', 'date')}
                    {renderEditableField(t('tasks.fields.dueDate'), 'due_date', 'date')}

                    {renderEditableField(t('tasks.fields.actualStartDate'), 'actual_start_date', 'date')}
                    {renderEditableField(t('tasks.fields.actualEndDate'), 'actual_end_date', 'date')}

                    {calculateDaysRemaining() && (
                      <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
                        <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">{t('tasks.fields.timeRemaining')}:</div>
                        <div className="flex-1">
                          <span className={`inline-block px-2 py-1 text-sm rounded ${calculateDaysRemaining()?.includes('Quá hạn') || calculateDaysRemaining()?.includes('Overdue') || calculateDaysRemaining()?.includes('超過') ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                            {calculateDaysRemaining()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Assignees */}
                  <div className="mt-6 border-t border-gray-200 pt-4">
                    <h3 className="text-base font-medium text-gray-900 mb-3">{t('tasks.sections.assignees')}</h3>
                    {renderEditableField(t('tasks.fields.assignedTo'), 'assignee', 'select',
                      projectMembers && projectMembers.length > 0 ?
                        [{ value: '', label: t('common.notAssigned') }, ...projectMembers.map(member => ({
                          value: member.user.userId,
                          label: (member.user.username || member.user.fullName || member.user.email) + (member.position ? ` (${member.position})` : '')
                        }))] :
                        [{ value: '', label: t('common.notAssigned') }]
                    )}

                    {renderEditableField(t('tasks.fields.createdBy'), 'created_by')}
                  </div>

                  {/* Effort & Progress */}
                  <div className="mt-6 border-t border-gray-200 pt-4">
                    <h3 className="text-base font-medium text-gray-900 mb-3">{t('tasks.sections.effortAndProgress')}</h3>
                    {subtasks.length === 0 ? (
                      <>
                        {renderEditableField(t('tasks.fields.effort'), 'effort', 'number')}
                        {renderEditableField(t('tasks.fields.progress'), 'progress', 'number')}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
                          <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">{t('tasks.fields.effortLabel')}:</div>
                          <div className="flex-1 text-sm text-gray-900">
                            {formatEffortWithRemaining(subtasks)}
                          </div>
                        </div>
                        <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
                          <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">{t('tasks.fields.progressLabel')}:</div>
                          <div className="flex-1 text-sm text-gray-900">
                            {calculateProgress(subtasks)}%
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Classification */}
                  <div className="mt-6 border-t border-gray-200 pt-4">
                    <h3 className="text-base font-medium text-gray-900 mb-3">{t('tasks.sections.classification')}</h3>

                    {renderCatalogEditableField(t('tasks.fields.taskType'), 'taskTypeCatalogItemId', 'TASK_TYPE', editedTask.type)}
                    {renderCatalogEditableField(t('tasks.fields.category'), 'categoryCatalogItemId', 'CATEGORY', editedTask.category)}

                    {/* Tags — editable chip input */}
                    <div className="flex items-start py-1.5 rounded-md hover:bg-gray-50 mb-2">
                      {editingField === 'tags' ? (
                        <div className="w-full space-y-2">
                          <label className="block text-sm font-medium text-gray-700">Tags</label>
                          <TagInput
                            value={Array.isArray(editedTask.tags) ? editedTask.tags : []}
                            onChange={(tags) => setEditedTask({ ...editedTask, tags })}
                            placeholder={t('tasks.actions.addTag')}
                            className="border-gray-300"
                          />
                          <div className="flex mt-3 space-x-3">
                            <button
                              onClick={() => saveField('tags')}
                              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                              disabled={isSaving}
                            >
                              {isSaving ? t('tasks.actions.saving') : t('tasks.actions.save')}
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 transition-colors"
                            >
                              {t('tasks.actions.cancel')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700 pt-1">Tags:</div>
                          <div
                            className="flex-1 flex flex-wrap gap-1 cursor-pointer min-h-[28px]"
                            onClick={() => setEditingField('tags')}
                          >
                            {Array.isArray(editedTask.tags) && editedTask.tags.length > 0 ? (
                              editedTask.tags.map((tag, i) => (
                                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {tag}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-gray-400 italic">{t('tasks.actions.noTags')}</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {renderCatalogEditableField(t('tasks.fields.progressType'), 'progressCatalogItemId', 'PROGRESS_TYPE', editedTask.progress_type)}
                  </div>

                  {/* Other info */}
                  <div className="mt-6 border-t border-gray-200 pt-4">
                    <h3 className="text-base font-medium text-gray-900 mb-3">{t('tasks.sections.otherInfo')}</h3>
                    <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
                      <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">{t('tasks.fields.createdAt')}:</div>
                      <div className="flex-1 text-sm text-gray-900">
                        {formatDate(task.created_at)}
                      </div>
                    </div>

                    <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
                      <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">{t('tasks.fields.lastUpdated')}:</div>
                      <div className="flex-1 text-sm text-gray-900">
                        {formatDate(task.updated_at)}
                      </div>
                    </div>

                    {task.task_id && (
                      <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
                        <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">{t('tasks.fields.taskId')}:</div>
                        <div className="flex-1 text-sm text-gray-900 font-mono">
                          {task.task_id}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className={`tab-content ${activeTab === 'comments' ? 'active' : ''}`}>
              <div className="bg-white rounded-lg">
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('tasks.comments.activity')}</h2>
          
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
              <p className="text-center text-gray-500 py-8">{t('tasks.comments.noComments')}</p>
            )}
          </div>
          
              </div>
            </div>
            
            <div className={`tab-content ${activeTab === 'subtasks' ? 'active' : ''}`}>
              <div className="bg-white rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-medium text-gray-900">{t('tasks.subtasks.subtaskCount', { count: subtasks.length })}</h2>
                  <Link href={`/projects/${projectId}/tasks/${taskId}/create-subtask`}>
                    <Button size="sm" variant="outline">
                      <span className="mr-1">+</span> {t('tasks.subtasks.addSubtaskButton')}
                    </Button>
                  </Link>
                </div>
                
                <TaskDetailSubtasks
                  taskId={taskId}
                  projectId={projectId}
                  subtasks={subtasks}
                  loading={taskDetailState.loadingTask && subtasks.length === 0}
                />
              </div>
            </div>

            {/* Comment input — always visible below all tab content */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">{t('tasks.comments.addComment')}</h3>
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-3 rounded-md">
                  <div className="flex items-start">
                    <svg className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <p className="ml-3 text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}
              <AdvancedEditor
                ref={commentEditorRef}
                value={newComment}
                onChange={setNewComment}
                placeholder={t('tasks.comments.placeholderSimple')}
                mode="compact"
                projectMembers={projectMembers}
                onMentionSelect={handleMentionSelect}
              />
              <div className="mt-3 flex justify-end">
                <Button
                  onClick={handleSubmitComment}
                  disabled={isPostingComment || isTiptapContentEmpty(newComment)}
                  isLoading={isPostingComment}
                >
                  {isPostingComment ? t('tasks.comments.submitting') : t('tasks.comments.submit')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 