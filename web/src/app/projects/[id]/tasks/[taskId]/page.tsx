'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TaskDetailPage } from '@/components/tasks/TaskDetailPage';
import { Task } from '@/types/task';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/common/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { useUpdateTask } from '@/hooks/useTasks';
import { useUpdateTaskAssignee } from '@/hooks/useTaskFieldMutations';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchProjectMembers } from '@/redux/features/membersSlice';
import { fetchTaskDetail, transformTaskFromAPI } from '@/redux/features/taskDetailSlice';

// Import Apollo Client và GET_TASK_BY_ID query
import { useLazyQuery } from '@apollo/client';
import { GET_TASK_BY_ID } from '@/graphql/queries/tasks';
import { client } from '@/lib/apollo-client';

// Thêm biến đếm để theo dõi số lần render
let renderCount = 0;

// Định nghĩa interface cho project member - phù hợp với kiểu yêu cầu bởi TaskDetailPage
interface ProjectMember {
  role: string;
  joinedAt: string;
  user: {
    userId: string;
    email: string;
    fullName: string;
    username: string;
    avatarUrl: string;
  };
}

export default function TaskDetailsPage() {
  const renderNumber = ++renderCount;
  console.log(`[TaskDetailsPage] Rendering #${renderNumber}`);
  
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;
  const taskId = params?.taskId as string;
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('Dự án');
  const [hideTitleHeader, setHideTitleHeader] = useState(false);
  const [previousTaskId, setPreviousTaskId] = useState<string | null>(null);
  const [commentId, setCommentId] = useState<string | null>(null);
  const updateTaskHook = useUpdateTask();
  const { updateAssignee } = useUpdateTaskAssignee();
  const dispatch = useAppDispatch();
  
  console.log(`[TaskDetailsPage] Current params:`, { 
    projectId, 
    taskId, 
    previousTaskId 
  });
  
  // Lấy members và task từ Redux store
  const { members: reduxMembers, loading: membersLoading } = useAppSelector(state => state.members);
  const { task: reduxTask, loadingTask: reduxTaskLoading } = useAppSelector(state => state.taskDetail);

  // Setup Apollo Client lazy query cho task detail
  const [getTask, { loading: taskLoading, error: taskError, data: taskData }] = useLazyQuery(GET_TASK_BY_ID, {
    client: client,
    fetchPolicy: 'network-only',
    onCompleted: (data) => {
      if (data && data.task) {
        // GET_TASK_BY_ID returns snake_case fields matching GraphQL schema
        const t = data.task;
        console.log('[TaskDetailsPage] Task data từ GraphQL:', t.task_id);

        const formattedTask: Task = {
          task_id: t.task_id,
          id: t.task_id,
          title: t.title || '',
          description: t.description || '',
          status: t.status?.toUpperCase() || 'TODO',
          priority: t.priority?.toUpperCase() || 'MEDIUM',
          project_id: t.project_id || projectId,
          parent_task_id: t.parent_task_id ?? null,
          assignee: t.assignee ? {
            userId: t.assignee.user_id,
            username: t.assignee.full_name || t.assignee.username,
            avatarUrl: t.assignee.avatar_url || '',
            role: t.assignee.role || ''
          } : undefined,
          assignee_resource_member_id: t.assignee_resource_member_id ?? null,
          priority_order: t.priority_order || 0,
          start_date: t.start_date || null,
          due_date: t.due_date || null,
          created_at: t.created_at || new Date().toISOString(),
          updated_at: t.updated_at || new Date().toISOString(),
          effort: t.effort || 0,
          progress: t.progress || 0,
          created_by: t.creator ? {
            userId: t.creator.user_id,
            username: t.creator.full_name || t.creator.username,
            avatarUrl: t.creator.avatar_url || '',
            role: t.creator.role || ''
          } : (t.created_by || 'system'),
          type: t.type_ || t.type || null,
          category: t.category || null,
          progress_type: t.progress_type?.toLowerCase() || null,
          tags: t.tags || [],
          is_deleted: t.is_deleted || false,
          child_tasks: (t.child_tasks ?? []).map(transformTaskFromAPI)
        };
        
        console.log('[TaskDetailsPage] Setting task from GraphQL:', {
          id: formattedTask.task_id, status: formattedTask.status,
          parent_id: formattedTask.parent_task_id
        });
        setTask(formattedTask);
        setLoading(false);
      }
    },
    onError: (error) => {
      console.error('[TaskDetailsPage] Error fetching task from GraphQL:', error);
      setError('Không thể tải thông tin công việc. Vui lòng thử lại sau.');
      setLoading(false);
      
      // Sử dụng fallback data trong môi trường development để testing
      if (process.env.NODE_ENV === 'development') {
        console.log('[TaskDetailsPage] Sử dụng dữ liệu fallback cho môi trường development');
        const fallbackTask: Task = {
          task_id: taskId,
          id: taskId,
          title: 'Test Task: ' + taskId.substring(0, 8),
          description: '<p>Đây là dữ liệu <strong>tạm thời</strong> để testing.</p>',
          status: 'TODO',
          priority: 'MEDIUM',
          project_id: projectId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          priority_order: 0,
          created_by: 'system',
          effort: 4,
          progress: 0,
          tags: [],
          is_deleted: false
        };
        
        setTask(fallbackTask);
        // Xóa thông báo lỗi khi dùng dữ liệu fallback
        setError(null);
      }
    }
  });

  // useEffect để xử lý fetch dữ liệu khi taskId hoặc projectId thay đổi
  useEffect(() => {
    console.log('[TaskDetailsPage] useEffect for data fetching triggered', {
      projectId,
      taskId,
      previousTaskId,
      hasReduxMembers: reduxMembers?.length > 0,
      reduxTaskId: reduxTask?.task_id
    });
    
    if (projectId && taskId) {
      // Kiểm tra nếu taskId thay đổi thì reset trạng thái và tải dữ liệu mới
      if (taskId !== previousTaskId) {
        console.log('[TaskDetailsPage] TaskId changed, resetting state', {
          from: previousTaskId,
          to: taskId
        });
        setLoading(true);
        setTask(null);
        setPreviousTaskId(taskId);
        
        // Fetch task details từ Redux store
        dispatch(fetchTaskDetail(taskId));
        
        // Vẫn giữ lại gọi GraphQL trực tiếp như một fallback
        getTask({ variables: { taskId } });
      }
      
      // Chỉ dispatch fetchProjectMembers khi chưa có members trong Redux store
      if (!reduxMembers || reduxMembers.length === 0) {
        console.log('[TaskDetailsPage] Fetching project members');
        dispatch(fetchProjectMembers(projectId));
      }
    }
  }, [projectId, taskId, previousTaskId, getTask, dispatch, reduxMembers]);

  // Thêm useEffect để cập nhật task từ Redux store
  useEffect(() => {
    console.log('[TaskDetailsPage] useEffect for redux task sync triggered', {
      hasReduxTask: !!reduxTask,
      reduxTaskId: reduxTask?.task_id,
      reduxParentId: reduxTask?.parent_task_id,
      currentTaskId: task?.task_id
    });
    
    if (reduxTask && task !== reduxTask) {
      console.log('[TaskDetailsPage] Setting task from Redux store:', {
        id: reduxTask.task_id,
        parent_id: reduxTask.parent_task_id
      });
      setTask(reduxTask);
      setLoading(false);
    }
  }, [reduxTask, task]);

  // Extract commentId from URL hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#comment-')) {
      const extractedCommentId = hash.replace('#comment-', '');
      setCommentId(extractedCommentId);
    } else {
      setCommentId(null);
    }
  }, [window.location.hash]);

  const handleTaskUpdate = async (updates: Partial<Task>) => {
    try {
      console.log('[TaskDetailsPage] handleTaskUpdate called with:', updates);
      setLoading(true);
      
      const updatesResourceAssignment = Object.prototype.hasOwnProperty.call(updates, 'assignee_resource_member_id');
      const updatedTask = updatesResourceAssignment
        ? await updateAssignee(taskId, updates.assignee_resource_member_id ? {
            assigneeId: updates.assignee?.userId ?? null,
            assigneeResourceMemberId: updates.assignee_resource_member_id,
          } : null)
        : await updateTaskHook.updateTask(taskId, updates);
      
      console.log('[TaskDetailsPage] Task updated successfully:', {
        id: updatedTask.task_id,
        parent_id: updatedTask.parent_task_id
      });
      
      // Cập nhật state với dữ liệu mới - sử dụng spread để đảm bảo giữ lại tất cả thuộc tính khác
      setTask(prev => {
        const newTask = prev ? { ...prev, ...updatedTask } : updatedTask;
        console.log('[TaskDetailsPage] Updated local task state:', {
          prevParentId: prev?.parent_task_id,
          newParentId: newTask.parent_task_id
        });
        return newTask;
      });
      
      // Sau khi cập nhật thành công, fetch lại task từ Redux store
      dispatch(fetchTaskDetail(taskId));
      
      return true;
    } catch (err) {
      console.error('[TaskDetailsPage] Error updating task:', err);
      setError('Không thể cập nhật công việc. Vui lòng thử lại sau.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Hàm navigate đến task khác mà không tải lại trang
  const navigateToTask = (newTaskId: string) => {
    console.log('[TaskDetailsPage] Navigating to task:', newTaskId);
    router.push(`/projects/${projectId}/tasks/${newTaskId}`);
  };

  // Return JSX với task details
  console.log(`[TaskDetailsPage] Rendering completed #${renderNumber}`, {
    hasTask: !!task,
    loading,
    error
  });

  if (loading && !task) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Spinner size="lg" />
        <p className="ml-3 text-gray-600">Đang tải thông tin công việc...</p>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
              <p className="text-sm text-red-600 mt-2">Mã công việc: {taskId}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex space-x-3">
          <a href={`/projects/${projectId}`} className="text-blue-600 hover:underline">
            Quay lại danh sách công việc
          </a>
          <button 
            onClick={() => getTask({ variables: { taskId } })}
            className="text-blue-600 hover:underline"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {!hideTitleHeader && task && (
        <PageHeader
          backLink={`/projects/${projectId}`}
          backLabel="Quay lại dự án"
        />
      )}

      {task && (
        <TaskDetailPage
          task={task}
          projectId={projectId}
          currentUser={user || undefined}
          onTaskUpdate={handleTaskUpdate}
          isLoadingProp={loading}
          projectMembers={reduxMembers as ProjectMember[]}
          hideTitleHeader={hideTitleHeader}
          initialCommentId={commentId}
          initialActiveTab={commentId ? 'comments' : 'description'}
        />
      )}
    </div>
  );
} 