/**
 * Shared auth-session helpers for W1 (Firebase + Rust backend migration).
 *
 * Used by BOTH the edge middleware (src/middleware.ts) and the Node API
 * routes (src/app/api/auth/**), so it must stay isomorphic:
 * - Web Crypto (globalThis.crypto.subtle) only — available in Next.js edge
 *   runtime, Node 18+, and modern browsers. No node:crypto imports here.
 * - btoa/atob for base64url (edge-safe).
 *
 * Security model:
 * - The browser session carrier is the Firebase ID token (Bearer, short-lived,
 *   refreshed by the Firebase SDK). Rust verifies it and owns identity.
 * - `pm_session` is a SERVER-set, HttpOnly, HMAC-SHA256-signed cookie whose
 *   ONLY job is letting the edge middleware fail closed for protected routes
 *   without trusting unsigned data. It is never an identity assertion for data
 *   access — /api/auth/me always re-verifies the Bearer token against Rust.
 * - No Supabase client, no service-role key, nothing secret in the browser.
 */

export const SESSION_COOKIE = 'pm_session';
/** Legacy Rust-issued cookies, cleared on logout for hygiene. */
export const LEGACY_COOKIES = ['auth-token', 'user-session'] as const;

const DEV_FALLBACK_SECRET = 'dev-only-insecure-pm-session-secret';
const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24h; identity re-verified via /me

export interface SessionPayload {
  /** App users.user_id from the Rust backend. */
  sub: string;
  email: string;
  /** Unix seconds. */
  exp: number;
}

export function backendUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_BACKEND_URL || 'https://pm-api.khampha.dpdns.org';
  return raw.replace(/\/+$/, '');
}

function sessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === 'production' && !secret) {
    // Fail closed at signing time: never mint sessions under a guessable key.
    throw new Error('AUTH_SESSION_SECRET must be set in production');
  }
  return DEV_FALLBACK_SECRET;
}

/* ---------------------------------- base64url ---------------------------------- */

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/* ----------------------------------- hmac -------------------------------------- */

async function hmac(message: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto (crypto.subtle) unavailable');
  const key = await subtle.importKey(
    'raw',
    new TextEncoder().encode(sessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message),
  );
  return toBase64Url(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ------------------------------- sign / verify --------------------------------- */

export async function signSession(
  payload: Omit<SessionPayload, 'exp'> & { ttlSeconds?: number },
): Promise<string> {
  const full: SessionPayload = {
    ...payload,
    exp:
      Math.floor(Date.now() / 1000) +
      (payload.ttlSeconds ?? SESSION_TTL_SECONDS),
  };
  const body = toBase64Url(
    new TextEncoder().encode(JSON.stringify(full)),
  );
  const sig = await hmac(body);
  return `${body}.${sig}`;
}

export async function verifySession(
  cookie: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!cookie) return null;
  const dot = cookie.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  let expected: string;
  try {
    expected = await hmac(body);
  } catch {
    return null;
  }
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(body)),
    ) as SessionPayload;
    if (
      typeof payload.exp !== 'number' ||
      payload.exp * 1000 <= Date.now() ||
      !payload.sub
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/* ------------------------------ backend forward -------------------------------- */

/**
 * Thin forward to the Rust backend. Credentials/cookies from the browser are
 * never forwarded — the caller supplies an explicit Bearer token when it has
 * one (Firebase ID token), which Rust verifies cryptographically.
 */
export async function backendFetch(
  path: string,
  init: RequestInit & { bearer?: string } = {},
): Promise<Response> {
  const { bearer, headers, ...rest } = init;
  return fetch(`${backendUrl()}${path}`, {
    ...rest,
    headers: {
      ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...headers,
    },
    cache: 'no-store',
  });
}

export function sessionCookieOptions(maxAgeSeconds = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
