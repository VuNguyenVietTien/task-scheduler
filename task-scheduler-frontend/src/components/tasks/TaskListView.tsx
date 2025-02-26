'use client';

import { Task, TaskStatus, Priority, TaskFilter, User } from '@/types/task';
import { TaskFilterBar } from './TaskFilterBar';
import { TaskBulkActions } from './TaskBulkActions';
import { useState, useMemo, useCallback } from 'react';
import { useUpdateTaskPriorityOrder } from '@/hooks/useTasks';


interface TaskListViewProps {
  tasks: Task[];
  onTaskClick?: (taskId: string) => void;
}

interface SortConfig {
  key: keyof Task;
  direction: 'asc' | 'desc';
}

export function TaskListView({ tasks, onTaskClick }: TaskListViewProps): JSX.Element {
  const [filter, setFilter] = useState<TaskFilter>({});
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'createdAt', direction: 'desc' });
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Get unique assignees from all tasks
  const assignees = useMemo(() => {
    const uniqueAssignees = new Map<string, User>();
    tasks.forEach(task => {
      task.assignees.forEach(assignee => {
        if (!uniqueAssignees.has(assignee.id)) {
          uniqueAssignees.set(assignee.id, assignee);
        }
      });
    });
    return Array.from(uniqueAssignees.values());
  }, [tasks]);

  // Separate tasks by completion status and apply filters
  const { completedTasks, incompleteTasks } = useMemo(() => {
    const filteredTasks = tasks.filter(task => {
      // Only include top-level tasks (no parent)
      if (task.parentTaskId) return false;

      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        if (!task.title.toLowerCase().includes(query) &&
            !task.description?.toLowerCase().includes(query)) {
          return false;
        }
      }

      if (filter.status && task.status !== filter.status) {
        return false;
      }

      if (filter.priority && task.priority !== filter.priority) {
        return false;
      }

      if (filter.assigneeId && !task.assignees.some(a => a.id === filter.assigneeId)) {
        return false;
      }

      if (filter.startDate && new Date(task.startDate!) < new Date(filter.startDate)) {
        return false;
      }

      if (filter.endDate && new Date(task.deadline!) > new Date(filter.endDate)) {
        return false;
      }

      return true;
    });

    return {
      completedTasks: filteredTasks.filter(task => task.status === TaskStatus.DONE),
      incompleteTasks: filteredTasks.filter(task => task.status !== TaskStatus.DONE),
    };
  }, [tasks, filter]);

  // Sort tasks by priority order for incomplete tasks
  const sortedIncompleteTasks = useMemo(() => {
    return [...incompleteTasks].sort((a, b) => a.priorityOrder - b.priorityOrder);
  }, [incompleteTasks]);

  // Sort completed tasks by the current sort config
  const sortedCompletedTasks = useMemo(() => {
    return [...completedTasks].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (!aValue || !bValue) return 0;
      
      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [completedTasks, sortConfig]);

  // Combine tasks based on showCompletedTasks setting
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

  const renderTaskRow = (task: Task, index: number, level: number = 0): JSX.Element => {
    const hasChildren = task.childTasks && task.childTasks.length > 0;
    const isExpanded = expandedTasks.has(task.id);

    return (
      <>
        <tr className={`hover:bg-slate-50 ${level > 0 ? 'bg-slate-50' : ''}`}>
          <td className="w-8 py-4 pl-4 pr-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={selectedTasks.has(task.id)}
                onChange={(e) => toggleTaskSelection(task.id, e)}
              />
            </div>
          </td>
          <td className="py-4 pl-4 pr-3 text-sm sm:pl-6" onClick={() => onTaskClick?.(task.id)}>
            <div className="flex items-center">
              {level > 0 && (
                <span className="inline-block w-[20px] ml-[20px]" />
              )}
              {hasChildren && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTaskExpansion(task.id);
                  }}
                  className="mr-2 p-1 hover:bg-slate-200 rounded"
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
                <div className="text-slate-500">{task.description}</div>
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
            <div className="flex -space-x-2">
              {task.assignees.map((assignee) => (
                <img
                  key={assignee.id}
                  className="inline-block h-6 w-6 rounded-full ring-2 ring-white"
                  src={assignee.avatarUrl}
                  alt={assignee.name}
                  title={assignee.name}
                />
              ))}
            </div>
          </td>
          <td className="px-3 py-4 text-sm text-slate-500">
            {task.deadline ? new Date(task.deadline).toLocaleDateString() : '-'}
          </td>
          <td className="px-3 py-4 text-sm text-slate-500">
            {task.effortHours ? `${task.effortHours}h` : '-'}
          </td>
          <td className="relative py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
            <button className="text-blue-600 hover:text-blue-900">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
            </button>
          </td>
        </tr>
        {hasChildren && isExpanded && task.childTasks?.map((childTask, childIndex) => (
          renderTaskRow(childTask, -1, level + 1)
        ))}
      </>
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
      .filter(task => selectedTasks.has(task.id))
      .map(task => ({
        Title: task.title,
        Description: task.description,
        Status: task.status,
        Priority: task.priority,
        'Due Date': task.deadline,
        'Effort (hours)': task.effortHours,
        Assignees: task.assignees.map(a => a.name).join(', ')
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

  const toggleTaskSelection = (taskId: string, e: React.MouseEvent | React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const toggleAllTasks = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedTasks(new Set(displayedTasks.map(t => t.id)));
    } else {
      setSelectedTasks(new Set());
    }
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case Priority.URGENT:
        return 'text-red-600 bg-red-50';
      case Priority.HIGH:
        return 'text-orange-600 bg-orange-50';
      case Priority.MEDIUM:
        return 'text-amber-600 bg-amber-50';
      case Priority.LOW:
        return 'text-green-600 bg-green-50';
      default:
        return 'text-slate-600 bg-slate-50';
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.DONE:
        return 'text-green-600 bg-green-50';
      case TaskStatus.IN_PROGRESS:
        return 'text-blue-600 bg-blue-50';
      case TaskStatus.IN_REVIEW:
        return 'text-purple-600 bg-purple-50';
      case TaskStatus.PLANNED:
        return 'text-amber-600 bg-amber-50';
      case TaskStatus.BACKLOG:
        return 'text-slate-600 bg-slate-50';
      default:
        return 'text-red-600 bg-red-50';
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

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <TaskFilterBar 
          onFilterChange={setFilter} 
          assignees={assignees} 
          showCompletedTasks={showCompletedTasks}
          onToggleCompleted={() => setShowCompletedTasks(prev => !prev)}
        />
      </div>
      
      <TaskBulkActions
        selectedCount={selectedTasks.size}
        onBulkStatusChange={handleBulkStatusChange}
        onBulkPriorityChange={handleBulkPriorityChange}
        onExport={handleExport}
        onDelete={handleBulkDelete}
      />
      
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead>
              <tr className="bg-slate-50">
                <th className="w-8 py-3.5 pl-4 pr-3">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={selectedTasks.size === displayedTasks.length && displayedTasks.length > 0}
                    onChange={toggleAllTasks}
                  />
                </th>
                <th 
                  scope="col" 
                  className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('title')}
                >
                  Title <SortIcon columnKey="title" />
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('status')}
                >
                  Status <SortIcon columnKey="status" />
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('priority')}
                >
                  Priority <SortIcon columnKey="priority" />
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                  Assignees
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('deadline')}
                >
                  Due Date <SortIcon columnKey="deadline" />
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('effortHours')}
                >
                  Effort <SortIcon columnKey="effortHours" />
                </th>
                <th scope="col" className="relative py-3.5 pl-3 pr-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {displayedTasks.map((task, index) => renderTaskRow(task, index))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
