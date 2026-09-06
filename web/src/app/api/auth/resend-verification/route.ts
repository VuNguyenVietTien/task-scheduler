export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import { backendFetch } from '../_session';

/**
 * W1 resend-verification: forwards the client's Bearer token (Firebase ID
 * token) to the Rust backend `POST /api/v1/auth/resend-verification`, which
 * returns `{ user: { id, email, emailVerified } }` — the shape consumed by
 * `useVerification`.
 */
export async function POST(request: NextRequest) {
  const bearer =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;

  if (!bearer) {
    return NextResponse.json(
      { error: 'Unauthorized - Please log in again' },
      { status: 401 },
    );
  }

  try {
    const upstream = await backendFetch('/api/v1/auth/resend-verification', {
      method: 'POST',
      bearer,
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    console.error('[api/auth/resend-verification] error:', error);
    return NextResponse.json({ error: 'Failed to resend verification' }, { status: 502 });
  }
}
