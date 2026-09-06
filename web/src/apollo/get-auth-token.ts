/**
 * Shared auth-token fetcher backed by the Firebase SDK (W2 fix, 2026-09-01).
 *
 * Replaces the legacy `/api/auth/get-token` cookie round-trip: the bearer is
 * now read directly from the Firebase JS SDK via the existing `getIdToken()`
 * helper in `src/lib/firebase.ts`, which resolves the SDK's current user
 * (waiting for the initial auth state) and returns `user.getIdToken()`.
 * The SDK itself serves the cached ID token and force-refreshes it when it
 * considers it stale (Firebase ID tokens live ~1 hour and are auto-refreshed),
 * so SDK refresh semantics are authoritative end to end.
 *
 * Deliberately NO custom TTL cache (the old 10-minute cache could serve a
 * token that outlived the SDK identity — e.g. for up to 10 minutes after
 * sign-out, or past an SDK-side refresh/revocation). Each non-concurrent
 * call goes straight back to the SDK, which returns its cached token when
 * still valid, so there is no extra network cost.
 *
 * Concurrency: a burst of concurrent callers shares one in-flight promise
 * (dedupe), so at most one SDK token resolution runs at a time; once it
 * settles, the next call re-queries the SDK.
 *
 * Logged-out behavior: "no Firebase user" is a normal state (including
 * unconfigured deployments, where the helper resolves null immediately) —
 * this returns null quietly. Only genuinely unexpected SDK failures are
 * logged. The Apollo auth link then forwards the request without an
 * Authorization header.
 */

import { getIdToken } from '../lib/firebase';

let inFlight: Promise<string | null> | null = null;

export async function getAuthToken(): Promise<string | null> {
  if (!inFlight) {
    inFlight = (async () => {
      try {
        // Firebase SDK user token — cached/refreshed by the SDK itself.
        return await getIdToken();
      } catch (error) {
        // Logged-out resolves null above; only real SDK errors land here.
        console.error('[getAuthToken] Firebase getIdToken failed:', error);
        return null;
      } finally {
        inFlight = null;
      }
    })();
  }
  return inFlight;
}
