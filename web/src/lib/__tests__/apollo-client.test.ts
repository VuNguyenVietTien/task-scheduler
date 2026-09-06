/**
 * W2 transport tests (updated 2026-09-01: Firebase SDK bearer source).
 *
 * Integration-focused: only `src/lib/firebase` is mocked; the REAL
 * get-auth-token helper and the REAL Apollo client/link chain run.
 *
 *   1. http link URI resolves to the Rust backend default (+ /graphql),
 *      with safe trailing-slash trimming;
 *   2. fresh authenticated Firebase state (getIdToken resolves a token)
 *      -> Apollo sends `Authorization: Bearer <token>` to the Rust endpoint,
 *      cross-origin, cookies omitted;
 *   3. logged-out Firebase state (getIdToken resolves null)
 *      -> request still sent WITHOUT Authorization and WITHOUT noisy
 *         false console errors;
 *   4. helper semantics: concurrent-request dedupe, and NO custom TTL cache
 *      (SDK identity changes — e.g. sign-out — are reflected on the next
 *      call; refresh/validity is owned by the SDK).
 *
 * Uses only relative imports so it runs under both jest.config.js and
 * jest.config.mjs.
 */

jest.mock('../../lib/firebase', () => ({
  getIdToken: jest.fn(),
}));

import { gql } from '@apollo/client';
import { getIdToken } from '../../lib/firebase';
import { getAuthToken } from '../../apollo/get-auth-token';
import { BACKEND_GRAPHQL_URL, client } from '../apollo-client';

const ORIGINAL_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

function freshBackendUrl(): string {
  let url: string | undefined;
  jest.isolateModules(() => {
    url = require('../apollo-client').BACKEND_GRAPHQL_URL;
  });
  return url as string;
}

function graphQlFetchMock(payload: Record<string, unknown>) {
  return jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: () => null },
    text: async () => JSON.stringify(payload),
  });
}

function headerValue(init: RequestInit | undefined, name: string): string | null {
  if (!init || !init.headers) return null;
  const headers = new Headers(init.headers as HeadersInit);
  return headers.get(name);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

afterEach(() => {
  if (ORIGINAL_BACKEND_URL === undefined) {
    delete process.env.NEXT_PUBLIC_BACKEND_URL;
  } else {
    process.env.NEXT_PUBLIC_BACKEND_URL = ORIGINAL_BACKEND_URL;
  }
  (getIdToken as jest.Mock).mockReset();
  jest.restoreAllMocks();
});

describe('BACKEND_GRAPHQL_URL (W2 transport switch)', () => {
  it('defaults to the production Rust API origin plus /graphql when NEXT_PUBLIC_BACKEND_URL is unset', () => {
    delete process.env.NEXT_PUBLIC_BACKEND_URL;
    expect(freshBackendUrl()).toBe('https://pm-api.khampha.dpdns.org/graphql');
  });

  it('appends /graphql to NEXT_PUBLIC_BACKEND_URL and trims trailing slashes', () => {
    process.env.NEXT_PUBLIC_BACKEND_URL = 'https://api.example.com///';
    expect(freshBackendUrl()).toBe('https://api.example.com/graphql');
  });
});

describe('auth link integration (Firebase SDK -> Bearer header)', () => {
  it('fresh authenticated Firebase state: sends the SDK ID token as Bearer to the Rust endpoint without cookies', async () => {
    (getIdToken as jest.Mock).mockResolvedValue('firebase-id-token-123');
    const fetchMock = graphQlFetchMock({ data: { ping: true } });
    jest.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as unknown as typeof fetch);

    const result = await client.query({ query: gql`query W2TransportPing { ping }` });

    expect(result.data).toEqual({ ping: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [uri, init] = fetchMock.mock.calls[0];
    expect(String(uri)).toBe(BACKEND_GRAPHQL_URL);
    expect(headerValue(init as RequestInit, 'authorization')).toBe('Bearer firebase-id-token-123');
    expect((init as RequestInit).credentials).toBe('omit');
  });

  it('logged-out Firebase state: sends the request WITHOUT Authorization and without noisy false errors', async () => {
    (getIdToken as jest.Mock).mockResolvedValue(null); // no Firebase user
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchMock = graphQlFetchMock({ data: { ping: true } });
    jest.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as unknown as typeof fetch);

    const result = await client.query({ query: gql`query W2TransportNoToken { ping }` });

    expect(result.data).toEqual({ ping: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(headerValue(fetchMock.mock.calls[0][1] as RequestInit, 'authorization')).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('getAuthToken helper semantics (SDK-backed, no custom cache)', () => {
  it('dedupes concurrent requests into a single Firebase getIdToken call', async () => {
    const d = deferred<string | null>();
    (getIdToken as jest.Mock).mockReturnValueOnce(d.promise);

    const first = getAuthToken();
    const second = getAuthToken();
    d.resolve('token-burst');

    await expect(first).resolves.toBe('token-burst');
    await expect(second).resolves.toBe('token-burst');
    expect(getIdToken).toHaveBeenCalledTimes(1);
  });

  it('does not serve a stale custom cache: sign-out is reflected on the very next call', async () => {
    (getIdToken as jest.Mock).mockResolvedValueOnce('token-before-signout');
    expect(await getAuthToken()).toBe('token-before-signout');

    // Old implementation kept a 10-minute TTL cache and would still return
    // 'token-before-signout' here. The SDK is now re-queried every burst.
    (getIdToken as jest.Mock).mockResolvedValueOnce(null);
    expect(await getAuthToken()).toBeNull();
    expect(getIdToken).toHaveBeenCalledTimes(2);
  });

  it('logged-out resolves null quietly (production path has no false-error noise)', async () => {
    (getIdToken as jest.Mock).mockResolvedValue(null);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(getAuthToken()).resolves.toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('a genuine SDK failure resolves null and is logged once', async () => {
    (getIdToken as jest.Mock).mockRejectedValue(new Error('network down'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(getAuthToken()).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(1);

    // In-flight slot is released even after failure.
    (getIdToken as jest.Mock).mockResolvedValueOnce('token-recovered');
    await expect(getAuthToken()).resolves.toBe('token-recovered');
  });
});
