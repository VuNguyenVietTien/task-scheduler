import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export async function POST(request: Request) {
  try {
    console.log('[Firebase API] Starting login process');
    const { firebase_token, email, name, firebase_uid } = await request.json();
    console.log('[Firebase API] Received request:', { email, firebase_uid });

    if (!firebase_token || !email || !firebase_uid) {
      console.error('[Firebase API] Missing required fields');
      return NextResponse.json(
        { error: 'Firebase token, email, and uid are required' },
        { status: 400 }
      );
    }

    // Call backend API to verify token and create/update user
    console.log(`[Firebase API] Calling backend service at ${BACKEND_URL}/api/v1/auth/firebase/login`);
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/auth/firebase/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          firebase_token,
          email,
          name: name || 'Unnamed User',
          firebase_uid
        }),
      });

      const responseText = await response.text();
      console.log('[Firebase API] Backend raw response:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('[Firebase API] Failed to parse backend response as JSON');
        throw new Error('Invalid response from backend');
      }

      if (!response.ok) {
        console.error('[Firebase API] Backend error:', data);
        return NextResponse.json(
          { error: data.message || 'Authentication failed' },
          { status: response.status }
        );
      }

      console.log('[Firebase API] Backend authentication successful:', {
        userId: data.user?.id,
        email: data.user?.email
      });

      // Set auth token cookie
      cookies().set('auth-token', data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 1 week
      });

      // Set session cookie
      cookies().set('user-session', JSON.stringify({
        userId: data.user.id,
        email: data.user.email,
        provider: 'firebase'
      }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 1 week
      });

      console.log('[Firebase API] Cookies set successfully');

      return NextResponse.json({
        success: true,
        user: data.user
      });

    } catch (error) {
      console.error('[Firebase API] Backend request failed:', error);
      throw error;
    }
  } catch (error) {
    console.error('[Firebase API] Error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
