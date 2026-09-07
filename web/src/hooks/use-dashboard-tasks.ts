'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApolloClient } from '@apollo/client';
import {
  GET_DASHBOARD_PROJECTS,
  GET_DASHBOARD_TASK_ROWS,
} from '@/graphql/queries/dashboard';

interface DashboardTaskRow {
  task_id: string;
  title: string;
  project_id: string;
  status: string;
  priority: string;
  type_: string | null;
  due_date: string | null;
  assignee?: { user_id: string; username?: string | null } | null;
}

interface DashboardTask extends Omit<DashboardTaskRow, 'type_' | 'assignee'> {
  type: string | null;
  assignee: { user_id: string; username: string } | null;
}

interface DashboardProject {
  project_id: string;
}

const PROJECT_QUERY_CONCURRENCY = 4;

async function mapWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(PROJECT_QUERY_CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Loads all tasks from each project the authenticated caller can see. The
 * project list and TaskTreeRows each enforce the same owner/member boundary.
 */
export function useDashboardTasks(userId: string, role: string) {
  const client = useApolloClient();
  const isPM = ['admin', 'manager', 'leader', 'pm'].includes(role?.toLowerCase() ?? '');
  const requestId = useRef(0);
  const [state, setState] = useState<{
    tasks: DashboardTask[];
    loading: boolean;
    error?: Error;
  }>({ tasks: [], loading: false });

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setState({ tasks: [], loading: true });

    try {
      const projectsResponse = await client.query<{ projects?: DashboardProject[] }>({
        query: GET_DASHBOARD_PROJECTS,
        fetchPolicy: 'network-only',
      });
      if (projectsResponse.errors?.length) throw new Error(projectsResponse.errors[0].message);
      if (!Array.isArray(projectsResponse.data?.projects)) throw new Error('Project list response is missing');

      const projectIds = projectsResponse.data.projects.map(project => project.project_id);
      const taskRows = await mapWithConcurrency(projectIds, async projectId => {
        const response = await client.query<{ task_tree_rows?: DashboardTaskRow[] }>({
          query: GET_DASHBOARD_TASK_ROWS,
          variables: { projectId },
          fetchPolicy: 'network-only',
        });
        if (response.errors?.length) throw new Error(response.errors[0].message);
        if (!Array.isArray(response.data?.task_tree_rows)) throw new Error(`Task tree response is missing for project ${projectId}`);
        return response.data.task_tree_rows.filter(task => task.project_id === projectId);
      });

      const distinct = new Map<string, DashboardTask>();
      for (const row of taskRows.flat()) {
        distinct.set(row.task_id, {
          ...row,
          type: row.type_,
          assignee: row.assignee ? { user_id: row.assignee.user_id, username: row.assignee.username ?? '' } : null,
        });
      }
      const tasks = [...distinct.values()].filter(task => isPM || task.assignee?.user_id === userId);
      if (requestId.current === currentRequest) setState({ tasks, loading: false });
    } catch (error) {
      if (requestId.current === currentRequest) {
        setState({
          tasks: [],
          loading: false,
          error: error instanceof Error ? error : new Error('Failed to load dashboard tasks'),
        });
      }
    }
  }, [client, isPM, userId]);

  useEffect(() => {
    if (!userId) {
      requestId.current += 1;
      setState({ tasks: [], loading: false });
      return;
    }
    void load();
    return () => { requestId.current += 1; };
  }, [load, userId]);

  const derived = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const activeTasks = state.tasks.filter(
      task => !['DONE', 'CLOSE', 'ARCHIVED'].includes(task.status?.toUpperCase())
    );
    const overdueTasks = activeTasks.filter(task => task.due_date && new Date(task.due_date) < now);
    const doingTasks = activeTasks.filter(task => task.status?.toUpperCase() === 'DOING');
    const bugTasks = activeTasks.filter(task => task.type?.toLowerCase() === 'bug');
    const criticalTasks = activeTasks.filter(task => ['CRITICAL', 'URGENT'].includes(task.priority?.toUpperCase()));
    const tasksByStatus: Record<string, DashboardTask[]> = {};

    for (const task of activeTasks) {
      const status = task.status?.toUpperCase() || 'unknown';
      (tasksByStatus[status] ??= []).push(task);
    }

    return { activeTasks, overdueTasks, doingTasks, bugTasks, criticalTasks, tasksByStatus };
  }, [state.tasks]);

  return { tasks: state.tasks, loading: state.loading, error: state.error, isPM, refetch: load, ...derived };
}
