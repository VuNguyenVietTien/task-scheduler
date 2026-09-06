export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import { backendFetch } from '../_session';

/**
 * W1 register: thin forward to the Rust backend `POST /api/v1/auth/register`
 * ({email, password, name}). Password credential creation lives on the
 * identity/backend side — no Supabase admin client, no service-role key.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const { email, password, name } = body ?? {};

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password and name are required' },
        { status: 400 },
      );
    }

    const upstream = await backendFetch('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    console.error('[api/auth/register] error:', error);
    return NextResponse.json(
      { success: false, error: 'Registration failed' },
      { status: 500 },
    );
  }
}
