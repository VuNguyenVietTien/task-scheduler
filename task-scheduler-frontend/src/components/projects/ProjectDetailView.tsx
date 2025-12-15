'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Timeline } from '@/components/timeline/Timeline';
import { TaskListView } from '@/components/tasks/TaskListView';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { MembersView } from '@/components/projects/MembersView';
import { ProjectReportView } from '@/components/reports/ProjectReportView';
import { useUsers } from '@/hooks/useUsers';
import { useProject } from '@/hooks/useProject';
import type { ProjectData } from '@/types/project';
import type { TaskFilter } from '@/types/task';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchProjectTasks } from '@/redux/features/tasksSlice';
import { fetchProjectMembers } from '@/redux/features/membersSlice';
import { fetchProjectPlans, fetchLatestProjectPlan } from '@/redux/features/plansSlice';
import { processTasksAndUpdateStore, processTasksBasedOnPlan } from '@/utils/taskScheduler';
import { selectPlans } from '@/redux/features/plansSlice';
import { updateAutoSort } from '@/redux/features/taskOrderStore';

type ViewType = 'list' | 'kanban' | 'gantt' | 'members' | 'report';

export function ProjectDetailView({ project }: { project: ProjectData }) {
  const lastFetchedProjectIdRef = useRef<string | null>(null);
  const [activeView, setActiveView] = useState<ViewType>('list');

  const [filters, setFilters] = useState<TaskFilter>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: users, loading: usersLoading } = useUsers();
  const { data: projectData, refetch: refetchProject } = useProject(project.id);

  const dispatch = useAppDispatch();
  const { tasks: reduxTasks, loading: loadingTasks, error } = useAppSelector(state => state.tasks);
  const { members: reduxMembers, loading: loadingMembers } = useAppSelector(state => state.members);
  const { plans } = useAppSelector(state => state.plans);

  const handleTasksUpdated = useCallback(() => {
    dispatch(fetchProjectTasks(project.id));
  }, [dispatch, project.id]);

  useEffect(() => {
    const handleTaskStatusUpdate = () => {
      dispatch(fetchProjectTasks(project.id));
    };

    window.addEventListener('task-status-updated', handleTaskStatusUpdate);

    return () => {
      window.removeEventListener('task-status-updated', handleTaskStatusUpdate);
    };
  }, [dispatch, project.id]);

  useEffect(() => {
    // Skip if we've already fetched for this project
    if (lastFetchedProjectIdRef.current === project.id) {
      console.log('Đã fetch dữ liệu cho project này rồi, không fetch lại:', project.id);
      return;
    }

    // Create an abort controller to handle cleanup
    const abortController = new AbortController();
    let isMounted = true;

    // Đảm bảo chỉ fetch dữ liệu khi đang ở client side
    if (typeof window !== 'undefined' && project.id) {
      console.log('Bắt đầu fetch dữ liệu cho project:', project.id);

      // Lập kế hoạch fetch dữ liệu theo thứ tự
      const fetchProjectData = async () => {
        try {
          // If the component was unmounted before the async operation completes, don't proceed
          if (!isMounted) return;

          // Bước 1: Fetch tasks và members trước
          const [tasksResult, membersResult] = await Promise.all([
            dispatch(fetchProjectTasks(project.id)),
            dispatch(fetchProjectMembers(project.id))
          ]);
          console.log('Đã fetch tasks và members xong');

          // Check again if still mounted
          if (!isMounted) return;

          // Bước 2: Sau khi có tasks, fetch plans
          const plansResult = await dispatch(fetchProjectPlans(project.id));
          console.log('Đã fetch plans xong');

          // Check again if still mounted
          if (!isMounted) return;

          // Bước 3: Sau khi có plans, fetch latest plan
          const latestPlanResult = await dispatch(fetchLatestProjectPlan(project.id));
          console.log('Đã fetch latest plan xong');

          // Final mount check
          if (!isMounted) return;

          // Bước 4: Xử lý dữ liệu sau khi tất cả đã được load
          handleDataProcessing(tasksResult, plansResult, latestPlanResult);

          // Update the ref to the current project ID only if we're still mounted
          if (isMounted) {
            lastFetchedProjectIdRef.current = project.id;
          }

        } catch (error) {
          // Only log error if we're still mounted and it wasn't caused by abort
          if (isMounted && !abortController.signal.aborted) {
            console.error('Lỗi khi fetch dữ liệu project:', error);
          }
        }
      };

      fetchProjectData();

      // Clean up function
      return () => {
        isMounted = false;
        abortController.abort();
        console.log('Clean up: Component unmounted or dependencies changed');
      };
    }
  }, [dispatch, project.id]); // Only re-run if project.id changes

  const handleDataProcessing = (tasksResult: any, plansResult: any, latestPlanResult: any) => {
    if (tasksResult && tasksResult.payload) {
      console.log('Bắt đầu xử lý dữ liệu tasks và plans');

      const hasTasks = tasksResult.payload && tasksResult.payload.length > 0;
      const hasPlans = plansResult.payload && plansResult.payload.length > 0;
      const hasActivePlan = latestPlanResult.payload !== null;

      console.log('Trạng thái dữ liệu:', {
        hasTasks,
        hasPlans,
        hasActivePlan
      });

      if (hasTasks) {
        processTasksBasedOnPlan(
          tasksResult.payload,
          hasActivePlan,
          dispatch
        );
        console.log('Đã xử lý và cập nhật task order store');

        if (!hasActivePlan) {
          dispatch(updateAutoSort(true));
          console.log('Không có active plan, đã đặt autoSort=true trong Redux store');
        } else {
          dispatch(updateAutoSort(false));
          console.log('Có active plan, đã đặt autoSort=false trong Redux store');
        }
      }
    }
  };

  const transformTask = (task: any) => {
    if (task.task_id) return task;

    return {
      task_id: task.taskId,
      id: task.taskId,
      project_id: task.projectId,
      projectId: task.projectId,
      parent_task_id: task.parentTaskId,
      title: task.title,
      description: task.description,
      assignee_id: task.assignee?.userId,
      assignee: task.assignee ? {
        userId: task.assignee.userId,
        username: task.assignee.username,
        avatarUrl: task.assignee.avatarUrl || "",
        role: task.assignee.role || ""
      } : undefined,
      priority_order: task.priorityOrder,
      start_date: task.startDate,
      due_date: task.dueDate,
      actual_start_date: task.actualStartDate,
      actual_end_date: task.actualEndDate,
      effort: task.effort,
      progress: task.progress,
      created_by: task.createdBy,
      created_at: task.createdAt,
      updated_at: task.updatedAt,
      is_deleted: task.isDeleted,
      status: task.status,
      priority: task.priority,
      type: task.type,
      category: task.category,
      progress_type: task.progressType,
      tags: task.tags,
      child_tasks: task.childTasks ? task.childTasks.map(transformTask) : undefined
    };
  };

  const displayedTasks = reduxTasks.map(transformTask);

  const pagination = {
    currentPage: page,
    totalPages: Math.ceil(reduxTasks.length / pageSize),
    totalItems: reduxTasks.length,
    pageSize: pageSize,
    setPage: setPage,
    setPageSize: setPageSize
  };

  console.log("DEBUG TASKS DATA:", {
    reduxTasks: reduxTasks?.length,
    displayedTasks: displayedTasks?.length,
    sampleTask: displayedTasks[0]
  });

  interface Member {
    role: string;
    joinedAt: string;
    user: {
      userId: string;
      email: string;
      username: string;
      fullName: string | null;
      avatarUrl: string | null;
    };
  }

  const displayedMembers = reduxMembers.map(member => ({
    ...member,
    user: {
      ...member.user,
      fullName: member.user.fullName || member.user.username || "",
      avatarUrl: member.user.avatarUrl || ""
    }
  }));

  const isLoading = loadingTasks || loadingMembers || usersLoading;

  const currentUserRole = projectData?.project?.userRole || 'guest';

  const isProjectAdmin = String(currentUserRole).toLowerCase() === 'admin';
  const canManageProject = isProjectAdmin;

  console.log('===== THÔNG TIN QUYỀN HẠN =====');
  console.log('Project role từ API:', currentUserRole);
  console.log('Project role (type):', typeof currentUserRole);
  console.log('Is project admin:', isProjectAdmin);

  console.log('===== CHI TIẾT DỮ LIỆU MEMBERS =====');
  console.log('Project data available:', !!projectData?.project);
  console.log('All members count:', projectData?.project?.members?.length || 0);

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
    },
    {
      id: 'report',
      label: 'Báo cáo',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    }
  ];

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 p-4 rounded-lg text-red-700">
          Error loading tasks: {typeof error === 'object' && error !== null ? (error as any).message : String(error)}
        </div>
      </div>
    );
  }

  const LoadingState = () => (
    <div className="h-full flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

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

  return (
    <div className="p-6">
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
          {project.dueDate && new Date(project.dueDate).getFullYear() > 1970 && (
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Hạn {new Date(project.dueDate).toLocaleDateString('vi-VN')}</span>
            </div>
          )}
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>{projectData?.project?.members?.length || 0} thành viên</span>
          </div>
        </div>
      </div>

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

      <div className="h-[calc(100vh-240px)]">
        {activeView === 'members' ? (
          projectData?.project ? (
            <MembersView
              projectId={project.id}
              members={displayedMembers}
              currentUserRole={currentUserRole}
              refetch={() => { }}
            />
          ) : (
            <LoadingState />
          )
        ) : activeView === 'report' ? (
          <ProjectReportView projectId={project.id} />
        ) : isLoading ? (
          <LoadingState />
        ) : !displayedTasks.length ? (
          <EmptyState />
        ) : (
          <>
            {activeView === 'list' && (
              <TaskListView
                tasks={displayedTasks}
                pagination={pagination}
                filters={filters}
                setFilters={setFilters}
              />
            )}
            {activeView === 'kanban' && (
              <div className="h-full overflow-x-auto">
                <KanbanBoard
                  tasks={displayedTasks}
                  projectId={project.id}
                  onTasksReorder={handleTasksUpdated}
                />
              </div>
            )}
            {activeView === 'gantt' && (
              <div className="card h-full overflow-auto">
                <Timeline />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
