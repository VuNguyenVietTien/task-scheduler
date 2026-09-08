'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Timeline } from '@/components/timeline/Timeline';
import { TaskListView, type CloneRecoveryState } from '@/components/tasks/TaskListView';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { MembersView } from '@/components/projects/MembersView';
import { ProjectReportView } from '@/components/reports/ProjectReportView';
import { ProjectBurndownView } from '@/components/projects/project-burndown-view';
import { DocumentsTab } from '@/components/projects/DocumentsTab';
import { ProjectCatalogSettingsPanel } from '@/components/projects/ProjectCatalogSettingsPanel';
import { ProjectNameSettings } from '@/components/projects/ProjectNameSettings';
import TimesheetPage from '@/app/projects/[id]/timesheet/page';
import { useUsers } from '@/hooks/useUsers';
import { useProject } from '@/hooks/useProject';
import type { ProjectData } from '@/types/project';
import type { TaskFilter } from '@/types/task';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchProjectTasks } from '@/redux/features/tasksSlice';
import { fetchProject } from '@/redux/features/projectSlice';
import { fetchProjectMembers } from '@/redux/features/membersSlice';
import { fetchProjectPlans, fetchLatestProjectPlan } from '@/redux/features/plansSlice';
import { processTasksAndUpdateStore, processTasksBasedOnPlan } from '@/utils/taskScheduler';
import { selectPlans } from '@/redux/features/plansSlice';
import { updateAutoSort } from '@/redux/features/taskOrderStore';
import { useAuth } from '@/contexts/AuthContext';
import { canAddMembers, canViewMembers, canViewSettings } from '@/utils/project-permissions';

type ViewType = 'list' | 'kanban' | 'gantt' | 'burndown' | 'members' | 'report' | 'documents' | 'settings' | 'timesheet';
const VALID_VIEWS: ViewType[] = ['list', 'kanban', 'gantt', 'burndown', 'members', 'report', 'documents', 'settings', 'timesheet'];
function toViewType(tab?: string): ViewType {
  return VALID_VIEWS.includes(tab as ViewType) ? (tab as ViewType) : 'list';
}

interface ProjectDetailViewProps {
  project: ProjectData;
  initialTab?: string;
}

export function ProjectDetailView({ project, initialTab }: ProjectDetailViewProps) {
  const { t } = useTranslation();
  const lastFetchedProjectIdRef = useRef<string | null>(null);
  const [activeView, setActiveView] = useState<ViewType>(toViewType(initialTab));
  const [loadedTasksProjectId, setLoadedTasksProjectId] = useState<string | null>(null);
  // Recovery belongs to the project, not the modal or a transient task-loading render.
  const [cloneRecoveries, setCloneRecoveries] = useState<Record<string, CloneRecoveryState | null>>({});
  const handleCloneRecoveryChange = useCallback((state: CloneRecoveryState | null) => {
    setCloneRecoveries((current) => ({ ...current, [project.id]: state }));
  }, [project.id]);

  // Sync activeView with URL tab param when navigating via sidebar
  useEffect(() => {
    const validated = toViewType(initialTab);
    if (validated !== activeView) {
      setActiveView(validated);
    }
  }, [initialTab]); // eslint-disable-line react-hooks/exhaustive-deps -- only sync when URL changes, not when user clicks internal tabs

  const [filters, setFilters] = useState<TaskFilter>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: users, loading: usersLoading } = useUsers();
  const { data: projectData, refetch: refetchProject } = useProject(project.id);
  const { user } = useAuth();

  const dispatch = useAppDispatch();
  const { tasks: reduxTasks, loading: loadingTasks, error } = useAppSelector(state => state.tasks);
  const { members: reduxMembers, loading: loadingMembers } = useAppSelector(state => state.members);
  const { plans } = useAppSelector(state => state.plans);

  // No-op: Redux store is already updated by thunk/updateTaskLocally after drag-drop or modal edits.
  // A full refetch here causes an unnecessary page reload effect.
  const handleTasksUpdated = useCallback(() => {}, []);

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

          if (fetchProjectTasks.fulfilled.match(tasksResult)) setLoadedTasksProjectId(project.id);

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
      progressCatalogItemId: Object.prototype.hasOwnProperty.call(task, 'progressCatalogItemId')
        ? task.progressCatalogItemId
        : task.progress_catalog_item_id,
      categoryCatalogItemId: Object.prototype.hasOwnProperty.call(task, 'categoryCatalogItemId')
        ? task.categoryCatalogItemId
        : task.category_catalog_item_id,
      taskTypeCatalogItemId: Object.prototype.hasOwnProperty.call(task, 'taskTypeCatalogItemId')
        ? task.taskTypeCatalogItemId
        : task.task_type_catalog_item_id,
      tags: task.tags,
      child_tasks: task.childTasks ? task.childTasks.map(transformTask) : undefined
    };
  };

  const displayedTasks = reduxTasks.map(transformTask);

  const pagination = {
    currentPage: page,
    totalPages: Math.ceil(reduxTasks.length / pageSize),
    totalItems: reduxTasks.length,
    rootTasksOnly: true,
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

  const currentUserRole = projectData?.project?.user_role || 'guest';

  const isProjectAdmin = canAddMembers(currentUserRole);
  const canManageProject = canViewSettings(currentUserRole);
  const forbiddenView = Boolean(projectData?.project) && (
    (activeView === 'members' && !canViewMembers(currentUserRole)) ||
    (activeView === 'settings' && !canManageProject)
  );

  console.log('===== THÔNG TIN QUYỀN HẠN =====');
  console.log('Project role từ API:', currentUserRole);
  console.log('Project role (type):', typeof currentUserRole);
  console.log('Is project admin:', isProjectAdmin);

  console.log('===== CHI TIẾT DỮ LIỆU MEMBERS =====');
  console.log('Project data available:', !!projectData?.project);
  console.log('All members count:', projectData?.project?.members?.length || 0);

  // Tabs are now driven by sidebar navigation (Phase 1) via initialTab prop

  const isTaskView = activeView === 'list' || activeView === 'kanban' || activeView === 'gantt';
  const retainTaskView = (activeView === 'list' || activeView === 'gantt') && loadedTasksProjectId === project.id;

  if (error && isTaskView && !retainTaskView) {
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
    <div className="p-2">
      {error && retainTaskView && (
        <p role="alert" className="p-2 text-red-700">
          Error refreshing tasks: {typeof error === 'object' && error !== null ? (error as any).message : String(error)}
        </p>
      )}
      {/* Add task link - only visible on list view */}
      {activeView === 'list' && (
        <div className="flex justify-end mb-2">
          <a
            href={`/projects/${project.id}/add-task`}
            className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md text-sm font-medium transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('tasks.addTask')}
          </a>
        </div>
      )}

      <div className={activeView === 'gantt' ? '' : 'h-[calc(100vh-100px)]'}>
        {forbiddenView ? (
          <div role="alert" className="p-6 text-red-700">You do not have permission to view this project section.</div>
        ) : activeView === 'members' ? (
          projectData?.project ? (
            <MembersView
              projectId={project.id}
              members={displayedMembers}
              currentUserRole={currentUserRole}
              currentUserId={user?.id}
              ownerUserId={projectData.project.owner.user_id}
              refetch={() => Promise.all([
                dispatch(fetchProjectMembers(project.id)),
                dispatch(fetchProjectTasks(project.id)),
                refetchProject(),
              ]).then(() => undefined)}
            />
          ) : (
            <LoadingState />
          )
        ) : activeView === 'settings' ? (
          <>
            <ProjectNameSettings
              projectId={project.id}
              initialName={projectData?.project?.name ?? project.name}
              canManage={canManageProject}
              onRenamed={() => dispatch(fetchProject(project.id)).then(() => undefined)}
            />
            <ProjectCatalogSettingsPanel
              projectId={project.id}
              canManage={canManageProject}
              onTasksChanged={() => dispatch(fetchProjectTasks(project.id)).then(() => undefined)}
            />
          </>
        ) : activeView === 'report' ? (
          <ProjectReportView projectId={project.id} />
        ) : activeView === 'burndown' ? (
          <ProjectBurndownView projectId={project.id} />
        ) : activeView === 'documents' ? (
          <DocumentsTab projectId={project.id} />
        ) : activeView === 'timesheet' ? (
          <TimesheetPage />
        ) : isTaskView && isLoading && !retainTaskView ? (
          <LoadingState />
        ) : isTaskView && !displayedTasks.length && activeView !== 'gantt' ? (
          <EmptyState />
        ) : (
          <>
            {activeView === 'list' && (
              <TaskListView
                key={project.id}
                projectId={project.id}
                cloneRecoveryState={cloneRecoveries[project.id] ?? null}
                onCloneRecoveryChange={handleCloneRecoveryChange}
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
              <div className="card">
                <Timeline />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
