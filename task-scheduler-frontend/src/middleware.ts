import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Define paths that don't require authentication
const publicPaths = [
  '/auth',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/firebase/login',
  '/api/auth/me',
  '/_next',
  '/favicon.ico'
];

export function middleware(request: NextRequest) {
  // Check if the path is public
  if (publicPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for auth token
  const authToken = request.cookies.get('auth-token');
  const userSession = request.cookies.get('user-session');

  console.log('[Middleware] Checking auth:', {
    path: request.nextUrl.pathname,
    hasAuthToken: !!authToken,
    hasUserSession: !!userSession
  });

  if (!authToken || !userSession) {
    console.log('[Middleware] Missing required cookies:', 
      !authToken ? 'auth-token' : 'user-session');
    // Redirect to login if no auth token is present
    const redirectUrl = new URL('/auth', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  try {
    // Validate session
    const session = JSON.parse(userSession.value);
    console.log('[Middleware] Valid user session:', session);
    return NextResponse.next();
  } catch (error) {
    const err = error as Error;
    console.error('[Middleware] Invalid user session - Error:', err.message);

    // Invalid session, redirect to login
    const response = NextResponse.redirect(new URL('/auth', request.url));
    
    // Clear invalid cookies
    response.cookies.delete('auth-token');
    response.cookies.delete('user-session');
    
    return response;
  }
}

// Configure paths that should be matched by the middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * 1. /api/auth/** (auth endpoints)
     * 2. /_next/** (Next.js internals)
     * 3. /favicon.ico, /site.webmanifest, etc.
     */
    '/((?!api/auth/|_next/|favicon.ico).*)',
  ],
}
