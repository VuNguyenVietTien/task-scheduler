/**
 * QUARANTINED (W1, 2026-08-31): active auth/session carrier is now the
 * Firebase ID token verified by the Rust backend — see
 * src/app/api/auth/_session.ts. This module remains only for not-yet-
 * migrated data routes (W2 scope) and MUST NOT gain new auth usage.
 * Browser bundle: anon key only; server bundle: service role is server-only.
 */

import { createServerClient as createSSRServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';

/**
 * Create a Supabase client for server-side operations (API routes, RSC).
 * Uses user's session cookies for RLS-scoped queries.
 */
export async function createServerClient() {
  const cookieStore = await cookies();

  return createSSRServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from Server Component — safe to ignore
          }
        },
      },
    }
  );
}

/**
 * Create a Supabase admin client that bypasses RLS.
 * Uses service role key — NEVER expose to client.
 */
export function createAdminClient() {
  return createSSRServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
