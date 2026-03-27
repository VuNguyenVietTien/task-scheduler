'use client';

import { useEffect, useRef, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';

interface PresenceState {
  userId: string;
  name?: string;
}

/**
 * Subscribe to real-time document updates and track active editors via Presence.
 */
export function useRealtimeDocument(
  documentId: string | null,
  userId: string | null,
  onDocumentUpdate?: (payload: Record<string, unknown>) => void
) {
  const [activeEditors, setActiveEditors] = useState<PresenceState[]>([]);
  const callbackRef = useRef(onDocumentUpdate);
  callbackRef.current = onDocumentUpdate;

  useEffect(() => {
    if (!documentId || !userId) return;

    const supabase = createBrowserClient();

    const channel = supabase
      .channel(`document-${documentId}`)
      .on(
        'postgres_changes' as never,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          filter: `id=eq.${documentId}`,
        } as never,
        ((payload: { new: Record<string, unknown> }) => {
          callbackRef.current?.(payload.new);
        }) as never
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceState>();
        const editors = Object.values(state)
          .flat()
          .filter(p => p.userId !== userId);
        setActiveEditors(editors);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ userId });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [documentId, userId]);

  return { activeEditors };
}
