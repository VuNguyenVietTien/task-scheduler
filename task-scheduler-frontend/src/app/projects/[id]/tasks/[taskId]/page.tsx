'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { TaskDetailPage } from '@/components/tasks/TaskDetailPage';
import { Task } from '@/types/task';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/common/PageHeader';
import { useProject } from '@/hooks/useProject';
import { Spinner } from '@/components/ui/Spinner';

export default function TaskDetailsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const taskId = params.taskId as string;
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { data: projectData } = useProject(projectId);

  useEffect(() => {
    const fetchTaskDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/projects/${projectId}/tasks/${taskId}`);
        
        if (!response.ok) {
          throw new Error('Không thể tải thông tin công việc');
        }
        
        const data = await response.json();
        setTask(data);
      } catch (err) {
        console.error('Error fetching task details:', err);
        setError('Không thể tải thông tin công việc. Vui lòng thử lại sau.');
        
        // Fallback data for development
        if (process.env.NODE_ENV === 'development') {
          setTask({
            task_id: taskId,
            id: taskId,
            title: 'Task chi tiết demo',
            description: '<p>Đây là mô tả <strong>demo</strong> cho task.</p><p>Bạn có thể thêm <em>định dạng</em> và <u>các phần tử HTML</u> khác.</p>',
            status: 'todo',
            priority: 'medium',
            project_id: projectId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            priority_order: 0,
          });
        }
      } finally {
        setLoading(false);
      }
    };

    if (projectId && taskId) {
      fetchTaskDetails();
    }
  }, [projectId, taskId]);

  const handleTaskUpdate = async (updates: Partial<Task>) => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        throw new Error('Không thể cập nhật công việc');
      }
      
      const updatedTask = await response.json();
      
      // Cập nhật state với dữ liệu mới
      setTask(prev => prev ? { ...prev, ...updatedTask } : updatedTask);
      
      return true;
    } catch (err) {
      console.error('Error updating task:', err);
      setError('Không thể cập nhật công việc. Vui lòng thử lại sau.');
      
      // Fallback: Giả lập cập nhật thành công trong môi trường dev
      if (process.env.NODE_ENV === 'development') {
        setTask(prev => prev ? { ...prev, ...updates } : null);
        return true;
      }
      
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
        projectName={projectData?.project?.name || 'Dự án'}
      />
      
      <TaskDetailPage 
        task={task} 
        onTaskUpdate={handleTaskUpdate}
        projectId={projectId}
        currentUser={user}
        isLoading={loading}
      />
    </div>
  );
} 