'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TaskDetailPage } from '@/components/tasks/TaskDetailPage';
import { Task } from '@/types/task';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/common/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { useUpdateTask } from '@/hooks/useTasks';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchProjectMembers } from '@/redux/features/membersSlice';
import { fetchTaskDetail } from '@/redux/features/taskDetailSlice';

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
  const updateTaskHook = useUpdateTask();
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
        console.log('[TaskDetailsPage] Task data từ GraphQL:', data.task.taskId);
        
        // Chuyển đổi dữ liệu từ camelCase sang snake_case
        const formattedTask: Task = {
          task_id: data.task.taskId,
          id: data.task.taskId,
          title: data.task.title || '',
          description: data.task.description || '',
          status: data.task.status?.toLowerCase() || 'todo',
          priority: data.task.priority?.toLowerCase() || 'medium',
          project_id: data.task.projectId || projectId,
          parent_task_id: data.task.parentTaskId || null,
          assignee: data.task.assignee ? {
            userId: data.task.assignee.userId,
            username: data.task.assignee.username,
            avatarUrl: data.task.assignee.avatarUrl || '',
            role: data.task.assignee.role || ''
          } : undefined,
          priority_order: data.task.priorityOrder || 0,
          start_date: data.task.startDate || null,
          due_date: data.task.dueDate || null,
          created_at: data.task.createdAt || new Date().toISOString(),
          updated_at: data.task.updatedAt || new Date().toISOString(),
          effort: data.task.effort || 0,
          progress: data.task.progress || 0,
          created_by: data.task.creator ? {
            userId: data.task.creator.userId,
            username: data.task.creator.username,
            avatarUrl: data.task.creator.avatarUrl || '',
            role: data.task.creator.role || ''
          } : (data.task.createdBy || 'system'),
          type: data.task.type || null,
          category: data.task.category || null,
          progress_type: data.task.progressType?.toLowerCase() || null,
          tags: data.task.tags || [],
          is_deleted: data.task.isDeleted || false
        };
        
        console.log('[TaskDetailsPage] Setting task from GraphQL:', {
          id: formattedTask.task_id,
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
          status: 'todo',
          priority: 'medium',
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
    
    if (reduxTask) {
      if (!task || task.task_id !== reduxTask.task_id || task.parent_task_id !== reduxTask.parent_task_id) {
        console.log('[TaskDetailsPage] Setting task from Redux store:', {
          id: reduxTask.task_id,
          parent_id: reduxTask.parent_task_id
        });
        setTask(reduxTask);
        setLoading(false);
      }
    }
  }, [reduxTask, task]);

  const handleTaskUpdate = async (updates: Partial<Task>) => {
    try {
      console.log('[TaskDetailsPage] handleTaskUpdate called with:', updates);
      setLoading(true);
      
      // Sử dụng updateTask từ hook, nhưng làm rõ cách gọi
      const updatedTask = await updateTaskHook.updateTask(taskId, updates);
      
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
        />
      )}
    </div>
  );
} 