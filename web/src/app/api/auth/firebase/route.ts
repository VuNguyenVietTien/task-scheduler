export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

/**
 * Legacy Firebase→Supabase bridge — RETIRED by W1.
 *
 * Supabase is no longer the session carrier or user store for auth. Use
 * `POST /api/auth/firebase/login`, which verifies the Firebase ID token on the
 * Rust backend and upserts the app `users` row there.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Deprecated: use POST /api/auth/firebase/login (Rust backend)',
    },
    { status: 410 },
  );
}
