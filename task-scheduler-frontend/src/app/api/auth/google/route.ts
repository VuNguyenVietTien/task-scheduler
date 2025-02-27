import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { token, user } = await request.json();

    if (!token || !user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 400 }
      );
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.uid,
        email: user.email,
        name: user.displayName || user.email?.split('@')[0],
        emailVerified: user.emailVerified
      }
    });

    // Set auth cookies
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    response.cookies.set('user-session', JSON.stringify({
      userId: user.uid,
      email: user.email,
      provider: 'google'
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    return response;
  } catch (error) {
    console.error('Google auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    );
  }
}
