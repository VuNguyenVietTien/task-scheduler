'use client';

import { useEffect, useCallback, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';

interface RealtimeNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  notification_type: string;
  reference_id: string | null;
  created_at: string;
}

/**
 * Subscribe to real-time notification inserts for a user.
 * Returns new notifications as they arrive.
 */
export function useRealtimeNotifications(userId: string | null) {
  const [newNotifications, setNewNotifications] = useState<RealtimeNotification[]>([]);

  const clearNotifications = useCallback(() => {
    setNewNotifications([]);
  }, []);

  useEffect(() => {
    if (!userId) return;

    const supabase = createBrowserClient();

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes' as never,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        } as never,
        ((payload: { new: RealtimeNotification }) => {
          setNewNotifications(prev => [payload.new, ...prev]);
        }) as never
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { newNotifications, clearNotifications };
}
