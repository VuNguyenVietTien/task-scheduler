export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import { backendFetch } from '../_session';

/**
 * W1 refresh: forwards the client's Firebase ID token (Bearer) to the Rust
 * backend `POST /api/v1/auth/refresh`. Rust verifies it (verified email
 * required) and returns a freshly minted app token under every key spelling
 * the legacy consumers read (`token`, `access_token`, `accessToken`).
 */
export async function POST(request: NextRequest) {
  const bearer =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;

  if (!bearer) {
    return NextResponse.json(
      { error: 'Missing bearer token' },
      { status: 401 },
    );
  }

  try {
    const upstream = await backendFetch('/api/v1/auth/refresh', {
      method: 'POST',
      bearer,
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    console.error('[api/auth/refresh] error:', error);
    return NextResponse.json({ error: 'Refresh failed' }, { status: 502 });
  }
}
