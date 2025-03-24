'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { TaskDetailPage } from '@/components/tasks/TaskDetailPage';
import { Task } from '@/types/task';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/common/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { useUpdateTask } from '@/hooks/useTasks';

// Import Apollo Client và GET_TASK_BY_ID query
import { ApolloClient, InMemoryCache, createHttpLink, ApolloProvider, useLazyQuery, useQuery } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { GET_PROJECT_MEMBERS } from '@/graphql/queries/member';
import { GET_TASK_BY_ID } from '@/graphql/queries/tasks';
import { client } from '@/lib/apollo-client';

// Định nghĩa interface cho project member
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
  const params = useParams();
  const projectId = params?.id as string;
  const taskId = params?.taskId as string;
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('Dự án');
  // Thêm state cho project members
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const updateTaskHook = useUpdateTask();

  // Setup Apollo Client lazy query cho task detail
  const [getTask, { loading: taskLoading, error: taskError, data: taskData }] = useLazyQuery(GET_TASK_BY_ID, {
    client: client,
    fetchPolicy: 'network-only',
    onCompleted: (data) => {
      if (data && data.task) {
        console.log('Task data từ GraphQL:', data.task);
        
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
          actual_start_date: data.task.actualStartDate || null,
          actual_end_date: data.task.actualEndDate || null,
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
        
        setTask(formattedTask);
        setLoading(false);
      }
    },
    onError: (error) => {
      console.error('Error fetching task from GraphQL:', error);
      setError('Không thể tải thông tin công việc. Vui lòng thử lại sau.');
      setLoading(false);
      
      // Sử dụng fallback data trong môi trường development để testing
      if (process.env.NODE_ENV === 'development') {
        console.log('Sử dụng dữ liệu fallback cho môi trường development');
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

  // Hàm để lấy danh sách thành viên dự án
  const fetchProjectMembers = async () => {
    try {
      // Sử dụng Apollo Client để gọi trực tiếp GraphQL query
      const { data } = await client.query({
        query: GET_PROJECT_MEMBERS,
        variables: { projectId },
        fetchPolicy: 'network-only'
      });
      
      console.log('Project members từ GraphQL:', data);
      
      if (data && data.projectMembers) {
        setProjectMembers(data.projectMembers);
      }
    } catch (err) {
      console.error('Lỗi khi fetch project members:', err);
    }
  };

  useEffect(() => {
    if (projectId && taskId) {
      // Fetch task details sử dụng Apollo Client
      getTask({ variables: { taskId } });
      
      // Fetch project members
      fetchProjectMembers();
    }
  }, [projectId, taskId, getTask]);

  const handleTaskUpdate = async (updates: Partial<Task>) => {
    try {
      setLoading(true);
      
      console.log('Cập nhật task với dữ liệu:', updates);
      
      // Sử dụng updateTask từ hook, nhưng làm rõ cách gọi
      const updatedTask = await updateTaskHook.updateTask(taskId, updates);
      
      // Cập nhật state với dữ liệu mới - sử dụng spread để đảm bảo giữ lại tất cả thuộc tính khác
      setTask(prev => prev ? { ...prev, ...updatedTask } : updatedTask);
      console.log('Cập nhật task thành công:', updatedTask);
      
      return true;
    } catch (err) {
      console.error('Error updating task:', err);
      setError('Không thể cập nhật công việc. Vui lòng thử lại sau.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  if (loading && !task) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Spinner size="lg" />
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
            </div>
          </div>
        </div>
        <div className="mt-4">
          <a href={`/projects/${projectId}`} className="text-blue-600 hover:underline">
            Quay lại danh sách công việc
          </a>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">Không tìm thấy thông tin công việc</p>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <a href={`/projects/${projectId}`} className="text-blue-600 hover:underline">
            Quay lại danh sách công việc
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <PageHeader 
        title="Chi tiết công việc" 
        backLink={`/projects/${projectId}`}
        backLabel="Quay lại dự án"
        projectName={projectName}
      />
      
      <TaskDetailPage 
        task={task} 
        onTaskUpdate={handleTaskUpdate}
        projectId={projectId}
        currentUser={user || undefined}
        isLoadingProp={loading}
        projectMembers={projectMembers} // Truyền danh sách thành viên vào component
      />
    </div>
  );
} 