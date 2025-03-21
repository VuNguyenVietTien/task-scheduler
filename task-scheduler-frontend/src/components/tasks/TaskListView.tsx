'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Task, TaskStatus, Priority, TaskFilter, TaskAssignee, TaskStatuses, Priorities } from '@/types/task';
import { ProjectData } from '@/types/project';
import { TaskFilterBar } from './TaskFilterBar';
import { TaskBulkActions } from './TaskBulkActions';
import { useUpdateTaskPriorityOrder } from '@/hooks/useTasks';
import { UserAvatar } from '@/components/common/UserAvatar';
import { TaskFilterModal } from './TaskFilterModal';
import { Pagination } from '@/components/common/Pagination';

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

export function TaskListView({ 
  tasks, 
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

  // Memoize assignees and projects
  const { assignees, projects } = useMemo(() => {
    const uniqueAssignees = new Map<string, TaskAssignee>();
    const uniqueProjects = new Map<string, ProjectData>();
    
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
    
    return {
      assignees: Array.from(uniqueAssignees.values()),
      projects: Array.from(uniqueProjects.values())
    };
  }, [tasks]);

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

  const toggleTaskExpansion = (taskId: string) => {
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

  const renderTaskRow = (task: Task, level: number = 0): JSX.Element => {
    const hasChildren = task.child_tasks && task.child_tasks.length > 0;
    const isExpanded = expandedTasks.has(task.task_id);

    return (
      <React.Fragment key={task.task_id}>
        <tr className={`hover:bg-slate-50 ${level > 0 ? 'bg-slate-50' : ''}`}>
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
          <td className="py-4 pl-4 pr-3 text-sm sm:pl-6" onClick={() => onTaskClick?.(task.task_id)}>
            <div className="flex items-center">
              {level > 0 && (
                <span className="inline-block w-[20px] ml-[20px]" />
              )}
              {hasChildren && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTaskExpansion(task.task_id);
                  }}
                  className="mr-2 p-1 hover:bg-slate-200 rounded"
                  title={isExpanded ? "Thu gọn" : "Mở rộng"}
                  aria-label={isExpanded ? "Thu gọn" : "Mở rộng"}
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'transform rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
              <div>
                <div className="font-medium text-slate-900 cursor-pointer">{task.title}</div>
              </div>
            </div>
          </td>
          <td className="px-3 py-4 text-sm">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
              {task.status.replace(/_/g, ' ')}
            </span>
          </td>
          <td className="px-3 py-4 text-sm">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
              {task.priority}
            </span>
          </td>
          <td className="px-3 py-4 text-sm">
            {task.assignee ? (
              <div className="flex items-center gap-2">
                <UserAvatar 
                  username={task.assignee.username} 
                  avatarUrl={task.assignee.avatarUrl} 
                  size="md" 
                />
                <span>{task.assignee.username}</span>
              </div>
            ) : (
              <span className="text-slate-400">Chưa gán</span>
            )}
          </td>
          <td className="px-3 py-4 text-sm text-slate-500">
            {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
          </td>
          <td className="px-3 py-4 text-sm text-slate-500">
            {task.effort ? `${task.effort}h` : '-'}
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
        {hasChildren && isExpanded && task.child_tasks?.map((childTask) => (
          renderTaskRow(childTask, level + 1)
        ))}
      </React.Fragment>
    );
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

  const handleFilterChange = (newFilters: TaskFilter) => {
    if (setFilters) {
      setFilters(newFilters);
    }
  };

  const hasFilters = Object.keys(filters).length > 0;
  
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
              displayedTasks.map(task => renderTaskRow(task))
            ) : (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
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
    </div>
  );
}
