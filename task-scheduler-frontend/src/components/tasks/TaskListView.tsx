'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Task, TaskStatus, Priority, TaskFilter, TaskStatuses, Priorities, UserBasic } from '@/types/task';
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
  updateTaskDueDate
} from '@/redux/features/tasksSlice';
import { useRouter } from 'next/navigation';
import { ProjectMember } from '@/hooks/useProject';

interface TaskListViewProps {
  tasks: Task[];
  onTaskClick?: (taskId: string) => void;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
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
  onTaskClick,
  pagination,
  filters = {},
  setFilters
}: TaskListViewProps) {
  const [filter, setFilter] = useState<TaskFilter>({});
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const { user } = useAuth();
  const [editingCell, setEditingCell] = useState<{taskId: string, field: string} | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  
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
  
  // Khởi tạo router ở cấp độ component
  const router = useRouter();
  
  // Function cập nhật một task cụ thể, giữ nguyên các task khác
  const updateSingleTaskInState = useCallback((taskId: string, updates: Partial<Task>) => {
    setTasks(currentTasks => {
      // Tìm task cần cập nhật
      const taskIndex = currentTasks.findIndex(t => t.task_id === taskId);
      
      // Nếu không tìm thấy task, trả về danh sách hiện tại
      if (taskIndex === -1) {
        console.warn('Không tìm thấy task có ID:', taskId);
        return currentTasks;
      }
      
      // Tạo bản sao của mảng tasks và cập nhật task cụ thể
      const updatedTasks = [...currentTasks];
      updatedTasks[taskIndex] = {
        ...updatedTasks[taskIndex],
        ...updates
      };
      
      return updatedTasks;
    });
  }, []);
  
  useEffect(() => {
    // Chỉ cập nhật dữ liệu nếu không có chỉnh sửa đang diễn ra
    if (!editingCell) {
    setTasks(initialTasks);
    }
  }, [initialTasks, editingCell]);

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
      reduxMembers.forEach((member: ProjectMember) => {
        if (member.user && member.user.userId) {
          uniqueAssignees.set(member.user.userId, {
            userId: member.user.userId,
            username: member.user.username || member.user.fullName || member.user.email,
            avatarUrl: member.user.avatarUrl || undefined,
            role: member.role
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

  // Đếm các task theo trạng thái
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    
    Object.values(TaskStatuses).forEach(status => {
      counts[status] = 0;
    });
    
    tasks.forEach(task => {
      if (counts[task.status] !== undefined) {
        counts[task.status]++;
      }
    });
    
    return counts;
  }, [tasks]);

  // Filter tasks client-side when server pagination is not available
  const { completedTasks, incompleteTasks } = useMemo(() => {
    // Nếu có pagination từ server, chỉ phân loại theo hoàn thành/chưa hoàn thành
    // không lọc thêm vì server đã xử lý
    if (pagination) {
      return {
        completedTasks: tasks.filter(task => task.status === TaskStatuses.DONE),
        incompleteTasks: tasks.filter(task => task.status !== TaskStatuses.DONE),
      };
    }

    // Ngược lại, lọc client-side khi không có pagination từ server
    const filteredTasks = tasks.filter(task => {
      // Skip child tasks as they will be displayed under parent
      if (task.parent_task_id) return false;

      // Apply filters only when no pagination is provided
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        if (!task.title.toLowerCase().includes(query) &&
            !task.description?.toLowerCase().includes(query)) {
          return false;
        }
      }

      if (filters.status && task.status !== filters.status) {
        return false;
      }

      if (filters.priority && task.priority !== filters.priority) {
        return false;
      }

      if (filters.assigneeId && task.assignee?.userId !== filters.assigneeId) {
        return false;
      }

      if (filters.startDate && task.start_date && 
          new Date(task.start_date) < new Date(filters.startDate)) {
        return false;
      }

      if (filters.endDate && task.due_date && 
          new Date(task.due_date) > new Date(filters.endDate)) {
        return false;
      }

      if (filters.projectId && task.project_id !== filters.projectId) {
        return false;
      }

      return true;
    });

    return {
      completedTasks: filteredTasks.filter(task => task.status === TaskStatuses.DONE),
      incompleteTasks: filteredTasks.filter(task => task.status !== TaskStatuses.DONE),
    };
  }, [tasks, filters, pagination]);

  // Sort tasks
  const sortedIncompleteTasks = useMemo(() => {
    return [...incompleteTasks].sort((a, b) => a.priority_order - b.priority_order);
  }, [incompleteTasks]);

  const sortedCompletedTasks = useMemo(() => {
    return [...completedTasks].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (!aValue || !bValue) return 0;
      
      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [completedTasks, sortConfig]);

  const displayedTasks = useMemo(() => {
    return showCompletedTasks 
      ? [...sortedIncompleteTasks, ...sortedCompletedTasks]
      : sortedIncompleteTasks;
  }, [sortedIncompleteTasks, sortedCompletedTasks, showCompletedTasks]);

  // Function cập nhật task trực tiếp vào danh sách hiện tại
  const updateDisplayedTask = useCallback((taskId: string, updates: Partial<Task>) => {
    const taskIndex = displayedTasks.findIndex(t => t.task_id === taskId);
    if (taskIndex !== -1) {
      const newTasks = [...displayedTasks];
      newTasks[taskIndex] = {
        ...newTasks[taskIndex],
        ...updates
      };
      
      // Cập nhật dữ liệu trong các collection gốc để tránh bị reset
      const updatedTask = newTasks[taskIndex];
      
      // Cập nhật trong incompleteTasks và completedTasks để memoized state được cập nhật
      const incompleteCopy = [...incompleteTasks];
      const completeCopy = [...completedTasks];
      
      if (updatedTask.status === TaskStatuses.DONE) {
        // Nếu task chuyển sang trạng thái hoàn thành
        const incompleteIndex = incompleteCopy.findIndex(t => t.task_id === taskId);
        if (incompleteIndex !== -1) {
          // Xóa khỏi incompleteTasks và thêm vào completedTasks
          incompleteCopy.splice(incompleteIndex, 1);
          if (!completeCopy.some(t => t.task_id === taskId)) {
            completeCopy.push(updatedTask);
          } else {
            // Cập nhật trong completedTasks nếu đã tồn tại
            const completeIndex = completeCopy.findIndex(t => t.task_id === taskId);
            completeCopy[completeIndex] = updatedTask;
          }
        }
      } else {
        // Nếu task không phải trạng thái hoàn thành
        const completeIndex = completeCopy.findIndex(t => t.task_id === taskId);
        if (completeIndex !== -1) {
          // Xóa khỏi completedTasks và thêm vào incompleteTasks
          completeCopy.splice(completeIndex, 1);
          if (!incompleteCopy.some(t => t.task_id === taskId)) {
            incompleteCopy.push(updatedTask);
          }
        } else {
          // Cập nhật trong incompleteTasks nếu đã tồn tại
          const incompleteIndex = incompleteCopy.findIndex(t => t.task_id === taskId);
          if (incompleteIndex !== -1) {
            incompleteCopy[incompleteIndex] = updatedTask;
          }
        }
      }
      
      // Cập nhật cả trong mảng tasks gốc để đảm bảo dữ liệu nhất quán
      const originalTaskIndex = tasks.findIndex(t => t.task_id === taskId);
      if (originalTaskIndex !== -1) {
        const updatedTasks = [...tasks];
        updatedTasks[originalTaskIndex] = {
          ...updatedTasks[originalTaskIndex],
          ...updates
        };
        
        // Không thể cập nhật trực tiếp 'tasks' nếu nó là prop, nhưng ta đã cập nhật các mảng dẫn xuất
      }
      
      // Trả về danh sách mới
      return newTasks;
    }
    return displayedTasks;
  }, [displayedTasks, incompleteTasks, completedTasks, tasks]);

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
                    onClick={() => handleTaskClick(childTask.task_id)}
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
                        {status.replace(/_/g, ' ')}
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
                {childTask.status.replace(/_/g, ' ')}
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
                        {priority}
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
                {childTask.priority}
              </span>
            )}
          </td>
          <td className="px-3 py-4 whitespace-nowrap">
            {childTask.type ? (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE_COLORS[childTask.type] || 'bg-gray-100 text-gray-800'}`}>
                {childTask.type}
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
                    {assignees.map((assignee) => (
                      <option key={assignee.userId} value={assignee.userId}>
                        {assignee.username}
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
                onClick={(e) => { e.stopPropagation(); handleStartEditing(childTask.task_id, 'assignee_id', childTask.assignee?.userId || ''); }}
              >
                {childTask.assignee ? (
                  <>
                    <UserAvatar 
                      username={childTask.assignee.username} 
                      avatarUrl={childTask.assignee.avatarUrl} 
                      size="md" 
                    />
                    <span>{childTask.assignee.username}</span>
                  </>
                ) : (
                  <span className="text-slate-400">Chưa gán</span>
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

  // Sửa lại hàm handleTaskClick
  const handleTaskClick = useCallback((taskId: string) => {
    // Tìm task trong tất cả các task (cả cha và con)
    let foundTask: Task | undefined = tasks.find(t => t.task_id === taskId || t.id === taskId);
    
    // Nếu không tìm thấy trong danh sách tasks chính, tìm trong các task con
    if (!foundTask) {
      for (const parentTask of tasks) {
        if (parentTask.child_tasks && parentTask.child_tasks.length > 0) {
          foundTask = parentTask.child_tasks.find(child => child.task_id === taskId || child.id === taskId);
          if (foundTask) break;
        }
      }
    }
    
    if (foundTask) {
      // Lấy project_id từ task
      const projectId = foundTask.project_id;
      
      // Tạo URL đích
      const url = `/projects/${projectId}/tasks/${taskId}`;
      
      // Kiểm tra xem URL hiện tại đã là URL đích hay chưa để tránh vòng lặp
      if (typeof window !== 'undefined' && window.location.pathname !== url) {
        router.push(url);
      }
    } else {
      console.warn(`Không tìm thấy task với ID: ${taskId}`);
    }
    
    // Nếu có callback onTaskClick từ props, gọi nó
    if (onTaskClick) {
      onTaskClick(taskId);
    }
  }, [tasks, router, onTaskClick]);

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

  const handleFilterChange = (newFilters: TaskFilter) => {
    if (setFilters) {
      setFilters(newFilters);
    }
  };

  const hasFilters = Object.keys(filters).length > 0;

  // Xử lý bắt đầu chỉnh sửa
  const handleStartEditing = (taskId: string, field: string, value: any) => {
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
    const currentTask = tasks.find(t => t.task_id === taskId);
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
        
        // Optimistic update cho UI - Chỉ cập nhật task được chọn
        updateSingleTaskInState(taskId, { status });
        
        try {
          // CÁCH MỚI: Sử dụng Redux dispatch
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
        
        // Optimistic update cho UI - Chỉ cập nhật task được chọn
        updateSingleTaskInState(taskId, { priority });
        
        try {
          // CÁCH MỚI: Sử dụng Redux dispatch
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
        const effort = parseFloat(editValue) || 0;
        
        // Lưu lại tasks hiện tại để khôi phục nếu API call thất bại
        const originalTasks = [...tasks];
        
        // Optimistic update cho UI - Chỉ cập nhật task được chọn
        updateSingleTaskInState(taskId, { effort });
        
        try {
          // CÁCH MỚI: Sử dụng Redux dispatch
          await dispatch(updateTaskEffort({ taskId, effort })).unwrap();
          console.log(`Đã cập nhật công sức thành: ${effort} (qua Redux)`);
          
          /* CÁCH CŨ: Sử dụng hook mutation
          const result = await updateEffort(taskId, effort);
          console.log(`Đã cập nhật công sức thành: ${effort}`, result);
          */
        } catch (error) {
          console.error('Lỗi khi gọi API cập nhật công sức:', error);
          // Khôi phục trạng thái cũ nếu API call thất bại
          setTasks(originalTasks);
          alert(`Không thể cập nhật công sức: ${error}`);
          return; // Thoát sớm, không đóng chế độ chỉnh sửa
        }
      } 
      else if (field === 'assignee_id') {
        const assigneeId = editValue === "" ? null : editValue;
        
        // Lưu lại tasks hiện tại để khôi phục nếu API call thất bại
        const originalTasks = [...tasks];
        
        // Optimistic update cho UI - Chỉ cập nhật task được chọn
        // Sửa assignee_id thành assignee và cập nhật cấu trúc đúng
        const assigneeObj = assigneeId ? 
          assignees.find(a => a.userId === assigneeId) || undefined : 
          undefined;
        
        updateSingleTaskInState(taskId, { 
          assignee: assigneeObj 
        });
        
        try {
          // CÁCH MỚI: Sử dụng Redux dispatch
          await dispatch(updateTaskAssignee({ taskId, assigneeId: assigneeId as string | null })).unwrap();
          console.log(`Đã cập nhật người được giao thành: ${assigneeId} (qua Redux)`);
        } catch (error) {
          console.error('Lỗi khi gọi API cập nhật người được giao:', error);
          // Khôi phục trạng thái cũ nếu API call thất bại
          setTasks(originalTasks);
          alert(`Không thể cập nhật người được giao: ${error}`);
          return; // Thoát sớm, không đóng chế độ chỉnh sửa
        }
      }
      else if (field === 'due_date') {
        const dueDate = editValue;
        
        // Lưu lại tasks hiện tại để khôi phục nếu API call thất bại
        const originalTasks = [...tasks];
        
        // Optimistic update cho UI - Chỉ cập nhật task được chọn
        updateSingleTaskInState(taskId, { due_date: dueDate });
        
        try {
          // CÁCH MỚI: Sử dụng Redux dispatch
          await dispatch(updateTaskDueDate({ taskId, dueDate })).unwrap();
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
            Lọc công việc
            {hasFilters && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                {Object.keys(filters).length}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setShowCompletedTasks(!showCompletedTasks)}
            className={`inline-flex items-center px-3 py-2 border text-sm font-medium rounded-md transition-colors 
              ${showCompletedTasks 
                ? 'bg-slate-200 text-slate-800 border-slate-300' 
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
            aria-label={showCompletedTasks ? "Ẩn công việc đã hoàn thành" : "Hiện công việc đã hoàn thành"}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className={`h-5 w-5 mr-2 ${showCompletedTasks ? 'text-green-600' : 'text-slate-400'}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {showCompletedTasks ? 'Ẩn đã hoàn thành' : 'Hiện đã hoàn thành'}
          </button>
        </div>
        
        {/* Status Summary */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(statusCounts)
            .filter(([status]) => statusCounts[status] > 0)
            .map(([status, count]) => (
              <span 
                key={status} 
                className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${getStatusColor(status as TaskStatus)}`}
              >
                {status.replace(/_/g, ' ')}: {count}
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

      {/* Task List */}
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
                Tiêu đề
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Trạng thái
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Ưu tiên
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Loai
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Người được giao
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Hạn
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Công sức
              </th>
              <th scope="col" className="relative px-3 py-3">
                <span className="sr-only">Thao tác</span>
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
                            onClick={() => handleTaskClick(task.task_id)}
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
                                  {status.replace(/_/g, ' ')}
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
                          {task.status.replace(/_/g, ' ')}
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
                                  {priority}
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
                          {task.priority}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      {task.type ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE_COLORS[task.type] || 'bg-gray-100 text-gray-800'}`}>
                          {task.type}
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
                              {assignees.map((assignee) => (
                                <option key={assignee.userId} value={assignee.userId}>
                                  {assignee.username}
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
                          onClick={(e) => { e.stopPropagation(); handleStartEditing(task.task_id, 'assignee_id', task.assignee?.userId || ''); }}
                        >
                          {task.assignee ? (
                            <>
                              <UserAvatar 
                                username={task.assignee.username} 
                                avatarUrl={task.assignee.avatarUrl} 
                                size="md" 
                              />
                              <span>{task.assignee.username}</span>
                            </>
                          ) : (
                            <span className="text-slate-400">Chưa gán</span>
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
                        <p className="text-lg font-medium">Không tìm thấy công việc nào</p>
                        <p className="mt-1">Thử thay đổi bộ lọc hoặc tạo công việc mới</p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-medium">Chưa có công việc nào</p>
                        <p className="mt-1">Thêm công việc mới ngay để bắt đầu</p>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 0 && (
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={pagination.setPage}
          pageSize={pagination.pageSize}
          onPageSizeChange={pagination.setPageSize}
          totalItems={pagination.totalItems}
        />
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

      {/* TaskDetail khi được chọn */}
      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          isOpen={isTaskDetailOpen}
          onClose={() => setIsTaskDetailOpen(false)}
          onTaskUpdate={handleTaskUpdate}
          currentUser={user || undefined}
        />
      )}

      {/* Thêm CSS cho task con */}
      <style jsx>{taskNestedStyles}</style>
    </div>
  );
}
