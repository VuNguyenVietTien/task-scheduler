# Sol/high Independent Review — Frontend W2 Transport

**Verdict: REWORK**  
**Date:** 2026-08-31  
**Mode:** read-only. No source/config edits, install, deploy, commit, or push. Only this report was written.

## Reviewed scope

- `plans/reports/herdr-260831-frontend-w2-transport.md`
- `plans/reports/herdr-260831-frontend-migration-scout.md`
- architecture/auth review context and the current combined W1/W2 working tree
- exact W2 paths:
  - `web/src/lib/apollo-client.ts`
  - `web/src/apollo/design-doc-client.ts`
  - `web/src/apollo/get-auth-token.ts`
  - `web/src/lib/graphqlClient.ts`
  - deleted `web/src/lib/apollo.ts`
  - deleted `web/src/hooks/ApolloClient.tsx`
  - `web/src/lib/__tests__/apollo-client.test.ts`
- adjacent W1 auth/session routes needed to verify the real bearer source

## Blocking finding

### F1 — P0: the active Apollo client does not obtain the current Firebase ID token

`web/src/lib/apollo-client.ts:42` correctly calls `getAuthToken()` and conditionally installs its result as `Authorization: Bearer ...`. The helper does **not**, however, read the W1 Firebase SDK session. It calls `GET /api/auth/get-token` (`web/src/apollo/get-auth-token.ts:30`), whose implementation reads only the legacy `auth-token` cookie (`web/src/app/api/auth/get-token/route.ts:9`).

That cookie is no longer issued by the accepted W1 login path:

- `AuthContext` signs in with Firebase and obtains the live ID token through `getIdToken()`.
- `/api/auth/firebase/login` now sets only the signed `pm_session` cookie (`web/src/app/api/auth/firebase/login/route.ts:53-57`).
- W1 explicitly classifies `auth-token` and `user-session` as legacy cookies (`web/src/app/api/auth/_session.ts:22`).
- No current caller invokes `/api/auth/set-token` or `/api/auth/set-cookie` after login.

Therefore a normal fresh W1 login leaves `/api/auth/get-token` returning 401, `getAuthToken()` returning `null`, and every main/design-doc Apollo request going out without an Authorization header. If a stale `auth-token` cookie exists, its provenance is legacy and is not guaranteed to be the current Firebase ID token. The W2 report's statement that this route is a W1-owned Firebase-token source is false in the final combined tree.

The new test masks this integration break by mocking `getAuthToken()` to return the literal string `firebase-id-token-123`. It proves only that the Apollo link forwards a supplied token; it does not prove the production token source or a fresh-login request.

**Required:** source the bearer from the current Firebase Auth user (the existing W1 `getIdToken()` path, including SDK refresh semantics), or introduce a verified W1/W2 contract that actually stores/returns a current Firebase token. Add an integration-focused test covering fresh W1 login/session state → Apollo request → Firebase Bearer header, plus logged-out behavior.

## Review matrix

| Concern | Result | Evidence |
|---|---|---|
| Main Apollo URI | **PASS** | `NEXT_PUBLIC_BACKEND_URL` falls back to `https://pm-api.khampha.dpdns.org`, trailing slashes are removed, then exactly `/graphql` is appended. Focused URI tests pass. |
| Firebase bearer source | **FAIL / BLOCKER** | Apollo consumes the legacy-cookie `/api/auth/get-token` helper, while W1 issues only `pm_session` and keeps the actual Firebase token in the Firebase SDK session. |
| Browser/SSR behavior | **PASS for current mounting model** | Main auth link skips token work server-side; the mounted provider is client-only and delays children until mount. Design-doc clients are created from client components. No server request accidentally receives browser cookies. |
| Cross-origin credentials/CORS | **PASS** | Both new HTTP links use `credentials: 'omit'`. Rust allows the exact configured frontend origins and permits `Authorization`, `Content-Type`, and required methods. Server `supports_credentials()` is unnecessary for these requests but does not force browser cookie transmission. |
| Main Apollo Supabase transport | **PASS, scoped** | `createBrowserClient().auth.getSession()` was removed from the mounted main client; it now targets Rust directly. Dormant alternate/dead clients do not import into the mounted tree. W5-owned routable Supabase APIs and other migration planes still exist, so this is not the final repository-wide Supabase-zero gate. |
| Design-doc failure behavior | **PASS** | Missing `NEXT_PUBLIC_DESIGN_DOC_API_URL` throws a clear per-operation error, logs once, and cannot silently fall back to Rust `/graphql`; consuming UIs expose Apollo's error. Both links omit cookies. The environment is currently unset, so design-doc functionality intentionally remains unavailable until ops route the service. |
| Deleted files | **PASS** | No importer of deleted `src/lib/apollo.ts` or `src/hooks/ApolloClient.tsx` remains. `@/apollo` resolves the separate `src/apollo/index.ts`, not the deleted file. |
| `graphqlClient` stub | **PASS with documented dead-code dependency** | `projectApi.ts` and `taskApi.ts` still type-import/call the stub, but both have no importers. The stub preserves their symbols and fails loudly if unexpectedly called rather than hitting retired Yoga/Supabase transport. |
| W2 test validity | **PARTIAL** | The four tests validly cover URI construction, link header forwarding, null-token behavior, and `credentials:'omit'`; they do not validate the real Firebase source and thus miss F1. |

## Verification

### Source/static checks

- Exact W2 diff inspected against `HEAD`.
- Importer searches performed for both deleted files, the throwing stub, provider mounting, alternate Apollo clients, same-origin `/api/graphql`, and Supabase usage.
- `git diff --check` on all W2 paths: **PASS**.

### TypeScript

`cd web && npm exec tsc -- --noEmit` ran with the installed TypeScript 5.7.3 toolchain. It failed on numerous existing/current-tree errors in unrelated task/components/tests and one W1 `AuthContext` type error. No diagnostic named a W2 implementation or W2 test path. This is not a repository-wide clean typecheck.

### Jest

The normal scoped command cannot run because the project has two auto-detected Jest configs. Selecting either checked-in config also fails before test execution:

- `jest.config.js` references undeclared/uninstalled `jest-junit`.
- `jest.config.mjs` references undeclared/uninstalled `ts-jest`.

Using an equivalent inline jsdom + `next/babel` configuration with the installed Jest 29.7.0 toolchain:

```text
PASS src/lib/__tests__/apollo-client.test.ts
4 passed, 0 failed
```

This validates the test body while preserving the test-coverage limitation above.

## Final verdict

**REWORK.** Endpoint routing, cookie omission, client mounting, explicit design-doc failure, and retirement safety are acceptable. Production transport is nevertheless unusable after a fresh W1 login because the bearer helper reads a legacy cookie that W1 no longer sets. The mocked test conceals that broken W1→W2 contract. Acceptance requires using the live Firebase SDK token and testing the integrated source, not only link forwarding.

**Unresolved questions:** none blocking beyond the required W1/W2 token-source contract correction.
