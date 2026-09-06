export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import { LEGACY_COOKIES, SESSION_COOKIE, backendFetch } from '../_session';

/**
 * W1 logout: clears the signed `pm_session` cookie (and the legacy Rust
 * cookies for hygiene), then best-effort notifies the Rust backend. Client
 * Firebase sign-out happens in AuthContext.
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });

  response.cookies.delete(SESSION_COOKIE);
  for (const name of LEGACY_COOKIES) {
    response.cookies.delete(name);
  }

  const bearer =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;
  if (bearer) {
    try {
      await backendFetch('/api/v1/auth/logout', { method: 'POST', bearer });
    } catch {
      // Best-effort: local session is already cleared.
    }
  }

  return response;
}
