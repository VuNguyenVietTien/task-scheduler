export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    // Clear auth-related cookies
    const cookieStore = cookies();
    cookieStore.delete('auth-token');
    cookieStore.delete('user-session');

    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });

    // Clear cookies in response
    response.cookies.delete('auth-token');
    response.cookies.delete('user-session');

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, error: 'Logout failed' },
      { status: 500 }
    );
  }
}
