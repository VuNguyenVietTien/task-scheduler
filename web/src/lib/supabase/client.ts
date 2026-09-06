/**
 * QUARANTINED (W1, 2026-08-31): active auth/session carrier is now the
 * Firebase ID token verified by the Rust backend — see
 * src/app/api/auth/_session.ts. This module remains only for not-yet-
 * migrated data routes (W2 scope) and MUST NOT gain new auth usage.
 * Browser bundle: anon key only; server bundle: service role is server-only.
 */

import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

let browserClient: ReturnType<typeof createSSRBrowserClient<Database>> | null = null;

/**
 * Singleton browser Supabase client for client components.
 * Uses anon key (public) — RLS enforced server-side.
 */
export function createBrowserClient() {
  if (browserClient) return browserClient;

  browserClient = createSSRBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return browserClient;
}
