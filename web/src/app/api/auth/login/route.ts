export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import { backendFetch } from '../_session';

/**
 * W1 compat login (legacy REST shape `{email, password}` → `{user_id, email,
 * name}`): thin forward to the Rust backend `POST /api/v1/auth/login`.
 * No Supabase `signInWithPassword` — credentials are verified by Rust.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const { email, password } = body ?? {};

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 },
      );
    }

    const upstream = await backendFetch('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    console.error('[api/auth/login] error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
