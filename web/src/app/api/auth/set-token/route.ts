export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    console.log('[Set Token API] Setting auth token cookie');

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    };

    // Set auth token cookie
    cookies().set('auth-token', token, cookieOptions);

    // Set session cookie with minimal user data
    cookies().set('user-session', JSON.stringify({
      loggedIn: true,
      timestamp: new Date().toISOString()
    }), cookieOptions);

    console.log('[Set Token API] Cookies set successfully');

    // Create response with cookie headers
    const response = NextResponse.json({ success: true });

    // Add cookie headers as backup
    const authCookie = `auth-token=${token}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
    const sessionCookie = `user-session=${JSON.stringify({
      loggedIn: true,
      timestamp: new Date().toISOString()
    })}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;

    response.headers.set('Set-Cookie', authCookie);
    response.headers.append('Set-Cookie', sessionCookie);

    return response;

  } catch (error) {
    console.error('[Set Token API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to set auth token' },
      { status: 500 }
    );
  }
}