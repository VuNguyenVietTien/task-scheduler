export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import {
  SESSION_COOKIE,
  backendFetch,
  sessionCookieOptions,
  signSession,
} from '../../_session';

/**
 * W1 login/bootstrap: verify the Firebase ID token and create/sign-in the app
 * user on the RUST backend (`POST /api/v1/auth/firebase/login`), then mint the
 * signed `pm_session` cookie for the edge middleware.
 *
 * The Firebase token is verified by Rust (signature/audience/issuer + UID and
 * email claim match) — this proxy adds no auth logic of its own and touches no
 * Supabase client. The Rust response's `session` (legacy Supabase magic-link
 * payload) is intentionally dropped: the new carrier is Bearer-only.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const { firebase_token, email, name, firebase_uid } = body ?? {};

    if (!firebase_token || !email || !firebase_uid) {
      return NextResponse.json(
        { error: 'Firebase token, email, and uid are required' },
        { status: 400 },
      );
    }

    const upstream = await backendFetch('/api/v1/auth/firebase/login', {
      method: 'POST',
      body: JSON.stringify({ firebase_token, email, name, firebase_uid }),
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok || !data?.success || !data?.user?.id) {
      return NextResponse.json(
        { error: data?.error || 'Backend login failed' },
        { status: upstream.status === 403 ? 403 : upstream.ok ? 502 : upstream.status },
      );
    }

    const response = NextResponse.json({
      success: true,
      user: data.user,
    });

    response.cookies.set(
      SESSION_COOKIE,
      await signSession({ sub: data.user.id, email: data.user.email }),
      sessionCookieOptions(),
    );
    return response;
  } catch (error) {
    console.error('[api/auth/firebase/login] error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
