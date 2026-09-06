export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import {
  SESSION_COOKIE,
  backendFetch,
  sessionCookieOptions,
  signSession,
} from '../_session';

/**
 * W1 compat Google bridge (consumed by `lib/googleAuth.ts`, which posts
 * `{token, user}`): forwards to the Rust `POST /api/v1/auth/firebase/login`
 * after mapping to its contract, and mints the signed `pm_session` cookie on
 * success. No Supabase anywhere on this path.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const token: string | undefined = body?.token;
    const user = body?.user;

    if (!token || !user?.email) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 });
    }

    const upstream = await backendFetch('/api/v1/auth/firebase/login', {
      method: 'POST',
      body: JSON.stringify({
        firebase_token: token,
        email: user.email,
        name: user.displayName || user.email.split('@')[0],
        firebase_uid: user.uid,
      }),
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok || !data?.success || !data?.user?.id) {
      return NextResponse.json(
        { error: data?.error || 'Google login failed' },
        { status: upstream.ok ? 502 : upstream.status },
      );
    }

    const response = NextResponse.json({ success: true, user: data.user });
    response.cookies.set(
      SESSION_COOKIE,
      await signSession({ sub: data.user.id, email: data.user.email }),
      sessionCookieOptions(),
    );
    return response;
  } catch (error) {
    console.error('[api/auth/google] error:', error);
    return NextResponse.json({ error: 'Google login failed' }, { status: 500 });
  }
}
