'use client';

import { useState, useCallback, useEffect } from 'react';
import { Timeline } from '@/components/timeline/Timeline';
import { TaskListView } from '@/components/tasks/TaskListView';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { MembersView } from '@/components/projects/MembersView';
import { useProjectTasks } from '@/hooks/useProjectTasks';
import { useUsers } from '@/hooks/useUsers';
import { useProject } from '@/hooks/useProject';
import type { ProjectData } from '@/types/project';
import type { TaskFilter } from '@/types/task';
import { useQuery } from '@apollo/client';
import { GET_PROJECT_BY_ID } from '@/graphql/queries/project';
import { GET_MY_PROJECT_ROLE } from '@/graphql/queries/member';

type ViewType = 'list' | 'kanban' | 'gantt' | 'members';

export function ProjectDetailView({ project }: { project: ProjectData }) {
  const [activeView, setActiveView] = useState<ViewType>('list');
  const { 
    data: tasks, 
    loading: tasksLoading, 
    error, 
    refetch,
    pagination,
    filters,
    setPage,
    setPageSize,
    setFilters
  } = useProjectTasks(project.id);
  const { data: users, loading: usersLoading } = useUsers();
  const { data: projectData, refetch: refetchProject } = useProject(project.id);

  const handleTasksUpdated = useCallback(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const handleTaskStatusUpdate = () => {
      refetch();
    };

    window.addEventListener('task-status-updated', handleTaskStatusUpdate);
    
    return () => {
      window.removeEventListener('task-status-updated', handleTaskStatusUpdate);
    };
  }, [refetch]);

  const tabs = [
    {
      id: 'list',
      label: 'Danh sách công việc',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      )
    },
    {
      id: 'kanban',
      label: 'Kanban',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
      )
    },
    {
      id: 'gantt',
      label: 'Biểu đồ Gantt',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      id: 'members',
      label: 'Thành viên',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    }
  ];

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 p-4 rounded-lg text-red-700">
          Error loading tasks: {error.message}
        </div>
      </div>
    );
  }

  // Loading state component
  const LoadingState = () => (
    <div className="h-full flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  // Empty state component
  const EmptyState = () => (
    <div className="h-full flex items-center justify-center text-slate-500">
      <div className="text-center">
        <h3 className="text-lg font-medium mb-2">No tasks found</h3>
        <p>Start by adding tasks to your project.</p>
        <a 
          href={`/projects/${project.id}/add-task`}
          className="mt-4 inline-flex items-center text-blue-600 hover:text-blue-700"
        >
          <span>Add Task</span>
          <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </a>
      </div>
    </div>
  );

  // Lấy thông tin vai trò của người dùng hiện tại từ API response
  const currentUserRole = projectData?.project?.userRole || 'guest';
  
  // Kiểm tra quyền admin
  const isProjectAdmin = String(currentUserRole).toLowerCase() === 'admin';
  const canManageProject = isProjectAdmin;

  // Debug: Log thông tin vai trò để kiểm tra
  console.log('===== THÔNG TIN QUYỀN HẠN =====');
  console.log('Project role từ API:', currentUserRole);
  console.log('Project role (type):', typeof currentUserRole);
  console.log('Is project admin:', isProjectAdmin);
  
  // Debug: Log thêm chi tiết về member data từ project
  console.log('===== CHI TIẾT DỮ LIỆU MEMBERS =====');
  console.log('Project data available:', !!projectData?.project);
  console.log('All members count:', projectData?.project?.members?.length || 0);

  return (
    <div className="p-6">
      {/* Project Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <a 
            href={`/projects/${project.id}/add-task`}
            className="btn-primary inline-block"
          >
            Thêm công việc
          </a>
        </div>
        <div className="flex gap-4 mt-2 text-slate-600">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Hạn {new Date(project.dueDate).toLocaleDateString('vi-VN')}</span>
          </div>
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>{projectData?.project?.members?.length || 0} thành viên</span>
          </div>
        </div>
      </div>

      {/* View Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <div className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as ViewType)}
              className={`flex items-center pb-4 px-1 -mb-px text-sm font-medium transition-colors relative
                ${activeView === tab.id 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              {tab.icon}
              <span className="ml-2">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* View Content */}
      <div className="h-[calc(100vh-240px)]">
        {activeView === 'members' ? (
          projectData?.project ? (
            <MembersView 
              projectId={project.id}
              members={projectData.project.members?.map(member => ({
                ...member,
                role: member.role.toLowerCase(),
                user: {
                  ...member.user,
                  fullName: member.user.fullName || member.user.username || "",
                  avatarUrl: member.user.avatarUrl || "",
                }
              })) || []}
              currentUserRole={currentUserRole}
              refetch={refetchProject}
            />
          ) : (
            <LoadingState />
          )
        ) : tasksLoading || usersLoading ? (
          <LoadingState />
        ) : !tasks?.length ? (
          <EmptyState />
        ) : (
          <>
            {activeView === 'list' && (
              <TaskListView 
                tasks={tasks} 
                pagination={{
                  currentPage: pagination.currentPage,
                  totalPages: pagination.totalPages,
                  totalItems: pagination.totalItems,
                  pageSize: pagination.pageSize,
                  setPage: setPage,
                  setPageSize: setPageSize
                }}
                filters={filters}
                setFilters={setFilters}
              />
            )}
            {activeView === 'kanban' && (
              <div className="h-full overflow-x-auto">
                <KanbanBoard 
                  tasks={tasks} 
                  projectId={project.id}
                  onTasksReorder={handleTasksUpdated} 
                />
              </div>
            )}
            {activeView === 'gantt' && (
              <div className="card h-full overflow-auto">
                <Timeline tasks={tasks} users={users || []} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
