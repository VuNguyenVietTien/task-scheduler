# W2-1: Firebase SDK bearer source — fix report

**Task:** Fix blocking W2 Firebase bearer source in `web`.
**Mode:** edit; no commit/push/deploy/delete/install.
**Date:** 2026-09-01

## Problem

`web/src/apollo/get-auth-token.ts` (the shared token helper for ALL active Apollo
transports: `lib/apollo-client.ts`, `apollo/client.ts`, `apollo/design-doc-client.ts`)
fetched the bearer via the legacy `GET /api/auth/get-token` route, which reads the
stale `auth-token` cookie — a leftover from the pre-Firebase (W1) auth model. Three
defects:

1. **Wrong source:** after the W1 Firebase migration the authoritative identity is the
   Firebase SDK user; the `auth-token` cookie is no longer the source of truth.
2. **Stale custom cache:** a 10-minute TTL cache could serve a token that outlived the
   SDK identity (e.g. up to 10 min after sign-out, or past an SDK refresh/revocation).
3. **Noisy logged-out path:** logged-out users hit `401 {error: 'No auth token found'}`
   → `console.error` false-positive noise on every page load in production.

## Fix

Rewrote `web/src/apollo/get-auth-token.ts` to read the bearer directly from the
Firebase SDK via the existing `getIdToken()` helper in `src/lib/firebase.ts`
(`getCurrentUser()` → `user.getIdToken()`):

- **SDK refresh semantics preserved:** `user.getIdToken()` serves the SDK-cached ID
  token and force-refreshes when the SDK deems it stale; tokens live ~1h and are
  auto-refreshed by the SDK. The custom 10-min TTL cache is REMOVED — each
  non-concurrent call re-queries the SDK (which is cheap; no extra network when the
  token is still valid), so sign-out/identity changes are reflected immediately.
- **Concurrent-request dedupe preserved:** a burst of concurrent callers shares one
  in-flight promise (single `getIdToken` resolution at a time); slot released in
  `finally` even on failure.
- **Quiet logged-out path:** no Firebase user (including unconfigured deployments,
  where `getFirebaseAuth()` → null → `getIdToken()` resolves null immediately) returns
  `null` with zero console noise; only genuine SDK failures (network/refresh errors)
  are logged.

**No W1 routes or `firebase.ts` changes needed** — the existing helper API
(`getIdToken()`) was sufficient, as required.

## Files changed

| File | Change |
|---|---|
| `web/src/apollo/get-auth-token.ts` | Replaced legacy `/api/auth/get-token` fetch + 10-min cache with Firebase SDK `getIdToken()` + in-flight dedupe; quiet null on logged-out; header docs updated. |
| `web/src/lib/__tests__/apollo-client.test.ts` | Rewritten integration-focused: only `src/lib/firebase` is mocked; real `getAuthToken` + real Apollo client/link chain run. |

Note (read-only observation): comments in `web/src/lib/apollo-client.ts` still mention
"10-min cache" — now slightly stale docs, but out of write scope; behavior is correct
(it just calls `getAuthToken()`).

## Tests added (all pass — 8/8)

Integration (real helper + real Apollo client, Firebase mocked):
1. Fresh authenticated Firebase state → `Authorization: Bearer <token>` sent to Rust
   endpoint, `credentials: 'omit'`, correct URI.
2. Logged-out → request sent WITHOUT Authorization, `console.error` NOT called.

Helper semantics:
3. Concurrent calls deduped into ONE `getIdToken` call (deferred promise, both callers
   share result).
4. No stale custom cache: sign-out (`getIdToken` → null) reflected on the very next
   call (old impl would have returned cached token; asserts SDK re-queried).
5. Logged-out resolves null quietly (no false-error noise).
6. Genuine SDK failure → resolves null, logged once; in-flight slot released and
   recovery works next call.

Plus 2 retained `BACKEND_GRAPHQL_URL` tests (default origin, trailing-slash trim).

## Commands & results

- `npx jest --config <inline-json> src/lib/__tests__/apollo-client.test.ts`
  → **PASS, 8/8 tests** (0.8–1.0s). Inline config used because both repo configs fail
  out-of-the-box (see Limitations). Inline config: jsdom env, `whatwg-fetch` setup,
  `babel-jest` + `next/babel` transform, `@/ → src/` alias — matching repo config.
- `npx tsc --noEmit` → **0 errors in changed files** (repo-wide run has 303
  pre-existing errors in unrelated files, e.g. `src/lib/scheduler.ts`,
  `src/lib/testUtils.ts`; fixed the one initial error found in the test file
  — stray arg in `deferred()` call).
- `npx eslint src/apollo/get-auth-token.ts src/lib/__tests__/apollo-client.test.ts`
  → fails to run: `ESLint couldn't find the config "next/typescript"` (pre-existing,
  repo-wide; eslint-config-next@13 lacks that flat config).

## Limitations

- `npm test` / bare `npx jest` cannot run in this tree as-is (pre-existing, NOT caused
  by this change): (a) two configs (`jest.config.js` + `jest.config.mjs`) conflict;
  (b) `jest.config.js` requires the uninstalled `jest-junit` reporter;
  (c) `jest.config.mjs` requires the uninstalled `ts-jest` preset. Worked around with
  an inline JSON config; installs were out of scope.
- ESLint unusable repo-wide (config/env mismatch above).
- Tests mock the Firebase SDK boundary (`src/lib/firebase`) rather than a live
  Firebase project — real-SDK E2E verification (actual token refresh against
  Firebase) not performed here.
- Legacy route `/api/auth/get-token` is now unreferenced by app code but left in
  place (W1-owned, out of write scope) — candidate for removal in a W1 follow-up.

## Verdict

**PASS (scoped).** W2 blocker resolved: bearer now comes from the current Firebase
SDK user token with native SDK refresh semantics, no custom TTL cache that can
outlive SDK identity, concurrent dedupe preserved, logged-out is silent `null`, and
the integration path (Firebase state → Apollo Bearer) is test-covered and green.
Static/type checks clean for changed files; remaining failures are pre-existing and
unrelated.
