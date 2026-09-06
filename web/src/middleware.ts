import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { SESSION_COOKIE, verifySession } from '@/app/api/auth/_session';

/**
 * W1 middleware — Firebase + Rust backend session carrier.
 *
 * Contract (architecture review §5.1, middleware finding N/P1):
 * - NEVER trusts the unsigned legacy `user-session` cookie.
 * - Fails CLOSED for protected pages: missing/tampered/expired `pm_session`
 *   → redirect to /auth with a `next` return path.
 * - Public surfaces stay untouched: /auth pages, ALL /api/* routes (API auth
 *   is enforced server-side by the Rust backend — the middleware is a
 *   convenience gate only, per the reviewed topology), Next internals and
 *   static assets (excluded by the matcher below).
 * - No Supabase runtime dependency, no env-var fail-open branch.
 */

const PUBLIC_PREFIXES = ['/auth', '/api', '/_next'];
const PUBLIC_FILES = ['/favicon.ico', '/robots.txt', '/manifest.json'];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  if (PUBLIC_FILES.includes(pathname)) return true;
  // Static assets that slip past the matcher (fonts, icons, etc.).
  if (/\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|json|woff2?)$/.test(pathname)) {
    return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/auth', request.url);
  const target = `${pathname}${search}`;
  if (target && target !== '/auth') {
    loginUrl.searchParams.set('next', target);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
