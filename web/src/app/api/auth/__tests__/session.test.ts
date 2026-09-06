/**
 * W1 session-cookie unit tests (isomorphic HMAC sign/verify used by the edge
 * middleware and the auth API routes).
 *
 * jsdom does not expose Web Crypto, so polyfill from node:crypto before
 * importing the module under test.
 */

// @ts-expect-error - Node webcrypto polyfill for jsdom
if (!globalThis.crypto?.subtle) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  globalThis.crypto = require('crypto').webcrypto;
}

import {
  signSession,
  verifySession,
  backendUrl,
} from '../_session';

describe('pm_session sign/verify', () => {
  const OLD_ENV = process.env;
  const OLD_NODE_ENV = process.env.NODE_ENV;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.AUTH_SESSION_SECRET = 'unit-test-session-secret-0123456789';
  });

  afterEach(() => {
    process.env = OLD_ENV;
    process.env.NODE_ENV = OLD_NODE_ENV;
  });

  it('round-trips a valid session', async () => {
    const cookie = await signSession({ sub: 'uuid-1', email: 'a@b.c' });
    const payload = await verifySession(cookie);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe('uuid-1');
    expect(payload!.email).toBe('a@b.c');
    expect(payload!.exp).toBeGreaterThan(Date.now() / 1000);
  });

  it('rejects a tampered payload (signature mismatch)', async () => {
    const cookie = await signSession({ sub: 'uuid-1', email: 'a@b.c' });
    const [body, sig] = cookie.split('.');
    const tampered = `${body}x.${sig}`;
    expect(await verifySession(tampered)).toBeNull();
  });

  it('rejects an expired session', async () => {
    const cookie = await signSession({
      sub: 'uuid-1',
      email: 'a@b.c',
      ttlSeconds: -60,
    });
    expect(await verifySession(cookie)).toBeNull();
  });

  it('rejects garbage and missing values', async () => {
    expect(await verifySession('garbage')).toBeNull();
    expect(await verifySession('a.b')).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession('')).toBeNull();
  });

  it('resolves the Rust backend URL with the documented default', () => {
    delete process.env.NEXT_PUBLIC_BACKEND_URL;
    expect(backendUrl()).toBe('https://pm-api.khampha.dpdns.org');
    process.env.NEXT_PUBLIC_BACKEND_URL = 'http://localhost:8080/';
    expect(backendUrl()).toBe('http://localhost:8080');
  });
});
