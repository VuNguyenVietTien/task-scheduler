# Sol Final Review — W1b Auth Rework (Second Pass)

**Reviewer:** Sol/high architecture review | **Date:** 2026-08-31  
**Inputs:** `sol-review-w1b.md`, `w1b-rework.md`, current W1b source/diff, frontend auth routes, targeted build/tests.  
**Constraint:** review-only; no source/config edits.

## Verdict: **REWORK**

F1, F3, F4, `/me` hardening, cookie configurability, ownership, and claimed build/test results are substantially correct. One F2 common-path defect remains inside W1b ownership: `/refresh` accepts the `auth-token` cookie but cannot verify the Firebase ID token that `firebase/login` stores in that cookie. Therefore the web consumer path still fails even after the externally-owned alias is mounted. Production also remains blocked by the external route mount and CORS policy.

## Independent verification

Executed against the combined W1a+W1b tree:

- `cargo check --lib --tests` → **PASS**, 0 errors (warnings only).
- `cargo test --test auth` → **19/19 PASS**.
- `cargo test --lib config::` → **4/4 PASS**.
- The known `auth_common::tests::test_token_flow` DB/network dependency remains pre-existing and outside this rework; it is not counted as a W1b regression.
- Functional edits remain within W1b ownership (`auth/**`, `api/auth.rs`, `graphql/handlers.rs`, `config.rs`, `.env.example`, `tests/auth/**`). `routes.rs`, `main.rs`, `graphql/types/**`, resolver/schema files were not modified by W1b.

## Rework gate verification

### F1 — username collision: **PASS**

- `sanitize_username_base` constrains usernames to ASCII alphanumeric/underscore with a safe fallback.
- `username_candidates` provides bounded base + timestamp-suffix candidates.
- Both Firebase upsert and legacy register retry PostgreSQL `23505`, then re-select by email for a concurrent same-email insert.
- Unit coverage verifies sanitization/candidate behavior.

Residual low-probability behavior (both username candidates occupied but no same-email row → `RowNotFound`) is bounded and acceptable for this phase.

### F2 — refresh contract: **PARTIAL / BLOCKING**

Correctly delivered:

- Bearer first, then `auth-token` cookie.
- Additive response keys: `token`, `access_token`, `accessToken`, `token_type`, `expires_in`.
- `alias_config` implements `/auth/refresh` for eventual `/api` mounting.

Still broken:

1. `firebase_login` writes the **Firebase ID token** into `auth-token`.
2. `/me` explicitly handles this with dual JWT verification followed by `FirebaseService::verify_token_and_get_claims` fallback.
3. `/refresh` only calls `identity::resolve_bearer_claims` (Supabase HS256 → legacy Rust JWT) and has no Firebase fallback.

Thus the main web flow `credentials: include` → `auth-token=<Firebase ID token>` → `/api/auth/refresh` still returns auth failure. Adding the external route alias alone does not fix F2.

**Exact W1b fix:** inject `FirebaseService` into `refresh`; after dual-JWT failure, verify the Firebase token, require a non-empty verified email, fetch the fresh `users` row by email, use its app `user_id`, and mint the legacy JWT. Factor this identity resolution with `/me` to avoid divergent verification logic. Add a network-free test via a mockable verifier/helper proving Firebase-cookie fallback reaches the app user ID.

### F3 — Firebase login parity: **PASS**

- Required token/email/uid fields produce explicit web-compatible 400 JSON.
- Firebase signature/audience/issuer verification is retained.
- UID and optional email claim are checked against request values.
- Verification and identity mismatches map to 403.

### F4 — register error paths: **PASS for agreed web parity**

- Email-exists maps to 400 JSON rather than 500.
- Username collision is handled by F1.
- A profile-row failure after Supabase user creation is non-fatal, matching the cited web route and avoiding a false client failure.

Operational note: success without an app row can leave a temporarily unusable FK identity; this is inherited contract behavior. A later reconciliation job or compensating Supabase delete would be stronger, but it does not block W1b parity acceptance.

## `/me` hardening: **PASS**

- `user-session` JSON is no longer an identity source.
- Credential must be Bearer or `auth-token` cookie.
- Supabase/legacy JWT verification plus Firebase fallback is performed.
- A fresh DB row by verified email is required; response ID/name/verification status come from DB.
- Invalid/missing credentials or rows return 401 and clear both auth cookies.

No token contents or service-role secrets are logged.

## Cookie policy: **PASS with production requirements**

- `COOKIE_SAMESITE` validates `lax|none|strict`.
- `SameSite=None` forces `Secure=true`.
- `COOKIE_HTTP_ONLY` is configurable; local compatibility defaults are preserved.
- Both issued cookies use the same effective policy.

Required production values for public cross-site Vercel → Cloudflare deployment:

```env
COOKIE_SAMESITE=none
COOKIE_SECURE=true
COOKIE_HTTP_ONLY=true  # preferred when browser JS does not need auth-token
```

If legacy frontend JavaScript must read `auth-token`, `COOKIE_HTTP_ONLY=false` preserves compatibility but retains XSS token-exfiltration risk. Cross-site cookie logout/clear behavior should receive one browser E2E test because `expired_cookie` does not mirror the configured SameSite/Secure attributes (name/path matching is normally sufficient, but third-party cookie policy varies).

## No new security regression found

- Supabase tokens are signature-verified with HS256 and expiry validation; no decode-without-verify path.
- Legacy JWT fallback remains available.
- Firebase verification remains RS256/JWKS/audience/issuer constrained.
- Supabase Admin key is env-only and masked in `Debug`.
- `/me` removes the previous unsigned-cookie trust flaw.

The remaining Firebase-refresh gap is functional/auth parity, not an authorization bypass.

## Externally-owned blockers before production

### P1 — refresh alias is not mounted (**blocking**)

`api/auth.rs::alias_config` exists but is unused. Routes owner must add in `backend/src/api/routes.rs::config`:

```rust
cfg.service(web::scope("/api").configure(auth::alias_config));
```

Add an integration route test proving both `/api/v1/auth/refresh` and `/api/auth/refresh` resolve to the same handler.

### P2 — credentialed wildcard CORS in `main.rs` (**security blocking**)

Current `allow_any_origin().supports_credentials()` is unsuitable for the public backend. Main/deployment owner must:

- allow only configured `FRONTEND_URL` origins (support a comma-separated allowlist for preview/prod if needed),
- retain required methods/headers and preflight handling,
- use `supports_credentials()` only with explicit origins,
- add CORS tests rejecting an untrusted Origin and accepting the configured Vercel origin.

### P3 — production env validation (**deployment blocking**)

Before public launch, fail fast or emit a hard startup error when public mode uses insecure cookie settings; document Cloudflare/Vercel origin and credential behavior. This belongs to `main.rs`/deployment ownership.

## Required final W1b rework

1. Add Firebase ID-token fallback to `/refresh`, resolving a fresh app user by verified email before minting the legacy token.
2. Add targeted tests for Firebase-cookie refresh identity resolution.
3. Re-run `cargo test --test auth` and `cargo check --lib --tests`.
4. Update `w1b-rework.md` evidence.

After those items, W1b itself can be ACCEPTED; production readiness still waits on P1–P3 owned by the routes/main/deployment phase.
