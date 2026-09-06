# W2 — Frontend Transport Switch (Apollo → Rust backend)

- **Date:** 2026-08-31
- **Worker:** W2 (transport implementation), per ownership table in `plans/reports/herdr-260831-frontend-migration-scout.md` §E.
- **Deadline:** 22 min — completed in scope; see Verification (jest could not be executed).
- **Branch/tree:** `feat/vercel-supabase-migration`, pre-existing dirty tree (~2,092 entries) untouched elsewhere. No commit / push / deploy / installs.

## 1. What changed (per file, with line refs)

| File | Change |
|---|---|
| `web/src/lib/apollo-client.ts` | **Main client switched to Rust.** `BACKEND_GRAPHQL_URL` export (lines 19–30): `process.env.NEXT_PUBLIC_BACKEND_URL` (default `https://pm-api.khampha.dpdns.org`), trailing slashes trimmed via `replace(/\/+$/, '')`, `/graphql` appended. `httpLink` (32–38): `uri: BACKEND_GRAPHQL_URL`, `credentials: 'omit'` (bearer is the auth; no cookies cross-origin). `authMiddleware` (40–66): now calls `getAuthToken()` (Firebase ID token, 10-min cache) and sets `Authorization: Bearer <token>`; **Supabase `createBrowserClient`/`getSession` removed from the file entirely** (import deleted, line 5 note). SSR-safe `isBrowser` guard (line 9) and client-only behavior preserved. Dev-only op logger (`sendDevLog`/`devLoggerMiddleware`, 68–129) and `errorMiddleware` (131–143) preserved unchanged. `client` export (145–156) unchanged in shape — same link order, cache, `no-cache` defaults. |
| `web/src/apollo/design-doc-client.ts` | **Explicit routed endpoint, no silent Rust fallback.** Reads `NEXT_PUBLIC_DESIGN_DOC_API_URL` once (line 29, trimmed). `requireDesignDocEndpoint()` (33–60): returns the URL or throws a descriptive `Error` naming `NEXT_PUBLIC_DESIGN_DOC_API_URL`; logs **one** `console.error` on first miss (`missingEndpointLogged` guard). `httpLink` (62–67): `uri: () => requireDesignDocEndpoint()` — evaluated per operation so misconfiguration surfaces as an Apollo network error at call time, never a request to a guessed endpoint; `credentials: 'omit'`. `authLink`/`createDesignDocClient()` (69–84) keep the same export name/signature and Bearer-from-`getAuthToken` behavior, so W4 consumers (`designs/layout.tsx`, `DocumentsTab.tsx`) need no change. Header comment (8–27) documents all of this in code. |
| `web/src/apollo/get-auth-token.ts` | Doc comment only (lines 1–8): clarified it is the PREFERRED token source for active transports and returns the **Firebase ID token** from the W1-owned `/api/auth/get-token` route. Logic byte-identical. |
| `web/src/lib/graphqlClient.ts` | **Retired to a deprecation stub** (149 → 29 lines). Keeps only the type re-exports from `./graphqlClient.types` (lines 17–24) and a `graphqlRequest()` that throws a clear "retired (W2 transport migration)" `Error` (26–29). Reason for stub instead of delete: two importers exist (see §3). Inline Supabase-session fetch and all inline mutation/query strings removed. |
| `web/src/lib/apollo.ts` | **Deleted.** Zero importers (verified, §3). Legacy `REACT_APP_GRAPHQL_URL`/`localhost:8000` client with `localStorage` token. |
| `web/src/hooks/ApolloClient.tsx` | **Deleted.** Zero importers (verified, §3). Duplicate mounted-gate ApolloProvider around the same client. |
| `web/src/providers/ClientProviders.tsx`, `web/src/app/Providers.tsx`, `web/src/app/layout.tsx` | **No changes needed.** Grep confirms none of them reference any retired file; both providers import only `@/lib/apollo-client` (which keeps its export), and `layout.tsx` mounts `ClientProviders` only. Single main client still mounted once per tree (`ClientProviders` → `ApolloProvider`; `Providers.tsx` remains a redundant-but-harmless alternate composition, unchanged per "no behavior change beyond transport"). |
| `web/src/providers/QueryProvider.tsx`, `web/src/providers/SyncProvider.tsx`, `web/src/hooks/useStorageSync.ts` | **No changes.** No old same-origin GraphQL assumptions in them. `useProjectStatus` still PATCHes `/api/projects/{id}` (`useStorageSync.ts:37-39`) — deliberately left: that route is owned by W5 and still exists; re-pointing it to Rust is not trivially safe (Rust REST surface/ownership for that op is W5's call). |
| `web/src/lib/__tests__/apollo-client.test.ts` | **New** jest suite (see §5). |

## 2. Transport / auth decision table (old → new)

| Concern | Before | After |
|---|---|---|
| Main client URI | `/api/graphql` (same-origin Next Yoga → Supabase) | `${NEXT_PUBLIC_BACKEND_URL or https://pm-api.khampha.dpdns.org}/graphql` (Rust/Actix via Cloudflare) — trailing slash trimmed |
| Main client auth | Supabase `getSession()` access_token → `Authorization: Bearer` | **Firebase ID token** via `getAuthToken()` (10-min cache, `/api/auth/get-token`) → `Authorization: Bearer` |
| Main client credentials | `same-origin` (cookies) | **`omit`** — bearer header is the credential; avoids CSRF + third-party-cookie issues on the cross-origin API (architecture review §5.1) |
| Supabase on active path | `createBrowserClient` imported in main client | **Removed entirely** from active transport files (grep-verified, §6) |
| Design-doc client URI | `/api/design-doc` (same-origin Yoga; comment falsely claimed `DESIGN_DOC_API_URL` proxying) | `NEXT_PUBLIC_DESIGN_DOC_API_URL` (full URL, explicit); throws + logs once if missing/empty |
| Design-doc credentials | default | `omit` (bearer is auth) |
| SSR safety | `isBrowser` guard | unchanged |
| Dev op logger | posts to `/api/dev/graphql-log` in dev | preserved unchanged |
| Error middleware | warns on unauthorized/unauthenticated | preserved unchanged |
| `useProjectStatus` fetch | `/api/projects/{id}` | unchanged (W5 owns the route) |

## 3. Dead-path retirement evidence (grep import counts, before → after)

Before (scout report §B1 + my re-verification): 
- `web/src/lib/apollo.ts` → **0** importers (`grep -rn "lib/apollo'" src` excluding `apollo-client`/`apollo-server` = 0 matches)
- `web/src/hooks/ApolloClient.tsx` → **0** importers (`grep -rn "ApolloClientProvider\|hooks/ApolloClient" src` = 0 matches outside the file itself; double-quote variant also 0)
- `web/src/lib/graphqlClient.ts` → **2** importers: `src/lib/projectApi.ts:1-2` and `src/lib/taskApi.ts:1-2` (both `graphqlRequest` + type imports). **Scout's "no importers" claim was wrong here** — but both importers are themselves dead (0 importers each: `grep -rn "projectApi\|taskApi" src` excluding the two files = 0). Deleting `graphqlClient.ts` would have broken their typecheck, so it is a throwing stub instead; they remain deletable by whoever owns them.

After: 
- `lib/apollo.ts`, `hooks/ApolloClient.tsx` deleted; repo-wide grep for any import of them = **0** matches (files + references gone).
- `graphqlClient.ts` stub keeps exactly the symbols the two dead importers need (`graphqlRequest`, the 5 input types) so nothing typechecks differently.

## 4. Design-doc endpoint failure behavior (as required)

- Missing/empty `NEXT_PUBLIC_DESIGN_DOC_API_URL` at **call time** → the `httpLink` `uri` resolver calls `requireDesignDocEndpoint()`, which: (a) logs exactly **one** `console.error` naming `NEXT_PUBLIC_DESIGN_DOC_API_URL` and explaining that the Rust backend has no design-doc roots (no safe default); (b) **throws** `Error('Design-doc API endpoint is not configured: set NEXT_PUBLIC_DESIGN_DOC_API_URL (full URL of the design-doc GraphQL service) to enable design documents.')` — surfaced by Apollo as a network error on that operation. No request is ever sent to a guessed endpoint (never to Rust `/graphql`). Documented in the file header comment (lines 8–27).
- Note: `.env.local` today has only the non-public, code-unused `DESIGN_DOC_API_URL=http://localhost:8081`; ops must set `NEXT_PUBLIC_DESIGN_DOC_API_URL` (full URL incl. path) wherever design docs are used, or `/designs/**` + Documents tab will show this explicit failure.

## 5. Tests

Added `web/src/lib/__tests__/apollo-client.test.ts` (4 tests):
1. default URI = `https://pm-api.khampha.dpdns.org/graphql` when env unset (module re-evaluated via `jest.isolateModules`);
2. trailing-slash trim → `https://api.example.com/graphql`;
3. `client.query()` → fetch called with `BACKEND_GRAPHQL_URL`, header `Authorization: Bearer firebase-id-token-123` (from mocked `getAuthToken`), `credentials: 'omit'`;
4. token `null` → request still sent, no Authorization header.

Design choices for robustness: only relative imports (works under **both** `jest.config.js` — which lacks a `@/apollo/*` alias map — and `jest.config.mjs`); `getAuthToken` mocked at its real relative path; `jest.mock` hoisting + `afterEach` env restoration (`.env.local` sets `NEXT_PUBLIC_BACKEND_URL=http://localhost:8080`, and next/jest loads env files, so tests must pin env explicitly).

**Could not be executed — see §6.**

## 6. Verification commands + outcomes

Environment fact: **`web/node_modules` does not exist** (nor root/frontend/backend), no global tsc/jest/eslint. `npm install` is explicitly out of scope ("no installs"). Therefore:

| Command | Outcome |
|---|---|
| `npx tsc --noEmit` (project typecheck) | **Infeasible** — no local TypeScript and no node_modules; `npx tsc` refuses ("Use npm install typescript first…"). |
| `npx eslint <owned files>` | **Infeasible** — no eslint installed; project uses eslint 8 + `next lint`, none runnable without node_modules. |
| `npx jest` (new test + existing suites) | **Infeasible** — jest, `next/jest`, `jest-environment-jsdom`, `@apollo/client`, babel presets all absent from disk. Tests written but not run (documented in the test file header). |
| `npx -y --package typescript@5.7.3 --call "tsc --noEmit --skipLibCheck --strict false --target es2020 --module esnext --moduleResolution bundler --jsx preserve <11 owned/adjacent files + new test>"` | **Ran from npx cache (no project install).** Result: exit 2 with **14 errors, ALL `TS2307` module-not-found**, every one an `@/...` path-alias or node_modules import that manual flags cannot resolve without tsconfig `paths`/deps (e.g. `@/lib/apollo-client`, `@/contexts/AuthContext` — including in files I did not modify). **0 non-TS2307 errors** → my files are syntactically and locally semantically clean; all relative imports (`../apollo/get-auth-token`, `./graphqlClient.types`, `./get-auth-token`) resolved successfully. |
| Pre/post grep of retired importers | Before/after counts in §3. |
| `git status --short -- <owned paths>` | Exactly: `M apollo-client.ts`, `M get-auth-token.ts`, `M design-doc-client.ts`, `M graphqlClient.ts`, `D lib/apollo.ts`, `D hooks/ApolloClient.tsx` (+ new untracked test/report). No other paths touched. |

**Pre-existing vs new errors:** no baseline `tsc`/`eslint` run was possible at all (no toolchain), so the honest classification is: every observed TS2307 is an artifact of running the compiler without tsconfig paths/node_modules and appears identically on untouched files (e.g. `layout.tsx`, `SyncProvider.tsx`) — i.e., **pre-existing/environmental, not caused by W2**. Zero errors attributable to my edits. The ~2,092 pre-existing dirty-tree entries were preserved untouched.

## 7. Limitations

1. Jest suite written but unexecuted (toolchain absent; installs forbidden). First CI/local run after `npm install` must confirm all 4 pass.
2. Full typecheck with real `@apollo/client` types not possible here; Apollo API usage (`createHttpLink` `uri` as function, `ApolloLink`, `setContext`) matches the patterns already used in this repo, but only tsc-with-deps proves it.
3. `Providers.tsx` vs `ClientProviders.tsx` duplication left as-is (no behavior change permitted); only `ClientProviders` is mounted by `layout.tsx`.
4. `getAuthToken` still fetches from `/api/auth/get-token` (W1-owned route). If W1 retires that route in favor of a direct Firebase `getIdToken()` call, `get-auth-token.ts` (W2-owned) is the single place to swap — flagged in its header comment.
5. Runtime CORS depends on Rust allowing the web origin with `Authorization` headers (architecture review §5) — not verifiable from the repo.

## 8. Unresolved questions

1. Who deletes the dead pair `web/src/lib/projectApi.ts` / `web/src/taskApi.ts` (the last importers of the `graphqlClient` stub)? Not W2-owned; once gone, the stub can be deleted too.
2. Will ops set `NEXT_PUBLIC_DESIGN_DOC_API_URL` (full URL) in Vercel, and to which deployment (routed `design-doc-service` vs future Rust roots)? Until then design-doc surfaces fail by design.
3. Should `useProjectStatus`'s `/api/projects/{id}` PATCH move to Rust GraphQL (`update_project` exists in `backend/schema.graphql:181+` Mutation block)? Left for W5/W3 coordination per ownership.
4. `web/.env.local` sets `NEXT_PUBLIC_BACKEND_URL=http://localhost:8080` — confirm Vercel production env is set to `https://pm-api.khampha.dpdns.org` (or rely on the built-in default).

/Users/TienVNV/Desktop/ProjectManager/plans/reports/herdr-260831-frontend-w2-transport.md
