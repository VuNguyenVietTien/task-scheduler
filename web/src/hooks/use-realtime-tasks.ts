'use client';

import { useEffect, useRef } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';

interface TaskUpdate {
  id: string;
  status: string;
  priority_order: number;
  [key: string]: unknown;
}

/**
 * Subscribe to real-time task updates within a project.
 * Calls onTaskUpdate callback when any task in the project changes.
 */
export function useRealtimeTasks(
  projectId: string | null,
  onTaskUpdate: (task: TaskUpdate) => void
) {
  const callbackRef = useRef(onTaskUpdate);
  callbackRef.current = onTaskUpdate;

  useEffect(() => {
    if (!projectId) return;

    const supabase = createBrowserClient();

    const channel = supabase
      .channel(`project-tasks-${projectId}`)
      .on(
        'postgres_changes' as never,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${projectId}`,
        } as never,
        ((payload: { new: TaskUpdate }) => {
          callbackRef.current(payload.new);
        }) as never
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);
}
