import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // In a real app, you would:
    // 1. Validate credentials against database
    // 2. Hash password comparison
    // 3. Create JWT or session token
    // 4. Store session info

    // Mock successful authentication
    const mockUser = {
      id: '1',
      email,
      name: 'Test User',
      emailVerified: true
    };

    const mockToken = 'mock-jwt-token';
    
    const response = NextResponse.json({
      success: true,
      user: mockUser
    });

    // Set auth cookies
    response.cookies.set('auth-token', mockToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    response.cookies.set('user-session', JSON.stringify({
      userId: mockUser.id,
      email: mockUser.email
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Invalid credentials',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 401 }
    );
  }
}
