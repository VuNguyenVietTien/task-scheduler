import { NextResponse } from 'next/server';
import { config } from '@/lib/config';

export async function POST(request: Request) {
  try {
    console.log('[API] Starting Google auth process');
    const data = await request.json();
    console.log('[API] Received data from client:', {
      token: data.token ? `${data.token.substring(0, 10)}...` : null,
      user: data.user ? {
        uid: data.user.uid,
        email: data.user.email,
        displayName: data.user.displayName
      } : null
    });

    if (!data.token || !data.user) {
      console.error('[API] Missing required fields');
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 400 }
      );
    }

    // Forward to Firebase login endpoint
    const backendUrl = `${config.backendUrl}/api/auth/firebase/login`;
    console.log(`[API] Calling backend at ${backendUrl}`);
    
    const requestBody = {
      firebase_token: data.token,
      email: data.user.email,
      name: data.user.displayName || data.user.email?.split('@')[0],
      firebase_uid: data.user.uid
    };
    console.log('[API] Request body:', requestBody);

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('[API] Backend raw response:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
      console.log('[API] Parsed response data:', responseData);
    } catch (e) {
      console.error('[API] Failed to parse backend response:', e);
      throw new Error('Invalid response from backend');
    }

    if (!response.ok) {
      console.error('[API] Backend error:', responseData);
      return NextResponse.json(
        { error: responseData.error || 'Authentication failed' },
        { status: response.status }
      );
    }

    console.log('[API] Backend authentication successful:', {
      userId: responseData.user?.id,
      email: responseData.user?.email
    });

    const result = NextResponse.json({
      success: true,
      ...responseData
    });

    // Copy auth token from backend to cookie
    if (responseData.token) {
      result.cookies.set('auth-token', responseData.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 1 week
      });
    }

    // Set session cookie
    result.cookies.set('user-session', JSON.stringify({
      userId: responseData.user.id,
      email: responseData.user.email,
      provider: 'google'
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    console.log('[API] Cookies set successfully');
    return result;

  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
