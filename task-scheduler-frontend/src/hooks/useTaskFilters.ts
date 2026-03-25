import { useState, useCallback, useMemo } from 'react';
import { Task, TaskStatus, Priority } from '@/types/task';

export interface TaskFilter {
  status?: TaskStatus;
  priority?: Priority;
  assignee?: string;
}

export interface TaskSort {
  field: 'deadline' | 'priority' | 'status';
  direction: 'asc' | 'desc';
}

export function useTaskFilters(tasks: Task[]) {
  const [filters, setFilters] = useState<TaskFilter>({});
  const [sort, setSort] = useState<TaskSort>({
    field: 'deadline',
    direction: 'asc'
  });

  const handleFilterChange = useCallback((newFilters: TaskFilter) => {
    setFilters(newFilters);
  }, []);

  const handleSortChange = useCallback((newSort: TaskSort) => {
    setSort(newSort);
  }, []);

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Apply filters
    if (filters.status) {
      result = result.filter(task => task.status === filters.status);
    }
    if (filters.priority) {
      result = result.filter(task => task.priority === filters.priority);
    }
    if (filters.assignee) {
      result = result.filter(task => task.assignees.some(a => a.id === filters.assignee));
    }

    // Apply sorting
    const sortFn = (a: Task, b: Task) => {
      const direction = sort.direction === 'asc' ? 1 : -1;
      
      switch (sort.field) {
        case 'deadline':
          return (new Date(a.deadline).getTime() - new Date(b.deadline).getTime()) * direction;
        
        case 'priority': {
          const priorityWeight = { high: 3, medium: 2, low: 1 };
          return (priorityWeight[b.priority] - priorityWeight[a.priority]) * direction;
        }
        
        case 'status': {
          const statusWeight: Record<string, number> = {
            todo: 1,
            pending: 2,
            doing: 3,
            review: 4,
            done: 5,
            close: 6,
            blocked: 7,
            rejected: 8,
            archived: 9,
          };
          return (statusWeight[a.status] - statusWeight[b.status]) * direction;
        }
        
        default:
          return 0;
      }
    };

    return result.sort(sortFn);
  }, [tasks, filters, sort]);

  const stats = useMemo(() => {
    const initialStats = {
      total: tasks.length,
      byPriority: {
        high: 0,
        medium: 0,
        low: 0
      } as Record<Priority, number>,
      byStatus: {
        todo: 0,
        doing: 0,
        done: 0,
        close: 0,
        pending: 0,
        review: 0,
        blocked: 0,
        rejected: 0,
        archived: 0,
      } as Record<string, number>
    };

    return tasks.reduce((acc, task) => {
      // Update priority counts
      acc.byPriority[task.priority]++;
      
      // Update status counts
      acc.byStatus[task.status]++;

      return acc;
    }, initialStats);
  }, [tasks]);

  return {
    filters,
    sort,
    filteredTasks,
    stats,
    handleFilterChange,
    handleSortChange
  };
}
