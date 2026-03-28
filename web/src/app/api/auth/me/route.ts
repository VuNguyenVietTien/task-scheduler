export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = cookies();
    const authToken = cookieStore.get('auth-token');
    const userSession = cookieStore.get('user-session');

    if (!authToken || !userSession) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    try {
      // Parse the user session cookie
      const sessionData = JSON.parse(userSession.value);

      // In a real app, you would:
      // 1. Verify the JWT token
      // 2. Fetch fresh user data from database
      // 3. Check token expiration

      const user = {
        id: sessionData.userId,
        email: sessionData.email,
        name: sessionData.name || sessionData.email.split('@')[0],
        emailVerified: true
      };

      return NextResponse.json({ user });
    } catch (parseError) {
      console.error('Failed to parse user session:', parseError);
      // Clear invalid cookies
      cookieStore.delete('auth-token');
      cookieStore.delete('user-session');
      return NextResponse.json({ user: null }, { status: 401 });
    }
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { 
        user: null,
        error: 'Authentication check failed'
      }, 
      { status: 500 }
    );
  }
}
