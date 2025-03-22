'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Task, TaskStatus, Priority, TaskFilter, TaskAssignee, TaskStatuses, Priorities } from '@/types/task';
import { ProjectData } from '@/types/project';
import { TaskFilterBar } from './TaskFilterBar';
import { TaskBulkActions } from './TaskBulkActions';
import { useUpdateTaskPriorityOrder, useUpdateTask } from '@/hooks/useTasks';
import { UserAvatar } from '@/components/common/UserAvatar';
import { TaskFilterModal } from './TaskFilterModal';
import { Pagination } from '@/components/common/Pagination';
import { TaskDetail } from './TaskDetail';
import { useAuth } from '@/contexts/AuthContext';

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
  
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

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

  const handleTaskClick = (taskId: string) => {
    // Chuyển hướng đến trang chi tiết task thay vì mở modal
    const task = tasks.find(t => t.task_id === taskId || t.id === taskId);
    if (task) {
      // Lấy project_id từ task
      const projectId = task.project_id;
      
      // Chuyển hướng đến trang chi tiết task
      window.location.href = `/projects/${projectId}/tasks/${taskId}`;
    }
    
    // Nếu có callback onTaskClick từ props, gọi nó
    if (onTaskClick) {
      onTaskClick(taskId);
    }
  };

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

  // Xử lý lưu chỉnh sửa vào database
  const handleSaveEditing = async (taskId: string, field: string) => {
    // Tạo đối tượng cập nhật - CHỈ bao gồm trường đang cập nhật
    const updates: Partial<Task> = {};
    
    // Chuyển đổi giá trị theo loại trường
    if (field === 'status') {
      updates.status = editValue as TaskStatus;
      console.log(`Đang cập nhật trạng thái: ${editValue}`);
    } else if (field === 'priority') {
      updates.priority = editValue as Priority;
      console.log(`Đang cập nhật độ ưu tiên: ${editValue}`);
    } else if (field === 'effort') {
      updates.effort = parseFloat(editValue) || 0;
      console.log(`Đang cập nhật công sức: ${updates.effort}`);
    } else if (field === 'due_date') {
      updates.due_date = editValue;
      console.log(`Đang cập nhật ngày hết hạn: ${editValue}`);
    } else if (field === 'assignee_id') {
      updates.assignee_id = editValue;
      console.log(`Đang cập nhật người được giao: ${editValue}`);
    }
    
    // Tạo một bản sao của task hiện tại để cập nhật UI optimistically
    const currentTask = tasks.find(t => t.task_id === taskId);
    if (!currentTask) {
      console.error('Không tìm thấy task có ID:', taskId);
      return;
    }
    
    // Cập nhật UI ngay lập tức để phản hồi người dùng (optimistic update)
    // Cập nhật task trong mảng tasks hiện tại
    const updatedTasks = tasks.map(task => 
      task.task_id === taskId 
        ? { ...task, ...updates } 
        : task
    );
    
    // Cập nhật state với dữ liệu mới
    setTasks(updatedTasks);
    
    // Cập nhật task
    try {
      // Hiển thị trạng thái đang cập nhật
      console.log('Đang cập nhật công việc...', { taskId, updates });
      
      // Thực hiện API call để cập nhật vào database
      // updateTask đã có xử lý chuyển đổi enum phù hợp
      // Chỉ gửi trường cần cập nhật lên server, không gửi các trường khác
      const updatedTaskData = await updateTask(taskId, updates);
      
      // Cập nhật state với dữ liệu từ API để đảm bảo dữ liệu chính xác
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.task_id === taskId 
            ? { ...task, ...updatedTaskData } 
            : task
        )
      );
      
      // Thông báo thành công
      console.log('Đã cập nhật công việc thành công trong database!', updatedTaskData);
      
      // Đóng chế độ chỉnh sửa
      setEditingCell(null);
      setEditValue('');
    } catch (error) {
      console.error('Lỗi khi cập nhật công việc:', error);
      
      // Vẫn giữ UI đã cập nhật mặc dù API có lỗi
      // Không cần phải revert vì chúng ta đã cập nhật UI trong setTasks
      
      // Đóng chế độ chỉnh sửa
      setEditingCell(null);
      setEditValue('');
      
      // Hiển thị thông báo lỗi
      alert('Không thể cập nhật công việc trên máy chủ, nhưng UI đã được cập nhật tạm thời!');
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
              displayedTasks.map(task => (
                <React.Fragment key={task.task_id}>
                  <tr className={`hover:bg-slate-50`}>
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
                  {task.child_tasks && task.child_tasks.length > 0 && (
                    <tr className={`hover:bg-slate-50`}>
                      <td colSpan={8} className="px-6 py-4 text-sm text-slate-500">
                        {task.child_tasks.map((childTask) => (
                          <div key={childTask.task_id} className="ml-4">
                            {childTask.title}
                          </div>
                        ))}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
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
    </div>
  );
}
