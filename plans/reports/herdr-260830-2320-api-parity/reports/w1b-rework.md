# W1b — Auth Parity Rework Report (F1–F4, /me hardening, cookie policy)

**Agent:** w1b-auth | **Run:** herdr-260830-2320-api-parity | **Status:** REWORK COMPLETE
**Input:** `reports/sol-review-w1b.md` (all 4 findings + N1/N2 notes) + manager decisions.

## 1. Findings fixed

### F1 — username unique-constraint 500 (HIGH) ✅
`backend/src/auth/service.rs`:
- New `sanitize_username_base` (web parity: non-`[a-zA-Z0-9_]` → `_`, "user" fallback when empty) and `username_candidates(preferred, email)` → bounded list `[base, base_<ms-timestamp>]`.
- `upsert_user_by_email`: insert loop retries on Postgres 23505 (`is_unique_violation`) with the suffixed candidate; when all candidates collide → re-select by email (concurrent insert) and return the existing row (web `firebase/login` fallback parity). No more 500 on `john@gmail.com` vs `john@outlook.com`.
- Legacy `register()` got the same treatment opportunistically (was the same latent 500).
- Unit-tested: sanitization (incl. unicode), bounded candidates, email-local-part fallback, suffix format.

### F2 — /refresh contract (MEDIUM) ✅ (option b, per manager)
`backend/src/api/auth.rs`:
- **Credential**: `bearer_or_auth_cookie(req)` — `Authorization: Bearer` first, else the `auth-token` cookie (web `api.ts` sends `credentials: 'include'`, no header). Applied to `refresh` and `resend-verification`.
- **Response keys**: `refresh_response_body()` returns `token` (legacy/mobile) + `access_token` + `accessToken` (web camelCase) + `token_type` + `expires_in`.
- **`/api/auth/refresh` alias**: `pub fn alias_config(cfg)` mounts the same `refresh` handler under an `/auth` scope intended for `/api`. **Mount blocker (ownership):** W1b may not edit `api/routes.rs`; the routes owner must add exactly one line inside `routes.rs::config`:
  ```rust
  cfg.service(web::scope("/api").configure(auth::alias_config));
  ```
  Until then the handler is live at `/api/v1/auth/refresh` with full cookie+multi-key behavior; the alias path itself is a 1-line, zero-logic mount away. Both dual deploy shapes (Next.js-only and Next.js+Rust) are otherwise fully served.

### F3 — firebase/login parity gaps (MEDIUM) ✅
1. **Email claim check**: `firebase_email_matches(token_email, request_email)` — case-insensitive; mismatch → 403. Skipped only when the token carries no email claim (matches web semantics where the field is compared when present).
2. **403 on verification failure**: token-verification errors now map to `AuthError::Forbidden` (403) instead of 401; UID mismatch and email mismatch also 403.
3. **Missing fields → 400 `{error}`**: `FirebaseLoginData` identity fields are now `Option`; `validate_firebase_login` returns the exact web message `"Firebase token, email, and uid are required"` as `400 {"error": ...}`.

### F4 — register error paths (MEDIUM) ✅
- New `AuthError::EmailExists` variant (400 / `EMAIL_EXISTS`; `ResponseError` in `error.rs`, `IntoGraphQLError` in `graphql/handlers.rs` updated — the only two exhaustive matches; verified resolvers only construct variants).
- `register()` (service) now returns `EmailExists` instead of `Database(RowNotFound)`; handler converts to `400 {"success":false,"error":"Email already exists"}`.
- **Orphan prevention**: when Supabase is configured and its user was created, an app-row failure is now **non-fatal** (web parity: profile insert logged + success returned without app-row fields) instead of a false failure stranding the Supabase auth user. Username-collision failures inside `register()` are additionally eliminated by F1.
- Supabase `createUser` failure → 400 `{success:false, error}` unchanged.

### /me hardening (manager instruction on N1) ✅
`/api/v1/auth/me` no longer trusts `user-session` JSON:
- Credential = `auth-token` cookie OR Bearer (never the session JSON).
- Verification: dual JWT (`identity::resolve_bearer_claims`) with a **Firebase ID-token fallback** (`FirebaseService::verify_token_and_get_claims`) because the web firebase-login flow stores the Firebase token in `auth-token` — without this the hardened /me would 401 every web session.
- Then a **fresh `users` row by email is required** (name from DB, `emailVerified` from DB — no longer hardcoded true).
- Any failure (no credential, unverifiable token, no DB row) → `401 {"user":null}` with **both cookies cleared** (`expired_cookie` for `auth-token` + `user-session`), including the malformed-session-cookie case from review N1.

### Cookie hardening — deployment-configurable & safe ✅
- `config.rs`: new `COOKIE_SAMESITE` (`lax|none|strict`, default lax; invalid value → explicit `InvalidVar` boot error), `COOKIE_HTTP_ONLY` (default false), existing `COOKIE_SECURE`.
- `Config::cookie_policy()` → `CookiePolicy {secure, http_only, same_site}`; **SameSite=None forces Secure=true** with a boot warning (browsers reject None without Secure).
- `cookies.rs` builders take the policy; both `auth-token` and `user-session` honor http_only/same_site/secure.
- **Compatibility defaults preserved**: Lax + non-Secure + non-HttpOnly = previous behavior (local dev, same-site, web JS reads `auth-token`).
- `.env.example` documents all three vars with production recommendations (HttpOnly=true unless JS needs the token; SameSite=None only for cross-site deploys, Secure forced).

## 2. Verification

- `cargo check --lib --tests`: **0 errors** (with concurrent W1a edits present).
- `cargo test --test auth`: **19/19 pass** (was 10; +9 for F1/F2/F3/F4/cookie-policy).
- `cargo test --lib auth::`: **35 pass / 1 fail** — the single failure is the **pre-existing, separately-noted** `auth_common::tests::test_token_flow`, which hard-requires a real `DATABASE_URL` (network DB; untouched legacy `env::var("DATABASE_URL").expect(...)` — reviewer-confirmed pre-existing). Cannot be satisfied under the no-network constraint.
- `cargo test --lib config::`: **4/4 pass** (added samesite-parse + policy-forces-Secure tests).
- Targeted `rustfmt --edition 2021` on all edited files.

## 3. Corrections to `reports/w1b-auth.md` (review N5)

- (a) Files-touched list was incomplete: it also contains **formatting-only** changes to `auth/middleware.rs`, `auth/error.rs`, `auth/types.rs` (present in worktree from the first session; error.rs now also carries the functional `EmailExists` variant).
- (b) `upsert_user_by_email` was described "email-first"; actual (and current) order is **uid-first, then email, then insert** — correct behavior (binds existing Firebase accounts).
- (c) `backend/&1` was described as 0 bytes; it was a **28 KB compiler/cargo-output artifact** (verified: contains cargo warning dump + `cargo report future-incompatibilities` + test-runner output). Per manager instruction it was inspected and **deleted** after verification.

## 4. Ownership & untouched lanes

- Edited: `auth/{service,cookies,error,mod,jwt,token,password,auth_common,middleware?,types?}.rs` (last two: prior-session formatting only), `api/auth.rs`, `graphql/handlers.rs`, `config.rs`, `.env.example`, `tests/auth/main.rs`. All within W1b ownership.
- Not touched: `main.rs`, `api/routes.rs`, `graphql/context.rs`, W1a's `graphql/types/**`, `resolvers/**`, `schema.graphql` (40 modified files coexist; final check/test runs include them).
- No commit/push/deploy.

## 5. Follow-ups (recorded, not done here)

- **W2b / routes owner**: mount the F2 alias — `cfg.service(web::scope("/api").configure(auth::alias_config));` in `api/routes.rs::config`.
- **W2b (manager-recorded)**: CORS allowlist — `main.rs:102-108` runs `allow_any_origin().supports_credentials()`; tighten to `FRONTEND_URL` origin allowlist before public deploy.
- Phase 3 candidates (review N2): boot warning when `cookie_secure=false` on non-localhost host (needs `main.rs` owner); consider signing `user-session` or dropping it now that `/me` ignores it.
- Web `api.ts` `/api/projects/...` (no `/v1`) callers look stale-dead — same question as F2 pre-decision; relevant to the REST-mount phase (Phase 4).

**Unresolved questions:** none blocking; the alias one-liner in routes.rs is the only externally-owned step of F2(b).
