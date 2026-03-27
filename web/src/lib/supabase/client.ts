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
