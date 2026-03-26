'use client';

import { useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { GET_DASHBOARD_TASKS } from '@/graphql/queries/dashboard';

interface DashboardTask {
  taskId: string;
  title: string;
  projectId: string;
  status: string;
  priority: string;
  type: string | null;
  dueDate: string | null;
  assignee: {
    userId: string;
    username: string;
    avatarUrl?: string;
  } | null;
}

/**
 * Hook for dashboard data. PM gets all tasks, member gets only their assigned tasks.
 */
export function useDashboardTasks(userId: string, role: string) {
  const isPM = ['admin', 'manager', 'leader', 'pm'].includes(role?.toLowerCase() ?? '');

  const { data, loading, error } = useQuery(GET_DASHBOARD_TASKS, {
    variables: isPM ? {} : { assigneeId: userId },
    fetchPolicy: 'cache-and-network',
    skip: !userId, // Skip query if user not available yet
  });

  const tasks: DashboardTask[] = data?.tasks || [];

  const derived = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const activeTasks = tasks.filter(
      t => !['done', 'close', 'archived'].includes(t.status?.toLowerCase())
    );

    const overdueTasks = activeTasks.filter(t => {
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < now;
    });

    const doingTasks = activeTasks.filter(
      t => t.status?.toLowerCase() === 'doing'
    );

    const bugTasks = activeTasks.filter(
      t => t.type?.toLowerCase() === 'bug'
    );

    const criticalTasks = activeTasks.filter(
      t => ['critical', 'urgent'].includes(t.priority?.toLowerCase())
    );

    // Status breakdown for member view
    const tasksByStatus: Record<string, DashboardTask[]> = {};
    for (const t of activeTasks) {
      const s = t.status?.toLowerCase() || 'unknown';
      if (!tasksByStatus[s]) tasksByStatus[s] = [];
      tasksByStatus[s].push(t);
    }

    return {
      activeTasks,
      overdueTasks,
      doingTasks,
      bugTasks,
      criticalTasks,
      tasksByStatus,
    };
  }, [tasks]);

  return { tasks, loading, error, isPM, ...derived };
}
