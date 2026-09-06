export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import { backendFetch } from '../_session';

/**
 * W1 session check: forwards the client's Bearer token (Firebase ID token from
 * the SDK) to the Rust backend `GET /api/v1/auth/me`, which verifies it
 * cryptographically and returns a fresh `users` row.
 *
 * The legacy unsigned `user-session` cookie is deliberately NOT consulted —
 * cookies alone are never an identity assertion in this architecture.
 */
export async function GET(request: NextRequest) {
  const bearer =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;

  if (!bearer) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  try {
    const upstream = await backendFetch('/api/v1/auth/me', {
      method: 'GET',
      bearer,
    });

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    console.error('[api/auth/me] error:', error);
    return NextResponse.json({ user: null }, { status: 502 });
  }
}
