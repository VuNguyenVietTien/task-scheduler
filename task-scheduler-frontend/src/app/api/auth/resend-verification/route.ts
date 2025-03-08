import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    console.log('[/api/auth/resend-verification] Processing request');

    // Get token from cookie
    const cookieStore = cookies();
    const token = cookieStore.get('token');

    if (!token) {
      console.error('[/api/auth/resend-verification] No token found');
      return NextResponse.json({ 
        error: 'Unauthorized - Please log in again' 
      }, { 
        status: 401 
      });
    }

    console.log('[/api/auth/resend-verification] Requesting verification email');

    // Call backend to resend verification email
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/resend-verification`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.value}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('[/api/auth/resend-verification] Backend request failed:', response.status);
      
      // Handle unauthorized error
      if (response.status === 401) {
        const errorResponse = NextResponse.json(
          { error: 'Unauthorized - Please log in again' },
          { status: 401 }
        );
        errorResponse.cookies.delete('token');
        return errorResponse;
      }

      // Handle other errors
      const error = await response.json();
      return NextResponse.json(
        { error: error.message || 'Failed to resend verification email' },
        { status: response.status }
      );
    }

    console.log('[/api/auth/resend-verification] Verification email sent successfully');

    return NextResponse.json({
      message: 'Verification email sent successfully'
    });

  } catch (error) {
    console.error('[/api/auth/resend-verification] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also handle GET request to check verification status
export async function GET(request: NextRequest) {
  try {
    console.log('[/api/auth/resend-verification] Checking verification status');

    // Get token from cookie
    const cookieStore = cookies();
    const token = cookieStore.get('token');

    if (!token) {
      console.error('[/api/auth/resend-verification] No token found');
      return NextResponse.json({ 
        error: 'Unauthorized - Please log in again' 
      }, { 
        status: 401 
      });
    }

    // Call backend to check verification status
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/me`,
      {
        headers: {
          'Authorization': `Bearer ${token.value}`,
        },
      }
    );

    if (!response.ok) {
      console.error('[/api/auth/resend-verification] Backend request failed:', response.status);
      
      if (response.status === 401) {
        const errorResponse = NextResponse.json(
          { error: 'Unauthorized - Please log in again' },
          { status: 401 }
        );
        errorResponse.cookies.delete('token');
        return errorResponse;
      }

      return NextResponse.json(
        { error: 'Failed to check verification status' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[/api/auth/resend-verification] Verification status:', {
      userId: data.user.id,
      email: data.user.email,
      isVerified: data.user.emailVerified
    });

    return NextResponse.json({
      verified: data.user.emailVerified,
      email: data.user.email
    });

  } catch (error) {
    console.error('[/api/auth/resend-verification] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}