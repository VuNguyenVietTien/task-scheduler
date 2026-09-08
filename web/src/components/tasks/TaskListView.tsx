'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { CloneTaskSelectionInput, CloneTreeNode } from '@/utils/cloneTask';
import { useTranslation } from 'react-i18next';
import { Task, TaskStatus, Priority, TaskFilter, TaskStatuses, Priorities, UserBasic } from '@/types/task';
import { STATUS_LABELS, PRIORITY_LABELS, getStatusLabel, getPriorityLabel } from '@/constants/task-display-labels';
import { ProjectData } from '@/types/project';
import { TaskFilterBar } from './TaskFilterBar';
import { TaskBulkActions } from './TaskBulkActions';
import { useUpdateTaskPriorityOrder, useUpdateTask } from '@/hooks/useTasks';
import { UserAvatar } from '@/components/common/UserAvatar';
import { TaskFilterModal } from './TaskFilterModal';
import { Pagination } from '@/components/common/Pagination';
import { TaskDetail } from './TaskDetail';
import { useAuth } from '@/contexts/AuthContext';
import { 
  useUpdateTaskStatus, 
  useUpdateTaskPriority, 
  useUpdateTaskEffort, 
  useUpdateTaskDueDate, 
  useUpdateTaskAssignee 
} from '@/hooks/useTaskFieldMutations';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { 
  updateTaskStatus, 
  updateTaskPriority, 
  updateTaskEffort, 
  updateTaskAssignee,
  updateTaskDueDate,
  upsertTask,
  updateTaskLocally,
  fetchProjectTasks
} from '@/redux/features/tasksSlice';
import { useProjectTaxonomies } from '@/hooks/useProjectTaxonomies';
import {
  PhaseFilterSelect,
  TaskPhaseSelect,
  applyPhaseFilter,
  type PhaseFilterValue,
} from '@/components/projects/phase-controls';
import { PhaseSettingsPanel } from '@/components/projects/PhaseSettingsPanel';
import { TaskExcelGrid, type ExcelCatalogField, type StagedEdit } from './TaskExcelGrid';
import { TaskCloneDialog } from './TaskCloneDialog';
import { useMutation, useQuery } from '@apollo/client';
import { CLONE_TASK_SUBTREE } from '@/graphql/mutations';
import { TASK_TREE_ROWS } from '@/graphql/queries/tasks';
import { RESOURCE_MEMBERS_QUERY } from '@/graphql/scheduling';
import { toast } from 'sonner';
import { useProjectCatalogs } from '@/hooks/useProjectCatalogs';
import { resolveProjectCatalogLabel } from '@/utils/project-catalog';
import { filterTaskTree, isTaskStatusVisible } from '@/utils/task-status-visibility';

export interface CloneRecoveryState {
  kind: 'committed' | 'unknown' | 'reselect';
  message: string;
  busy?: 'mutation' | 'refresh';
}

interface TaskListViewProps {
  tasks: Task[];
  projectId?: string;
  cloneRecoveryState?: CloneRecoveryState | null;
  onCloneRecoveryChange?: (state: CloneRecoveryState | null) => void;
  onTaskClick?: (taskId: string) => void;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    /** Pagination may count root trees, never silently label that as all tasks. */
    rootTasksOnly?: boolean;
    pageSize: number;
    setPage: (page: number) => void;
    setPageSize: (size: number) => void;
  };
  filters?: TaskFilter;
  setFilters?: (filters: TaskFilter) => void;
}

interface SortConfig {
  key: keyof Task;
  direction: 'asc' | 'desc';
}

// Tạo interface TaskAssignee từ UserBasic
interface TaskAssignee extends UserBasic {
  // Không cần thêm gì vì UserBasic đã đủ
}

interface TaskAssigneeOption {
  key: string;
  label: string;
  userId: string | null;
  resourceMemberId: string | null;
  avatarUrl?: string;
  role?: string;
}

interface ResourceMemberRow {
  resource_member_id: string;
  display_name: string;
  email?: string | null;
  user_id: string | null;
}

type CloneRecovery = 'committed' | 'unknown' | 'reselect' | null;

function graphQLErrorCode(error: unknown): string | undefined {
  const errors = (error as { graphQLErrors?: Array<{ extensions?: { code?: string } }> }).graphQLErrors;
  return errors?.find((item) => item.extensions?.code)?.extensions?.code;
}

function findTaskInTree(tasks: readonly Task[], taskId: string): Task | undefined {
  for (const task of tasks) {
    if (task.task_id === taskId || task.id === taskId) return task;
    const nested = task.child_tasks && findTaskInTree(task.child_tasks, taskId);
    if (nested) return nested;
  }
  return undefined;
}

// Task type badge colors following design system
const TYPE_BADGE_COLORS: Record<string, string> = {
  'Bug': 'bg-red-50 text-red-700 border border-red-200',
  'Feature': 'bg-blue-50 text-blue-700 border border-blue-200',
  'Enhancement': 'bg-purple-50 text-purple-700 border border-purple-200',
  'Documentation': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
};

// Thêm CSS bên ngoài component
const taskNestedStyles = `
  .child-task-row {
    background-color: #f8fafc;
  }
  
  .child-task-row td:first-child {
    border-left: 4px solid #e2e8f0;
  }
  
  .child-task-row.child-level-2 td:first-child {
    border-left: 4px solid #cbd5e1;
  }
  
  .child-task-row.child-level-3 td:first-child {
    border-left: 4px solid #94a3b8;
  }
  
  .parent-task-row {
    font-weight: 500;
  }
  
  .task-child-connector {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 1px;
    background-color: #e2e8f0;
  }
`;

export function TaskListView({
  tasks: initialTasks,
  projectId,
  cloneRecoveryState: parentRecovery,
  onCloneRecoveryChange,
  onTaskClick,
  pagination,
  filters = {},
  setFilters
}: TaskListViewProps) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [filter, setFilter] = useState<TaskFilter>({});
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const { user } = useAuth();
  const [editingCell, setEditingCell] = useState<{taskId: string, field: string} | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  // Requirement 7: normal ↔ Excel (staged bulk edit) list mode toggle.
  const [listMode, setListMode] = useState<'normal' | 'excel'>('normal');
  const [excelOpened, setExcelOpened] = useState(false);
  const [excelDirty, setExcelDirty] = useState(false);
  // Confirmed patches bridge the independent flat query until it acknowledges them.
  const [assignmentPatches, setAssignmentPatches] = useState<Record<string, Partial<Task>>>({});
  const [excelPatches, setExcelPatches] = useState<Record<string, Partial<Task>>>({});
  const [treeRefreshError, setTreeRefreshError] = useState<string | null>(null);
  const [memberRefreshError, setMemberRefreshError] = useState<string | null>(null);
  const [memberRefreshing, setMemberRefreshing] = useState(false);
  const [cloneSourceTaskId, setCloneSourceTaskId] = useState<string | null>(null);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [localRecovery, setLocalRecovery] = useState<CloneRecoveryState | null>(null);
  const recoveryState = parentRecovery === undefined ? localRecovery : parentRecovery;
  const cloneRecovery = recoveryState?.kind ?? null;
  const setCloneRecovery = useCallback((state: CloneRecoveryState | null) => {
    setLocalRecovery(state);
    onCloneRecoveryChange?.(state);
  }, [onCloneRecoveryChange]);
  const [cloneRefreshing, setCloneRefreshing] = useState(false);
  const [cloneTaskSubtreeMut, { loading: cloneSubmitting }] = useMutation(CLONE_TASK_SUBTREE);

  // ── Increment 1: phase taxonomy (selector + filter + settings) ─────────────
  const taxonomyProjectId = useMemo(
    () => projectId ?? initialTasks.find((t) => t.project_id)?.project_id ?? tasks.find((t) => t.project_id)?.project_id ?? null,
    [projectId, initialTasks, tasks]
  );
  const resourceMembersQ = useQuery(RESOURCE_MEMBERS_QUERY, {
    variables: { project_id: taxonomyProjectId ?? '', only_assignable: true },
    skip: !taxonomyProjectId,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  });
  const memberMappingError = memberRefreshError ?? resourceMembersQ.error?.message ??
    (!resourceMembersQ.loading && !Array.isArray(resourceMembersQ.data?.resource_members) ? 'Member mapping returned no data.' : null);
  const memberMappingUnavailable = resourceMembersQ.loading || memberRefreshing || Boolean(memberMappingError);
  const taskTreeRowsQ = useQuery(TASK_TREE_ROWS, {
    variables: { projectId: taxonomyProjectId ?? '' },
    skip: !taxonomyProjectId || (listMode !== 'excel' && !cloneSourceTaskId),
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange: true,
  });
  const { phases, loading: phasesLoading, ensureDefaultPhases, createPhase, updatePhase, archivePhase, setTaskPhase } =
    useProjectTaxonomies(taxonomyProjectId);
  const { items: progressCatalogItems } = useProjectCatalogs(taxonomyProjectId ?? undefined, 'PROGRESS_TYPE');
  const { items: categoryCatalogItems } = useProjectCatalogs(taxonomyProjectId ?? undefined, 'CATEGORY');
  const { items: taskTypeCatalogItems } = useProjectCatalogs(taxonomyProjectId ?? undefined, 'TASK_TYPE');
  const catalogLocale = i18n?.resolvedLanguage || i18n?.language || 'en';
  const catalogItemsById = useMemo(() => new Map(
    [...progressCatalogItems, ...categoryCatalogItems, ...taskTypeCatalogItems]
      .map((item) => [item.catalog_item_id, item])
  ), [progressCatalogItems, categoryCatalogItems, taskTypeCatalogItems]);
  const catalogLabel = useCallback((task: Task, field: ExcelCatalogField): string => {
    const id = field === 'progress' ? task.progressCatalogItemId
      : field === 'category' ? task.categoryCatalogItemId
        : task.taskTypeCatalogItemId;
    const fallback = field === 'progress' ? task.progress_type
      : field === 'category' ? task.category
        : task.type;
    const item = id ? catalogItemsById.get(id) : undefined;
    return item ? resolveProjectCatalogLabel(item, catalogLocale) : fallback ?? id ?? '';
  }, [catalogItemsById, catalogLocale]);
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilterValue>('ALL');
  const [showPhaseSettings, setShowPhaseSettings] = useState(false);
  
  // Khởi tạo Redux dispatch
  const dispatch = useAppDispatch();
  
  // Khởi tạo các hook mutation
  const { updateStatus, isUpdating: isUpdatingStatus } = useUpdateTaskStatus();
  const { updatePriority, isUpdating: isUpdatingPriority } = useUpdateTaskPriority();
  const { updateEffort, isUpdating: isUpdatingEffort } = useUpdateTaskEffort();
  const { updateDueDate, isUpdating: isUpdatingDueDate } = useUpdateTaskDueDate();
  const { updateAssignee, isUpdating: isUpdatingAssignee } = useUpdateTaskAssignee();
  
  // Lấy danh sách members từ Redux store
  const reduxMembers = useAppSelector(state => state.members.members);
  
  // Keep the local rendering tree aligned with the canonical Redux tree,
  // including arbitrary-depth descendants.
  const updateSingleTaskInState = useCallback((taskId: string, updates: Partial<Task>) => {
    const updateTree = (currentTasks: Task[]): Task[] => currentTasks.map((task) => {
      if (task.task_id === taskId || task.id === taskId) return { ...task, ...updates };
      if (!task.child_tasks?.length) return task;
      const childTasks = updateTree(task.child_tasks);
      return childTasks === task.child_tasks ? task : { ...task, child_tasks: childTasks };
    });
    setTasks((currentTasks) => updateTree(currentTasks));
  }, []);
  
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const applyCanonicalAssignment = useCallback((taskId: string, result: Partial<Task>) => {
    const updates: Partial<Task> = {
      assignee_resource_member_id: result.assignee_resource_member_id ?? null,
      assignee: result.assignee,
    };
    updateSingleTaskInState(taskId, updates);
    // Do not guess from the selected option: replace from mutation output.
    dispatch(upsertTask(result as Task));
    setAssignmentPatches((current) => ({ ...current, [taskId]: updates }));
    // Task uses task_id, not Apollo's default id key: update this embedded query explicitly.
    taskTreeRowsQ.updateQuery?.((data: { task_tree_rows?: Task[] }) => data?.task_tree_rows ? {
      ...data,
      task_tree_rows: data.task_tree_rows.map((task) => task.task_id === taskId
        ? { ...task, ...updates, assignee: updates.assignee ?? null } : task),
    } : data);
  }, [dispatch, updateSingleTaskInState, taskTreeRowsQ.updateQuery]);

  useEffect(() => {
    const rows = taskTreeRowsQ.data?.task_tree_rows as Task[] | undefined;
    if (!rows || taskTreeRowsQ.loading || taskTreeRowsQ.error) return;
    setAssignmentPatches((current) => {
      const acknowledged = Object.keys(current).filter((id) => rows.some((row) =>
        row.task_id === id && row.assignee_resource_member_id === current[id].assignee_resource_member_id &&
        row.assignee?.userId === current[id].assignee?.userId));
      if (!acknowledged.length) return current;
      const next = { ...current };
      acknowledged.forEach((id) => delete next[id]);
      return next;
    });
    setExcelPatches((current) => {
      const acknowledged = Object.keys(current).filter((id) => rows.some((row) => row.task_id === id && row.effort === current[id].effort));
      if (!acknowledged.length) return current;
      const next = { ...current };
      acknowledged.forEach((id) => delete next[id]);
      return next;
    });
  }, [taskTreeRowsQ.data, taskTreeRowsQ.loading, taskTreeRowsQ.error]);

  // Memoize assignees and projects
  const { assignees, projects } = useMemo(() => {

    // Sử dụng members từ Redux store
    const uniqueAssignees = new Map<string, TaskAssignee>();
    const uniqueProjects = new Map<string, ProjectData>();
    
    // Thêm assignees từ tasks (giữ lại logic cũ)
    tasks.forEach(task => {
      if (task.assignee) {
        uniqueAssignees.set(task.assignee.userId, task.assignee);
      }
      
      if (task.project_id) {
        const project: ProjectData = {
          id: task.project_id,
          name: `Project ${task.project_id}`,
          description: '',
          dueDate: '',
          members: 0,
          status: 'active'
        };
        uniqueProjects.set(task.project_id, project);
      }
    });
    
    // Thêm tất cả members từ Redux store (nếu có)
    if (reduxMembers && reduxMembers.length > 0) {
      reduxMembers.forEach((member) => {
        if (member.user?.userId) {
          uniqueAssignees.set(member.user.userId, {
            userId: member.user.userId,
            username: member.user.username || member.user.fullName || member.user.email,
            avatarUrl: member.user.avatarUrl || undefined,
            role: member.role,
          });
        }
      });
    }
    
    console.log('Redux members:', reduxMembers);
    console.log('Assignees cho dropdown:', Array.from(uniqueAssignees.values()));
    
    return {
      assignees: Array.from(uniqueAssignees.values()),
      projects: Array.from(uniqueProjects.values())
    };
  }, [tasks, reduxMembers]);

  // Every List option uses the stable canonical resource id, even when the
  // member is linked. That keeps placeholder assignments intact across link.
  const assigneeOptions = useMemo<TaskAssigneeOption[]>(() => {
    const members = (resourceMembersQ.data?.resource_members ?? []) as ResourceMemberRow[];
    const duplicateNames = new Set(
      members.filter((member, _, all) => all.filter((other) => other.display_name === member.display_name).length > 1)
        .map((member) => member.display_name)
    );
    return members.map((member) => ({
      key: `resource:${member.resource_member_id}`,
      label: duplicateNames.has(member.display_name)
        ? `${member.display_name} (${member.email ?? member.resource_member_id.slice(0, 8)})`
        : member.display_name,
      userId: member.user_id,
      resourceMemberId: member.resource_member_id,
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [resourceMembersQ.data?.resource_members]);

  const assigneeOptionForTask = useCallback((task: Task): TaskAssigneeOption | undefined => {
    if (task.assignee_resource_member_id) {
      return assigneeOptions.find((option) => option.resourceMemberId === task.assignee_resource_member_id);
    }
    return assigneeOptions.find((option) => option.userId === task.assignee?.userId);
  }, [assigneeOptions]);

  const assignmentLabel = (task: Task): string => assigneeOptionForTask(task)?.label ??
    (task.assignee_resource_member_id || task.assignee?.userId
      ? (resourceMembersQ.loading ? 'Loading assigned member…' : task.assignee?.username ?? 'Assigned member unavailable')
      : '');

  // Count identities, not just root rows. Do not flatten the rendering forest.
  const { statusCounts, totalTaskCount } = useMemo(() => {
    const counts: Record<string, number> = {};
    const seen = new Set<string>();
    const pending = [...tasks];
    while (pending.length) {
      const task = pending.pop()!;
      if (seen.has(task.task_id)) continue;
      seen.add(task.task_id);
      counts[task.status] = (counts[task.status] ?? 0) + 1;
      pending.push(...(task.child_tasks ?? []));
    }
    return { statusCounts: counts, totalTaskCount: seen.size };
  }, [tasks]);

  const displayedTasks = useMemo(() => {
    const query = filters.searchQuery?.toLowerCase();
    return filterTaskTree(tasks, (task) => {
      if (!isTaskStatusVisible(task.status, filters.status ? [filters.status] : [])) return false;
      if (query && !task.title.toLowerCase().includes(query) && !task.description?.toLowerCase().includes(query)) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      if (filters.assigneeId && task.assignee?.userId !== filters.assigneeId) return false;
      if (filters.startDate && task.start_date && new Date(task.start_date) < new Date(filters.startDate)) return false;
      if (filters.endDate && task.due_date && new Date(task.due_date) > new Date(filters.endDate)) return false;
      return !filters.projectId || task.project_id === filters.projectId;
    }).sort((a, b) => {
      if (filters.status !== TaskStatuses.DONE) return a.priority_order - b.priority_order;
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      if (!aValue || !bValue) return 0;
      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [tasks, filters, sortConfig]);

  const applyEffortPatch = useCallback((taskId: string, effort: number | undefined) => {
    const updates: Partial<Task> = { effort };
    updateSingleTaskInState(taskId, updates);
    setExcelPatches((current) => ({ ...current, [taskId]: updates }));
  }, [updateSingleTaskInState]);

  // Excel keeps the normal List's filtered roots, then projects every active
  // descendant from the flat arbitrary-depth query without changing normal List.
  const excelTasks = useMemo(() => {
    const rows = (taskTreeRowsQ.data?.task_tree_rows ?? []) as Task[];
    if (rows.length) {
      const roots = new Set(displayedTasks.map((task) => task.task_id));
      const included = new Set(roots);
      const depths = new Map<string, number>();
      roots.forEach((id) => depths.set(id, 0));
      for (const row of rows) {
        const parent = row.parent_task_id;
        if (parent && included.has(parent)) {
          included.add(row.task_id);
          depths.set(row.task_id, (depths.get(parent) ?? 0) + 1);
        }
      }
      return rows
        .filter((row) => included.has(row.task_id))
        .map((row) => ({ ...row, ...excelPatches[row.task_id], ...assignmentPatches[row.task_id], excelDepth: depths.get(row.task_id) ?? 0 }));
    }

    const flattened: Array<Task & { excelDepth?: number }> = [];
    const seen = new Set<string>();
    const visit = (task: Task, excelDepth: number) => {
      if (seen.has(task.task_id)) return;
      seen.add(task.task_id);
      flattened.push({ ...task, excelDepth });
      task.child_tasks?.forEach((child) => visit(child, excelDepth + 1));
    };
    displayedTasks.forEach((task) => visit(task, 0));
    return flattened;
  }, [displayedTasks, taskTreeRowsQ.data?.task_tree_rows, assignmentPatches, excelPatches]);

  // Increment 1: gán phase cho task qua set_task_taxonomy (NULL = Unphased)
  const handleSetTaskPhase = useCallback(async (taskId: string, phaseId: string | null) => {
    try {
      await setTaskPhase(taskId, phaseId);
      updateSingleTaskInState(taskId, { phase_id: phaseId });
    } catch (error) {
      console.error('Không thể cập nhật phase của task:', error);
    }
  }, [setTaskPhase, updateSingleTaskInState]);

  const toggleTaskExpansion = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Ngăn sự kiện click lan ra và kích hoạt handleTaskClick
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const hasChildTasks = (task: Task) => {
    return task.child_tasks && task.child_tasks.length > 0;
  };

  const renderChildTasks = (parentTask: Task, level: number = 1) => {
    if (!hasChildTasks(parentTask) || !expandedTasks.has(parentTask.task_id)) {
      return null;
    }

    return parentTask.child_tasks?.map(childTask => (
      <React.Fragment key={childTask.task_id}>
        <tr className={`hover:bg-slate-50 child-task-row ${level > 0 ? 'child-level-' + level : ''}`}>
          <td className="w-8 py-4 pl-4 pr-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={selectedTasks.has(childTask.task_id)}
                onChange={(e) => toggleTaskSelection(childTask.task_id, e)}
                title="Select task"
              />
            </div>
          </td>
          <td className="py-4 pl-4 pr-3 text-sm sm:pl-6 relative">
            <div className="flex items-center">
              <div style={{ paddingLeft: `${level * 20}px` }} className="flex items-center relative">
                <div className="absolute left-0 top-0 h-full w-0.5 bg-slate-200" style={{ left: `${level * 10}px` }}></div>
                
                {hasChildTasks(childTask) && (
                  <button
                    onClick={(e) => toggleTaskExpansion(childTask.task_id, e)}
                    className="mr-2 text-slate-400 hover:text-slate-700 focus:outline-none"
                    aria-label={expandedTasks.has(childTask.task_id) ? "Thu gọn task con" : "Mở rộng task con"}
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className={`h-4 w-4 transition-transform ${expandedTasks.has(childTask.task_id) ? 'transform rotate-90' : ''}`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
                
                <div>
                  <div
                    className="font-medium text-slate-900 cursor-pointer hover:text-blue-600"
                    onClick={(e) => handleTaskClick(childTask.task_id, e)}
                    onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); handleTaskClick(childTask.task_id, e); } }}
                  >
                    {childTask.title}
                  </div>
                </div>
              </div>
            </div>
          </td>
          <td className="px-3 py-4 text-sm">
            {editingCell?.taskId === childTask.task_id && editingCell?.field === 'status' ? (
              <div className="relative flex items-center">
                <div className="w-24 min-w-24 max-w-24">
                  <select
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full text-sm rounded border-slate-300 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                    aria-label="Trạng thái"
                    title="Chọn trạng thái"
                  >
                    {Object.values(TaskStatuses).map((status) => (
                      <option key={status} value={status}>
                        {getStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex ml-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleSaveEditing(childTask.task_id, 'status'); }}
                    className="text-green-600 hover:text-green-800 mr-1" 
                    title="Lưu"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleCancelEditing(); }}
                    className="text-red-600 hover:text-red-800" 
                    title="Hủy"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <span 
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(childTask.status)} cursor-pointer hover:opacity-75`}
                onClick={(e) => { e.stopPropagation(); handleStartEditing(childTask.task_id, 'status', childTask.status); }}
              >
                {getStatusLabel(childTask.status)}
              </span>
            )}
          </td>
          <td className="px-3 py-4 text-sm">
            {editingCell?.taskId === childTask.task_id && editingCell?.field === 'priority' ? (
              <div className="relative flex items-center">
                <div className="w-24 min-w-24 max-w-24">
                  <select
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full text-sm rounded border-slate-300 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                    aria-label="Mức độ ưu tiên"
                    title="Chọn mức độ ưu tiên"
                  >
                    {Object.values(Priorities).map((priority) => (
                      <option key={priority} value={priority}>
                        {getPriorityLabel(priority)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex ml-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleSaveEditing(childTask.task_id, 'priority'); }}
                    className="text-green-600 hover:text-green-800 mr-1" 
                    title="Lưu"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleCancelEditing(); }}
                    className="text-red-600 hover:text-red-800" 
                    title="Hủy"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <span 
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(childTask.priority)} cursor-pointer hover:opacity-75`}
                onClick={(e) => { e.stopPropagation(); handleStartEditing(childTask.task_id, 'priority', childTask.priority); }}
              >
                {getPriorityLabel(childTask.priority)}
              </span>
            )}
          </td>
          <td className="px-3 py-4 whitespace-nowrap">{catalogLabel(childTask, 'progress') || <span className="text-slate-400">-</span>}</td>
          <td className="px-3 py-4 whitespace-nowrap">{catalogLabel(childTask, 'category') || <span className="text-slate-400">-</span>}</td>
          <td className="px-3 py-4 whitespace-nowrap">
            {catalogLabel(childTask, 'taskType') ? (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE_COLORS[childTask.type ?? ''] || 'bg-gray-100 text-gray-800'}`}>
                {catalogLabel(childTask, 'taskType')}
              </span>
            ) : (
              <span className="text-slate-400">-</span>
            )}
          </td>
          <td className="px-3 py-4 text-sm">
            {editingCell?.taskId === childTask.task_id && editingCell?.field === 'assignee_id' ? (
              <div className="relative flex items-center">
                <div className="w-36 min-w-36 max-w-36">
                  <select
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full text-sm rounded border-slate-300 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                    aria-label="Người được giao"
                    title="Chọn người được giao"
                  >
                    <option value="">Chưa gán</option>
                    {assigneeOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}{option.userId ? '' : ' (unlinked)'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex ml-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleSaveEditing(childTask.task_id, 'assignee_id'); }}
                    className="text-green-600 hover:text-green-800 mr-1" 
                    title="Lưu"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleCancelEditing(); }}
                    className="text-red-600 hover:text-red-800" 
                    title="Hủy"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <div 
                className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1 rounded"
                onClick={(e) => { e.stopPropagation(); handleStartEditing(childTask.task_id, 'assignee_id', assigneeOptionForTask(childTask)?.key || ''); }}
              >
                {assigneeOptionForTask(childTask) ? (
                  <>
                    <UserAvatar
                      username={assigneeOptionForTask(childTask)!.label}
                      avatarUrl={childTask.assignee?.avatarUrl}
                      size="md"
                    />
                    <span>{assigneeOptionForTask(childTask)!.label}</span>
                  </>
                ) : (
                  <span className="text-slate-400">{assignmentLabel(childTask) || 'Chưa gán'}</span>
                )}
              </div>
            )}
          </td>
          <td className="px-3 py-4 text-sm text-slate-500">
            {editingCell?.taskId === childTask.task_id && editingCell?.field === 'due_date' ? (
              <div className="relative flex items-center">
                <div className="w-36 min-w-36 max-w-36">
                  <input
                    type="date"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full text-sm rounded border-slate-300 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                    aria-label="Ngày hết hạn"
                    title="Chọn ngày hết hạn"
                    placeholder="Nhập ngày hết hạn"
                  />
                </div>
                <div className="flex ml-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleSaveEditing(childTask.task_id, 'due_date'); }}
                    className="text-green-600 hover:text-green-800 mr-1" 
                    title="Lưu"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleCancelEditing(); }}
                    className="text-red-600 hover:text-red-800" 
                    title="Hủy"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <span 
                className="cursor-pointer hover:text-blue-600 hover:underline"
                onClick={(e) => { e.stopPropagation(); handleStartEditing(childTask.task_id, 'due_date', childTask.due_date ? new Date(childTask.due_date).toISOString().split('T')[0] : ''); }}
              >
                {childTask.due_date ? new Date(childTask.due_date).toLocaleDateString() : '-'}
              </span>
            )}
          </td>
          <td className="px-3 py-4 text-sm text-slate-500">
            {editingCell?.taskId === childTask.task_id && editingCell?.field === 'effort' ? (
              <div className="relative flex items-center">
                <div className="w-20 min-w-20 max-w-20">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full text-sm rounded border-slate-300 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                    aria-label="Công sức"
                    title="Nhập số giờ công sức"
                    placeholder="Nhập số giờ"
                  />
                </div>
                <div className="flex ml-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleSaveEditing(childTask.task_id, 'effort'); }}
                    className="text-green-600 hover:text-green-800 mr-1" 
                    title="Lưu"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleCancelEditing(); }}
                    className="text-red-600 hover:text-red-800" 
                    title="Hủy"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <span 
                className="cursor-pointer hover:text-blue-600 hover:underline"
                onClick={(e) => { e.stopPropagation(); handleStartEditing(childTask.task_id, 'effort', childTask.effort || ''); }}
              >
                {childTask.effort ? `${childTask.effort}h` : '-'}
              </span>
            )}
          </td>
          <td className="relative py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
            <button
              className="text-slate-500 hover:text-blue-700 mr-2"
              title="Clone task"
              aria-label={`Clone ${childTask.title}`}
              data-testid={`clone-task-${childTask.task_id}`}
              onClick={(e) => {
                e.stopPropagation();
                handleCloneTask(childTask.task_id);
              }}
            >
              ⧉
            </button>
            <button 
              className="text-blue-600 hover:text-blue-900"
              title="Thao tác khác"
              aria-label="Thao tác khác"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
            </button>
          </td>
        </tr>
        {renderChildTasks(childTask, level + 1)}
      </React.Fragment>
    ));
  };

  // Handle task click: left click -> modal, ctrl/middle -> new tab
  const handleTaskClick = useCallback((taskId: string, event?: React.MouseEvent) => {
    if (excelDirty && !window.confirm('Discard unsaved Excel edits?')) return;
    const foundTask = findTaskInTree(tasks, taskId);

    if (!foundTask) {
      console.warn(`Task not found: ${taskId}`);
      return;
    }

    const taskUrl = `/projects/${foundTask.project_id}/tasks/${taskId}`;

    // Ctrl+click / middle click -> navigate to full page in new tab
    if (event?.ctrlKey || event?.metaKey || event?.button === 1) {
      event?.preventDefault();
      window.open(taskUrl, '_blank');
      return;
    }

    // Left click -> navigate to task detail page
    router.push(taskUrl);

    if (onTaskClick) onTaskClick(taskId);
  }, [excelDirty, tasks, onTaskClick, router]);

  const changeListMode = useCallback((mode: 'normal' | 'excel') => {
    if (mode !== listMode && excelDirty && !window.confirm('Discard unsaved Excel edits?')) return;
    if (mode === 'excel') setExcelOpened(true);
    setListMode(mode);
  }, [excelDirty, listMode]);

  const handleTaskUpdate = (taskId: string, updates: Partial<Task>) => {
    // Cập nhật task trong state nếu cần
    // Đây chỉ là cập nhật tạm thời, thường sẽ cần refetch data từ server
    if (selectedTask) {
      setSelectedTask({
        ...selectedTask,
        ...updates
      });
    }
  };

  const handleBulkStatusChange = useCallback((status: TaskStatus) => {
    console.log('Change status to', status, 'for tasks:', Array.from(selectedTasks));
  }, [selectedTasks]);

  const handleBulkPriorityChange = useCallback((priority: Priority) => {
    console.log('Change priority to', priority, 'for tasks:', Array.from(selectedTasks));
  }, [selectedTasks]);

  const handleExport = useCallback(() => {
    const selectedTaskData = tasks
      .filter(task => selectedTasks.has(task.task_id))
      .map(task => ({
        Title: task.title,
        Description: task.description,
        Status: task.status,
        Priority: task.priority,
        'Due Date': task.due_date,
        'Effort (hours)': task.effort,
        Assignee: task.assignee?.username || ''
      }));

    const csvContent = 'data:text/csv;charset=utf-8,' + 
      Object.keys(selectedTaskData[0]).join(',') + '\n' +
      selectedTaskData.map(row => 
        Object.values(row)
          .map(val => `"${val || ''}"`)
          .join(',')
      ).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'tasks.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [tasks, selectedTasks]);

  const handleBulkDelete = useCallback(() => {
    console.log('Delete tasks:', Array.from(selectedTasks));
  }, [selectedTasks]);

  const toggleTaskSelection = (taskId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      if (e.target.checked) {
        newSet.add(taskId);
      } else {
        newSet.delete(taskId);
      }
      return newSet;
    });
  };

  const toggleAllTasks = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedTasks(new Set(displayedTasks.map(t => t.task_id)));
    } else {
      setSelectedTasks(new Set());
    }
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case Priorities.LOW:
        return "bg-slate-100 text-slate-800";
      case Priorities.MEDIUM:
        return "bg-blue-100 text-blue-800";
      case Priorities.HIGH:
        return "bg-orange-100 text-orange-800";
      case Priorities.URGENT:
        return "bg-red-100 text-red-800";
      case Priorities.CRITICAL:
        return "bg-red-100 text-red-800 ring-2 ring-red-500";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatuses.TODO:
        return "bg-slate-100 text-slate-800";
      case TaskStatuses.DOING:
        return "bg-blue-100 text-blue-800";
      case TaskStatuses.DONE:
        return "bg-green-100 text-green-800";
      case TaskStatuses.PENDING:
        return "bg-yellow-100 text-yellow-800";
      case TaskStatuses.REVIEW:
        return "bg-purple-100 text-purple-800";
      case TaskStatuses.BLOCKED:
        return "bg-red-100 text-red-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const handleSort = (key: keyof Task) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const SortIcon = ({ columnKey }: { columnKey: keyof Task }) => {
    if (sortConfig.key !== columnKey) return null;
    
    return (
      <span className="ml-1">
        {sortConfig.direction === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  const updateTaskPriorityOrder = useUpdateTaskPriorityOrder();
  const { updateTask } = useUpdateTask();

  // Clone is a single atomic server mutation. Opening works for normal and
  // deep Excel rows because its source is resolved from task_tree_rows.
  const handleCloneTask = useCallback((taskId: string) => {
    setCloneError(null);
    setCloneSourceTaskId(taskId);
  }, []);

  const refreshClonedTasks = useCallback(async () => {
    if (!taxonomyProjectId) throw new Error('Task project is unavailable.');
    // Wait for both requests, even on failure; no overlapping blind recovery retries.
    const [tree, redux] = await Promise.allSettled([
      taskTreeRowsQ.refetch(),
      dispatch(fetchProjectTasks(taxonomyProjectId)).unwrap(),
    ]);
    if (tree.status === 'rejected') throw tree.reason;
    if (redux.status === 'rejected') throw redux.reason;
    const treeResult = tree.value;
    if (treeResult.error || treeResult.errors?.length || !treeResult.data?.task_tree_rows) {
      throw treeResult.error ?? new Error(treeResult.errors?.[0]?.message ?? 'Task tree refresh returned no data.');
    }
  }, [dispatch, taskTreeRowsQ, taxonomyProjectId]);

  const finishCloneRefresh = useCallback(async (
    successMessage: string,
    refreshFailureMessage: string,
    kind: NonNullable<CloneRecovery> | 'success'
  ) => {
    const recovery = { kind: kind === 'success' ? 'committed' as const : kind, message: refreshFailureMessage };
    setCloneRecovery({ ...recovery, busy: 'refresh', message: kind === 'success'
      ? `${successMessage} Refreshing task list…`
      : kind === 'unknown' ? 'Could not confirm clone. Refreshing task list…' : 'Task tree changed. Refreshing task list…' });
    setCloneRefreshing(true);
    try {
      await refreshClonedTasks();
      setCloneError(null);
      setCloneRecovery(null);
      setCloneSourceTaskId(null);
      if (kind === 'success') toast.success(successMessage);
      else toast.error(successMessage);
      return true;
    } catch {
      // Recovery truth was stored before dispatch could unmount this List.
      setCloneRecovery(recovery);
      setCloneError(null);
      return false;
    } finally {
      setCloneRefreshing(false);
    }
  }, [refreshClonedTasks, setCloneRecovery]);

  const handleCloneSubmit = useCallback(async (input: CloneTaskSelectionInput) => {
    if (cloneRecovery || cloneRefreshing) return;
    setCloneError(null);
    setCloneRecovery({ kind: 'unknown', busy: 'mutation', message: 'Clone outcome is not yet confirmed. Refresh task list before retrying.' });
    try {
      const result = await cloneTaskSubtreeMut({ variables: { input } });
      const createdCount = result.data?.clone_task_subtree?.created_task_ids?.length;
      if (result.errors?.length) throw { graphQLErrors: result.errors };
      if (!createdCount) throw { networkError: new Error('Clone returned no created tasks') };
      await finishCloneRefresh(
        `Created ${input.quantity} copies (${createdCount} tasks).`,
        `Created ${input.quantity} copies (${createdCount} tasks), but the task list could not be refreshed. Refresh task list before creating another copy.`,
        'success'
      );
    } catch (error) {
      const code = graphQLErrorCode(error);
      if (code === 'CONFLICT' || code === 'NOT_FOUND') {
        await finishCloneRefresh(
          'Task tree changed. Task list refreshed. Select the source again.',
          'Task tree changed, but the task list could not be refreshed. Refresh it before selecting again.',
          'reselect'
        );
        return;
      }
      if ((error as { networkError?: unknown }).networkError) {
        await finishCloneRefresh(
          'Could not confirm clone; task list refreshed. Check results before retrying.',
          'Could not confirm clone. The task list could not be refreshed; do not retry until it succeeds.',
          'unknown'
        );
        return;
      }
      setCloneRecovery(null);
      setCloneError(error instanceof Error ? error.message : 'Could not clone task tree.');
    }
  }, [cloneTaskSubtreeMut, finishCloneRefresh, cloneRecovery, cloneRefreshing, setCloneRecovery]);

  const handleRetryCloneRefresh = useCallback(async () => {
    if (recoveryState?.busy || cloneRefreshing) return;
    if (recoveryState) setCloneRecovery({ ...recoveryState, busy: 'refresh' });
    setCloneRefreshing(true);
    try {
      if (!cloneRecovery) {
        const result = await taskTreeRowsQ.refetch();
        if (result.error || result.errors?.length || !result.data?.task_tree_rows) {
          throw result.error ?? new Error('Task tree refresh returned no data.');
        }
        setCloneError(null);
        return;
      }
      await refreshClonedTasks();
      const message = cloneRecovery === 'reselect'
        ? 'Task list refreshed. Select the source again.'
        : 'Task list refreshed. Check results before retrying.';
      setCloneError(null);
      setCloneRecovery(null);
      setCloneSourceTaskId(null);
      toast.error(message);
    } catch (error) {
      if (recoveryState) setCloneRecovery({ ...recoveryState, busy: undefined });
      setCloneError(error instanceof Error ? error.message : 'Could not refresh the task list.');
    } finally {
      setCloneRefreshing(false);
    }
  }, [cloneRecovery, recoveryState, cloneRefreshing, refreshClonedTasks, taskTreeRowsQ, setCloneRecovery]);

  // Excel-mode staged edit persistence — reuses the exact per-field Redux
  // thunks the inline editor uses; failures throw and stay staged in the grid.
  const handleExcelSave = useCallback(async (edit: StagedEdit) => {
    if (edit.field === 'status') {
      await dispatch(updateTaskStatus({ taskId: edit.taskId, status: edit.value as TaskStatus })).unwrap();
    } else if (edit.field === 'priority') {
      await dispatch(updateTaskPriority({ taskId: edit.taskId, priority: edit.value as Priority })).unwrap();
    } else if (edit.field === 'effort') {
      const priorEffort = findTaskInTree(tasks, edit.taskId)?.effort;
      try {
        const result = await dispatch(updateTaskEffort({ taskId: edit.taskId, effort: Number(edit.value) })).unwrap() as { task?: Partial<Task> };
        if (result.task?.task_id !== edit.taskId || typeof result.task.effort !== 'number') {
          throw new Error('Effort update returned no complete task result.');
        }
        applyEffortPatch(edit.taskId, result.task.effort);
      } catch (error) {
        // The legacy thunk can merge an incomplete result before unwrap returns.
        // Restore the known value; the grid keeps its staged edit and error.
        applyEffortPatch(edit.taskId, priorEffort);
        throw error;
      }
    } else if (edit.field === 'due_date') {
      await dispatch(updateTaskDueDate({ taskId: edit.taskId, dueDate: edit.value })).unwrap();
    } else if (edit.field === 'assignee') {
      if (memberMappingUnavailable) throw new Error(memberMappingError ?? 'Member mapping is loading. Retry after it loads.');
      const value = edit.value.trim();
      if (!value) {
        applyCanonicalAssignment(edit.taskId, await updateAssignee(edit.taskId, null));
      } else {
        const matches = assigneeOptions.filter((option) => option.label === value || option.key === value);
        if (matches.length !== 1) {
          throw new Error(`Unknown or ambiguous assignee "${edit.value}"`);
        }
        const member = matches[0];
        applyCanonicalAssignment(edit.taskId, await updateAssignee(edit.taskId, {
          assigneeId: member.userId,
          assigneeResourceMemberId: member.resourceMemberId,
        }));
      }
    } else {
      const savedTask = await updateTask(edit.taskId, { title: edit.value });
      dispatch(upsertTask(savedTask));
      updateSingleTaskInState(edit.taskId, savedTask);
    }
  }, [applyCanonicalAssignment, applyEffortPatch, dispatch, tasks, updateSingleTaskInState, updateTask, updateAssignee, assigneeOptions, memberMappingUnavailable, memberMappingError]);

  const handleFilterChange = (newFilters: TaskFilter) => {
    if (setFilters) {
      setFilters(newFilters);
    }
  };

  const hasFilters = Object.keys(filters).length > 0;

  // Xử lý bắt đầu chỉnh sửa
  const handleStartEditing = (taskId: string, field: string, value: any) => {
    if (field === 'assignee_id' && memberMappingUnavailable) return;
    setEditingCell({ taskId, field });
    setEditValue(String(value || ''));
  };

  // Xử lý hủy chỉnh sửa
  const handleCancelEditing = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Cập nhật hàm xử lý lưu chỉnh sửa để sử dụng Redux
  const handleSaveEditing = async (taskId: string, field: string) => {
    // Tạo một bản sao của task hiện tại để cập nhật UI optimistically
    const currentTask = findTaskInTree(tasks, taskId);
    if (!currentTask) {
      console.error('Không tìm thấy task có ID:', taskId);
      return;
    }
    
    try {
      // Sử dụng hook riêng biệt cho từng loại trường
      if (field === 'status') {
        const status = editValue as TaskStatus;
        
        // Lưu lại tasks hiện tại để khôi phục nếu API call thất bại
        const originalTasks = [...tasks];
        
        try {
          // Redux replaces the task only from the confirmed mutation result.
          await dispatch(updateTaskStatus({ taskId, status })).unwrap();
          console.log(`Đã cập nhật trạng thái thành: ${status} (qua Redux)`);
          
          /* CÁCH CŨ: Sử dụng hook mutation
          const result = await updateStatus(taskId, status);
          console.log(`Đã cập nhật trạng thái thành: ${status}`, result);
          */
        } catch (error) {
          console.error('Lỗi khi gọi API cập nhật trạng thái:', error);
          // Khôi phục trạng thái cũ nếu API call thất bại
          setTasks(originalTasks);
          alert(`Không thể cập nhật trạng thái: ${error}`);
          return; // Thoát sớm, không đóng chế độ chỉnh sửa
        }
      } 
      else if (field === 'priority') {
        const priority = editValue as Priority;
        
        // Lưu lại tasks hiện tại để khôi phục nếu API call thất bại
        const originalTasks = [...tasks];
        
        try {
          // Redux replaces the task only from the confirmed mutation result.
          await dispatch(updateTaskPriority({ taskId, priority })).unwrap();
          console.log(`Đã cập nhật ưu tiên thành: ${priority} (qua Redux)`);
          
          /* CÁCH CŨ: Sử dụng hook mutation
          const result = await updatePriority(taskId, priority);
          console.log(`Đã cập nhật ưu tiên thành: ${priority}`, result);
          */
        } catch (error) {
          console.error('Lỗi khi gọi API cập nhật ưu tiên:', error);
          // Khôi phục trạng thái cũ nếu API call thất bại
          setTasks(originalTasks);
          alert(`Không thể cập nhật ưu tiên: ${error}`);
          return; // Thoát sớm, không đóng chế độ chỉnh sửa
        }
      } 
      else if (field === 'effort') {
        const effort = Number(editValue);
        if (!Number.isFinite(effort) || effort < 0 || effort > 24 * 30) {
          alert('Không thể cập nhật công sức: Invalid effort (non-negative hours)');
          return;
        }
        try {
          const result = await dispatch(updateTaskEffort({ taskId, effort })).unwrap() as { task?: Partial<Task> };
          if (result.task?.task_id !== taskId || typeof result.task.effort !== 'number') {
            throw new Error('Effort update returned no complete task result.');
          }
          applyEffortPatch(taskId, result.task.effort);
        } catch (error) {
          console.error('Lỗi khi gọi API cập nhật công sức:', error);
          applyEffortPatch(taskId, currentTask.effort);
          alert(`Không thể cập nhật công sức: ${error}`);
          return; // Keep the editor and entered value after a failed save.
        }
      } 
      else if (field === 'assignee_id') {
        if (memberMappingUnavailable) {
          alert(memberMappingError ?? 'Member mapping is loading. Retry after it loads.');
          return;
        }
        const option = assigneeOptions.find((candidate) => candidate.key === editValue);
        if (editValue && !option) throw new Error('Unknown canonical member');
        try {
          applyCanonicalAssignment(taskId, await updateAssignee(taskId, option ? {
            assigneeId: option.userId,
            assigneeResourceMemberId: option.resourceMemberId,
          } : null));
        } catch (error) {
          alert(`Không thể cập nhật người được giao: ${error}`);
          return;
        }
      }
      else if (field === 'due_date') {
        const dueDate = editValue || null;

        // Lưu lại tasks hiện tại để khôi phục nếu API call thất bại
        const originalTasks = [...tasks];

        try {
          // Redux replaces the task only from the confirmed mutation result.
          await dispatch(updateTaskDueDate({ taskId, dueDate: dueDate || '' })).unwrap();
          console.log(`Đã cập nhật hạn thành: ${dueDate} (qua Redux)`);
          
          /* CÁCH CŨ: Sử dụng hook mutation (giữ lại để tham khảo)
          const result = await updateDueDate(taskId, dueDate);
          console.log(`Đã cập nhật hạn thành: ${dueDate}`, result);
          */
        } catch (error) {
          console.error('Lỗi khi gọi API cập nhật hạn:', error);
          // Khôi phục trạng thái cũ nếu API call thất bại
          setTasks(originalTasks);
          alert(`Không thể cập nhật hạn: ${error}`);
          return; // Thoát sớm, không đóng chế độ chỉnh sửa
        }
      }
      
      // Đóng chế độ chỉnh sửa
      setEditingCell(null);
      setEditValue('');
    } catch (error) {
      console.error(`Lỗi khi cập nhật ${field}:`, error);
      
      // Đóng chế độ chỉnh sửa
      setEditingCell(null);
      setEditValue('');
      
      // Hiển thị thông báo lỗi
      alert(`Không thể cập nhật ${field}. Lỗi: ${error}`);
    }
  };

  // Xử lý khi nhấn phím
  const handleKeyDown = (e: React.KeyboardEvent, taskId: string, field: string) => {
    if (e.key === 'Enter') {
      handleSaveEditing(taskId, field);
    } else if (e.key === 'Escape') {
      handleCancelEditing();
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Filter and Actions Bar */}
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsFilterModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
            aria-label="Mở modal lọc"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            {t('tasks.filterTasks')}
            {hasFilters && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                {Object.keys(filters).length}
              </span>
            )}
          </button>
          
          {/* Requirement 7: Normal ↔ Excel mode toggle */}
          <div className="inline-flex rounded-md border border-slate-300 overflow-hidden" role="group" aria-label="List mode">
            <button
              onClick={() => changeListMode('normal')}
              className={`px-3 py-2 text-sm font-medium ${listMode === 'normal' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
              aria-pressed={listMode === 'normal'}
              data-testid="mode-normal-btn"
            >
              Normal
            </button>
            <button
              onClick={() => changeListMode('excel')}
              className={`px-3 py-2 text-sm font-medium ${listMode === 'excel' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
              aria-pressed={listMode === 'excel'}
              data-testid="mode-excel-btn"
            >
              Excel
            </button>
          </div>
        </div>
        
        {/* Status Summary */}
        <div className="flex flex-wrap gap-2">
          <span data-testid="total-task-count">Total tasks: {totalTaskCount} (including descendants)</span>
          <span data-testid="displayed-root-count">Displayed roots: {displayedTasks.length}</span>
          {Object.entries(statusCounts)
            .filter(([status]) => statusCounts[status] > 0)
            .map(([status, count]) => (
              <span 
                key={status}
                data-testid={`task-status-count-${status}`}
                className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${getStatusColor(status as TaskStatus)}`}
              >
                {getStatusLabel(status)}: {count}
              </span>
            ))}
        </div>

        {/* Bulk Actions */}
        {selectedTasks.size > 0 && (
          <TaskBulkActions 
            selectedCount={selectedTasks.size} 
            onClearSelection={() => setSelectedTasks(new Set())}
          />
        )}
      </div>

      {(resourceMembersQ.loading || memberRefreshing) && <p role="status">Loading member mapping…</p>}
      {memberMappingError && (
        <div role="alert" className="mb-2 text-sm text-red-700">
          Could not load member mapping: {memberMappingError}
          <button type="button" disabled={memberRefreshing} className="ml-2 underline" onClick={async () => {
            setMemberRefreshing(true);
            try {
              const result = await resourceMembersQ.refetch();
              if (result.error || result.errors?.length || !Array.isArray(result.data?.resource_members)) {
                throw result.error ?? new Error(result.errors?.[0]?.message ?? 'Member mapping returned no data.');
              }
              setMemberRefreshError(null);
            } catch (error) {
              setMemberRefreshError((error as Error).message);
            } finally {
              setMemberRefreshing(false);
            }
          }}>Retry member mapping</button>
        </div>
      )}
      {!memberMappingUnavailable && assigneeOptions.length === 0 && <p>No assignable members.</p>}
      {listMode === 'excel' && (
        <div className="mb-2 text-sm">
          {(treeRefreshError || taskTreeRowsQ.error) && (
            <p role="alert">Task rows could not be refreshed; showing last available rows. {treeRefreshError ?? taskTreeRowsQ.error?.message}</p>
          )}
          <button type="button" disabled={taskTreeRowsQ.loading} onClick={async () => {
            try {
              const result = await taskTreeRowsQ.refetch();
              if (result.error || result.errors?.length || !result.data?.task_tree_rows) {
                throw result.error ?? new Error(result.errors?.[0]?.message ?? 'Task tree refresh returned no data.');
              }
              setTreeRefreshError(null);
            } catch (error) {
              setTreeRefreshError(error instanceof Error ? error.message : 'Refresh failed.');
            }
          }}>Refresh task rows</button>
        </div>
      )}

      {/* Task List: normal table (requirement 7) or Excel staged-edit grid */}
      {excelOpened && (
        <div hidden={listMode !== 'excel'}>
        <TaskExcelGrid
          tasks={excelTasks}
          assigneeLabel={assignmentLabel}
          assigneeOptions={assigneeOptions}
          assigneeValue={(task) => assigneeOptionForTask(task)?.key ?? ''}
          catalogLabel={catalogLabel}
          active={listMode === 'excel'}
          onSaveEdit={handleExcelSave}
          onCloneTask={handleCloneTask}
          onDirtyChange={setExcelDirty}
        />
        </div>
      )}
      {listMode === 'normal' && (
      <div className="overflow-x-auto grow border border-slate-200 rounded-lg bg-white min-h-0">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="w-8 px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  title="Chọn tất cả"
                  aria-label="Chọn tất cả công việc"
                  onChange={toggleAllTasks}
                  checked={selectedTasks.size > 0 && selectedTasks.size === displayedTasks.length}
                />
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t('tasks.colTitle')}
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t('tasks.colStatus')}
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t('tasks.colPriority')}
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t('tasks.fields.progressType')}
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t('tasks.fields.category')}
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t('tasks.fields.taskType')}
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t('tasks.colAssignee')}
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t('tasks.colDeadline')}
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t('tasks.colEffort')}
              </th>
              <th scope="col" className="relative px-3 py-3">
                <span className="sr-only">{t('tasks.colActions')}</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {displayedTasks.length > 0 ? (
              displayedTasks.map(task => (
                <React.Fragment key={task.task_id}>
                  <tr className={`hover:bg-slate-50 ${hasChildTasks(task) ? 'parent-task-row' : ''}`}>
                    <td className="w-8 py-4 pl-4 pr-3">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={selectedTasks.has(task.task_id)}
                          onChange={(e) => toggleTaskSelection(task.task_id, e)}
                          title="Select task"
                        />
                      </div>
                    </td>
                    <td className="py-4 pl-4 pr-3 text-sm sm:pl-6">
                      <div className="flex items-center">
                        {hasChildTasks(task) && (
                          <button
                            onClick={(e) => toggleTaskExpansion(task.task_id, e)}
                            className="mr-2 text-slate-400 hover:text-slate-700 focus:outline-none"
                            aria-label={expandedTasks.has(task.task_id) ? "Thu gọn task con" : "Mở rộng task con"}
                          >
                            <svg 
                              xmlns="http://www.w3.org/2000/svg" 
                              className={`h-4 w-4 transition-transform ${expandedTasks.has(task.task_id) ? 'transform rotate-90' : ''}`} 
                              fill="none" 
                              viewBox="0 0 24 24" 
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        )}
                        
                        <div>
                          <div 
                            className="font-medium text-slate-900 cursor-pointer hover:text-blue-600"
                            onClick={(e) => handleTaskClick(task.task_id, e)}
                            onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); handleTaskClick(task.task_id, e); } }}
                          >
                            {task.title}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-sm">
                      {editingCell?.taskId === task.task_id && editingCell?.field === 'status' ? (
                        <div className="relative flex items-center">
                          <div className="w-24 min-w-24 max-w-24">
                            <select
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-full text-sm rounded border-slate-300 focus:ring-blue-500 focus:border-blue-500"
                              autoFocus
                              aria-label="Trạng thái"
                              title="Chọn trạng thái"
                            >
                              {Object.values(TaskStatuses).map((status) => (
                                <option key={status} value={status}>
                                  {getStatusLabel(status)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex ml-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleSaveEditing(task.task_id, 'status'); }}
                              className="text-green-600 hover:text-green-800 mr-1" 
                              title="Lưu"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleCancelEditing(); }}
                              className="text-red-600 hover:text-red-800" 
                              title="Hủy"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span 
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)} cursor-pointer hover:opacity-75`}
                          onClick={(e) => { e.stopPropagation(); handleStartEditing(task.task_id, 'status', task.status); }}
                        >
                          {getStatusLabel(task.status)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm">
                      {editingCell?.taskId === task.task_id && editingCell?.field === 'priority' ? (
                        <div className="relative flex items-center">
                          <div className="w-24 min-w-24 max-w-24">
                            <select
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-full text-sm rounded border-slate-300 focus:ring-blue-500 focus:border-blue-500"
                              autoFocus
                              aria-label="Mức độ ưu tiên"
                              title="Chọn mức độ ưu tiên"
                            >
                              {Object.values(Priorities).map((priority) => (
                                <option key={priority} value={priority}>
                                  {getPriorityLabel(priority)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex ml-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleSaveEditing(task.task_id, 'priority'); }}
                              className="text-green-600 hover:text-green-800 mr-1" 
                              title="Lưu"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleCancelEditing(); }}
                              className="text-red-600 hover:text-red-800" 
                              title="Hủy"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span 
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(task.priority)} cursor-pointer hover:opacity-75`}
                          onClick={(e) => { e.stopPropagation(); handleStartEditing(task.task_id, 'priority', task.priority); }}
                        >
                          {getPriorityLabel(task.priority)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">{catalogLabel(task, 'progress') || <span className="text-slate-400">-</span>}</td>
                    <td className="px-3 py-4 whitespace-nowrap">{catalogLabel(task, 'category') || <span className="text-slate-400">-</span>}</td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      {catalogLabel(task, 'taskType') ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE_COLORS[task.type ?? ''] || 'bg-gray-100 text-gray-800'}`}>
                          {catalogLabel(task, 'taskType')}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm">
                      {editingCell?.taskId === task.task_id && editingCell?.field === 'assignee_id' ? (
                        <div className="relative flex items-center">
                          <div className="w-36 min-w-36 max-w-36">
                            <select
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-full text-sm rounded border-slate-300 focus:ring-blue-500 focus:border-blue-500"
                              autoFocus
                              aria-label="Người được giao"
                              title="Chọn người được giao"
                            >
                              <option value="">Chưa gán</option>
                              {assigneeOptions.map((option) => (
                                <option key={option.key} value={option.key}>
                                  {option.label}{option.userId ? '' : ' (unlinked)'}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex ml-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleSaveEditing(task.task_id, 'assignee_id'); }}
                              className="text-green-600 hover:text-green-800 mr-1" 
                              title="Lưu"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleCancelEditing(); }}
                              className="text-red-600 hover:text-red-800" 
                              title="Hủy"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div 
                          className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1 rounded"
                          onClick={(e) => { e.stopPropagation(); handleStartEditing(task.task_id, 'assignee_id', assigneeOptionForTask(task)?.key || ''); }}
                        >
                          {assigneeOptionForTask(task) ? (
                            <>
                              <UserAvatar
                                username={assigneeOptionForTask(task)!.label}
                                avatarUrl={task.assignee?.avatarUrl}
                                size="md"
                              />
                              <span>{assigneeOptionForTask(task)!.label}</span>
                            </>
                          ) : (
                            <span className="text-slate-400">{assignmentLabel(task) || 'Chưa gán'}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm text-slate-500">
                      {editingCell?.taskId === task.task_id && editingCell?.field === 'due_date' ? (
                        <div className="relative flex items-center">
                          <div className="w-36 min-w-36 max-w-36">
                            <input
                              type="date"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-full text-sm rounded border-slate-300 focus:ring-blue-500 focus:border-blue-500"
                              autoFocus
                              aria-label="Ngày hết hạn"
                              title="Chọn ngày hết hạn"
                              placeholder="Nhập ngày hết hạn"
                            />
                          </div>
                          <div className="flex ml-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleSaveEditing(task.task_id, 'due_date'); }}
                              className="text-green-600 hover:text-green-800 mr-1" 
                              title="Lưu"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleCancelEditing(); }}
                              className="text-red-600 hover:text-red-800" 
                              title="Hủy"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span 
                          className="cursor-pointer hover:text-blue-600 hover:underline"
                          onClick={(e) => { e.stopPropagation(); handleStartEditing(task.task_id, 'due_date', task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : ''); }}
                        >
                          {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm text-slate-500">
                      {editingCell?.taskId === task.task_id && editingCell?.field === 'effort' ? (
                        <div className="relative flex items-center">
                          <div className="w-20 min-w-20 max-w-20">
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-full text-sm rounded border-slate-300 focus:ring-blue-500 focus:border-blue-500"
                              autoFocus
                              aria-label="Công sức"
                              title="Nhập số giờ công sức"
                              placeholder="Nhập số giờ"
                            />
                          </div>
                          <div className="flex ml-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleSaveEditing(task.task_id, 'effort'); }}
                              className="text-green-600 hover:text-green-800 mr-1" 
                              title="Lưu"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleCancelEditing(); }}
                              className="text-red-600 hover:text-red-800" 
                              title="Hủy"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span 
                          className="cursor-pointer hover:text-blue-600 hover:underline"
                          onClick={(e) => { e.stopPropagation(); handleStartEditing(task.task_id, 'effort', task.effort || ''); }}
                        >
                          {task.effort ? `${task.effort}h` : '-'}
                        </span>
                      )}
                    </td>
                    <td className="relative py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <button
                        className="text-slate-500 hover:text-blue-700 mr-2"
                        title="Clone task"
                        aria-label={`Clone ${task.title}`}
                        data-testid={`clone-task-${task.task_id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloneTask(task.task_id);
                        }}
                      >
                        ⧉
                      </button>
                      <button 
                        className="text-blue-600 hover:text-blue-900"
                        title="Thao tác khác"
                        aria-label="Thao tác khác"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                  {renderChildTasks(task)}
                </React.Fragment>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                  <div className="py-12">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {hasFilters ? (
                      <>
                        <p className="text-lg font-medium">{t('tasks.noTasks')}</p>
                        <p className="mt-1">{t('tasks.noTasksFilter', { defaultValue: t('tasks.noTasks') })}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-medium">{t('tasks.noTasks')}</p>
                        <p className="mt-1">{t('tasks.noTasksHint', { defaultValue: '' })}</p>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 0 && (
        <div aria-label={pagination.rootTasksOnly ? 'Parent task pagination' : 'Task pagination'}>
        {pagination.rootTasksOnly && pagination.totalPages > 1 && (
          <p className="px-4 pt-2 text-sm text-slate-600">Pages count parent tasks only; total tasks above includes descendants.</p>
        )}
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={pagination.setPage}
          pageSize={pagination.pageSize}
          onPageSizeChange={pagination.setPageSize}
          totalItems={pagination.totalItems}
        />
        </div>
      )}

      {/* Filter Modal */}
      <TaskFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filter={filters}
        onApply={handleFilterChange}
        assignees={assignees}
        projects={projects}
      />

      {cloneSourceTaskId && (
        <TaskCloneDialog
          open
          nodes={(taskTreeRowsQ.data?.task_tree_rows ?? []) as CloneTreeNode[]}
          sourceTaskId={cloneSourceTaskId}
          loading={taskTreeRowsQ.loading}
          submitting={cloneSubmitting || recoveryState?.busy === 'mutation'}
          serverError={recoveryState ? `${recoveryState.message}${cloneError ? ` ${cloneError}` : ''}` : cloneError}
          loadError={taskTreeRowsQ.error?.message ?? null}
          requiresRefresh={cloneRecovery !== null}
          retrying={cloneRefreshing || recoveryState?.busy === 'refresh'}
          onRetry={handleRetryCloneRefresh}
          onClose={() => {
            setCloneSourceTaskId(null);
            setCloneError(null);
          }}
          onSubmit={handleCloneSubmit}
        />
      )}

      {/* TaskDetail khi được chọn */}
      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          isOpen={isTaskDetailOpen}
          onClose={() => setIsTaskDetailOpen(false)}
          onTaskUpdate={handleTaskUpdate}
          currentUser={user || undefined}
          projectMembers={reduxMembers}
        />
      )}

      {/* Thêm CSS cho task con */}
      <style jsx>{taskNestedStyles}</style>
    </div>
  );
}
