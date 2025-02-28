import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Firebase token is required' },
        { status: 400 }
      );
    }

    // Call backend API to verify token and create/update user
    const response = await fetch(`${process.env.BACKEND_URL}/api/auth/firebase/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ firebase_token: token }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.message || 'Authentication failed' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Set auth token in HTTP-only cookie
    cookies().set('auth_token', data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return NextResponse.json({ message: 'Authentication successful' });
  } catch (error) {
    console.error('Firebase login error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}