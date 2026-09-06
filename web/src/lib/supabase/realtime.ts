/**
 * QUARANTINED (W1, 2026-08-31): active auth/session carrier is now the
 * Firebase ID token verified by the Rust backend — see
 * src/app/api/auth/_session.ts. This module remains only for not-yet-
 * migrated data routes (W2 scope) and MUST NOT gain new auth usage.
 * Browser bundle: anon key only; server bundle: service role is server-only.
 */

import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

/**
 * Create a typed Postgres Changes channel for a specific table.
 */
export function createTableChannel(
  supabase: SupabaseClient,
  channelName: string,
  table: string,
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
  filter?: string,
  callback?: (payload: Record<string, unknown>) => void
): RealtimeChannel {
  const channelConfig: Record<string, unknown> = {
    event,
    schema: 'public',
    table,
  };

  if (filter) {
    channelConfig.filter = filter;
  }

  return supabase
    .channel(channelName)
    .on(
      'postgres_changes' as never,
      channelConfig as never,
      callback as never
    );
}

/**
 * Create a broadcast channel for custom events (e.g., design doc collaboration).
 */
export function createBroadcastChannel(
  supabase: SupabaseClient,
  channelName: string,
  eventName: string,
  callback: (payload: Record<string, unknown>) => void
): RealtimeChannel {
  return supabase
    .channel(channelName)
    .on('broadcast' as never, { event: eventName } as never, callback as never);
}
