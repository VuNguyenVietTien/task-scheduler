import { updateSession } from '@/lib/supabase/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = [
  '/auth',
  '/api/auth',
  '/_next',
  '/favicon.ico',
];

export async function middleware(request: NextRequest) {
  // Allow public paths without auth
  if (publicPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Guard: if Supabase env vars not set, skip auth check
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next();
  }

  try {
    // Refresh Supabase session and check auth
    const { user, supabaseResponse } = await updateSession(request);

    if (!user) {
      // Fallback: accept custom auth cookies from Firebase/Google login
      const authToken = request.cookies.get('auth-token');
      const userSession = request.cookies.get('user-session');
      if (authToken && userSession) {
        return NextResponse.next();
      }

      const redirectUrl = new URL('/auth', request.url);
      return NextResponse.redirect(redirectUrl);
    }

    return supabaseResponse;
  } catch {
    // If Supabase middleware fails, allow request through
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
