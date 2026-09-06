/**
 * QUARANTINED (W1, 2026-08-31): active auth/session carrier is now the
 * Firebase ID token verified by the Rust backend — see
 * src/app/api/auth/_session.ts. This module remains only for not-yet-
 * migrated data routes (W2 scope) and MUST NOT gain new auth usage.
 * Browser bundle: anon key only; server bundle: service role is server-only.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refresh Supabase session in Next.js middleware.
 * Returns updated response with refreshed cookies + user object.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { user, supabaseResponse };
}
