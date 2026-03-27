export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const COOKIE_OPTIONS = {
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 // 24 hours
};

export async function POST(request: NextRequest) {
  try {
    console.log('[/api/auth/set-cookie] Starting to set cookie...');
    
    const { token } = await request.json();
    
    if (!token) {
      console.error('[/api/auth/set-cookie] No token provided');
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    console.log('[/api/auth/set-cookie] Setting cookie with options:', {
      ...COOKIE_OPTIONS,
      tokenLength: token.length
    });

    const response = NextResponse.json({ success: true });
    
    // Set the cookie
    response.cookies.set('auth-token', token, COOKIE_OPTIONS);

    // Verify cookie was set
    const setCookieHeader = response.headers.get('Set-Cookie');
    console.log('[/api/auth/set-cookie] Set-Cookie header:', setCookieHeader);

    return response;
  } catch (error) {
    console.error('[/api/auth/set-cookie] Error:', error);
    return NextResponse.json(
      { error: 'Failed to set cookie' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token');
    console.log('[/api/auth/set-cookie] Current cookie:', token?.value || 'Not found');
    
    return NextResponse.json({
      success: true,
      hasToken: !!token
    });
  } catch (error) {
    console.error('[/api/auth/set-cookie] Error checking cookie:', error);
    return NextResponse.json(
      { error: 'Failed to check cookie' },
      { status: 500 }
    );
  }
}