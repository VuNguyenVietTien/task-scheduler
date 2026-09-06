# PM Independent Final Review — Frontend W2 Token-Source Rework

**Verdict: ACCEPT**
**Date:** 2026-09-01
**Mode:** independent read-only review. Read only the scoped files (`web/src/apollo/get-auth-token.ts`, `web/src/lib/apollo-client.ts`, `web/src/lib/firebase.ts`, `web/src/lib/__tests__/apollo-client.test.ts`, adjacent consumers `web/src/apollo/client.ts` / `web/src/apollo/design-doc-client.ts` via grep, plus the two prior reports). No source edits, no installs, no commit/push/deploy/delete. Jest ran via an inline temp config (repo configs are pre-existing broken; workaround documented below).

## Prior blocker (herdr-260831-frontend-w2-review.md F1)

The active Apollo client's bearer came from the legacy `GET /api/auth/get-token` route (stale `auth-token` cookie no longer issued by W1 Firebase login), so fresh-login requests went out unauthenticated; the old test masked this by mocking `getAuthToken` itself.

## Acceptance verification

### A1 — Main Apollo requests after fresh Firebase login obtain the current SDK ID token — VERIFIED

- `lib/apollo-client.ts` authMiddleware (browser-gated) → real `getAuthToken()` → `lib/firebase.ts` `getIdToken()` → `getCurrentUser()` (waits for the SDK's initial auth state via `onAuthStateChanged`) → `user.getIdToken()`. This is the live Firebase SDK session that W1 login (`signInWithGoogle`/`signInWithEmailAndPassword`) establishes; the legacy cookie round-trip is gone from the module entirely.
- Integration test runs the **real** helper and **real** `client`/link chain (only `src/lib/firebase` mocked, `globalThis.fetch` spied): authenticated state → request to `BACKEND_GRAPHQL_URL` with `Authorization: Bearer firebase-id-token-123`, `credentials: 'omit'` — passed in my rerun.
- Both other transports (`apollo/client.ts`, `apollo/design-doc-client.ts`) import the same helper, so all active transports inherit the fix (grep-confirmed; no other token source remains).

### A2 — Native SDK refresh/identity-change not defeated by stale custom cache — VERIFIED

- No TTL cache remains in `get-auth-token.ts`; every non-concurrent burst re-queries the SDK, so `user.getIdToken()` semantics (SDK-cached token, force-refresh when stale) are authoritative; sign-out/identity change is visible on the very next call.
- Test "does not serve a stale custom cache" pins this: token → null on consecutive calls with `getIdToken` called twice (old 10-min cache would have failed this).

### A3 — Concurrent dedupe releases on success/failure — VERIFIED

- Single `inFlight` promise shared by concurrent callers; `finally { inFlight = null; }` clears the slot on both success and caught failure. Tests: burst deduped into exactly ONE `getIdToken` call with both callers sharing the result; genuine SDK failure → resolves null → next call recovers (`token-recovered`), proving the slot was released after failure. Assignment of `inFlight` is synchronous within the IIFE invocation, so no dedupe race window exists.

### A4 — Logged-out request: no Bearer, no false noise — VERIFIED

- `getIdToken()` → null (no user, or unconfigured deployment where `getFirebaseAuth()` → null) propagates as null; the link sets only `Content-Type` and forwards without `Authorization`. No `console.error` on the null path (only genuine SDK rejections are logged, once).
- Integration test asserts header is null AND `console.error` NOT called, through the real link chain; helper-level quiet-null test also passes.

### A5 — Tests exercise real getAuthToken + Apollo link with only the Firebase boundary mocked — VERIFIED

- The test file mocks exactly `../../lib/firebase` (factory provides `getIdToken`), imports real `getAuthToken` from `../../apollo/get-auth-token` and the real `client` from `../apollo-client`, and spies `globalThis.fetch`. The two URI tests use `jest.isolateModules` for clean env re-evaluation. This is the integration shape the prior review demanded.

## Independent test run (mine, this session)

Repo Jest configs remain pre-existing-broken (dual auto-detected configs; `jest.config.js` wants uninstalled `jest-junit`, `jest.config.mjs` wants uninstalled `ts-jest`). Workaround: inline config in `/tmp` (jsdom, repo `jest.setup.js` incl. `whatwg-fetch`, `babel-jest` + `next/babel`, `@/ → src/`):

```text
PASS src/lib/__tests__/apollo-client.test.ts
8 passed, 0 failed (0.9 s)
```

(First attempt with a shell-escaped inline `--config` string failed to transform ESM setup due to regex over-escaping — config-file approach used instead; not a product issue.)

## SSR/browser regression check

- `authMiddleware` still skips token work server-side (`!isBrowser` → forward immediately); `client` keeps `ssrMode: !isBrowser`; mounting model unchanged from the prior review's PASS.
- `get-auth-token.ts` has no window/document references; `firebase.ts` lazily guards Firebase init and its `auth` export is browser-gated. Even a hypothetical server-side call resolves null (no user) → no Bearer — fail-safe, no crash.
- `credentials: 'omit'`, URI construction, dev-logger (dev-only), error-warn middleware all unchanged — no regressions introduced by the helper swap.
- No remaining references to `/api/auth/get-token` in app code (grep-verified); the route file itself is W1-owned legacy left in place (disclosed by the fixer — fine).

## Non-blocking findings (notes)

1. **Stale comment** `lib/apollo-client.ts:34` still says "cached + deduped by getAuthToken, 10-min cache" — the cache no longer exists (dedupe does). Doc drift only; already disclosed as out of the fixer's write scope.
2. **Partial mock factory**: the `jest.mock('../../lib/firebase')` factory exports only `getIdToken`. Correct today (the helper imports only that), but future imports of other exports through this chain would silently see `undefined` in tests. A `jest.requireActual` spread would be more robust.
3. **Legacy route** `/api/auth/get-token` is now dead code (W1 follow-up candidate), as disclosed.
4. Repo-wide `tsc --noEmit`/ESLint remain broken/noisy from pre-existing issues (disclosed by the fixer; unchanged by this review's scope). The changed files compile through the test transform and match their reported 0-error state.

## Verdict

**ACCEPT.** The W2 blocker is genuinely closed: the bearer is sourced from the live Firebase SDK user (native refresh semantics, no custom cache that can outlive the identity), concurrent dedupe releases on success and failure, logged-out requests carry no Bearer and produce no false-error noise, and the tests now exercise the real helper + real Apollo link chain with only the Firebase boundary mocked — 8/8 pass in my independent rerun. No SSR/browser regressions found.

**Unresolved questions:** none.
