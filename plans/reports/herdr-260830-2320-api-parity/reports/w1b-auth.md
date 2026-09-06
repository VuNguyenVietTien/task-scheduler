# W1b — Auth Parity (Phase 2) Report

**Agent:** w1b-auth | **Run:** herdr-260830-2320-api-parity | **Status:** COMPLETE (resumed run; prior session had produced `config.rs` + `auth/supabase.rs` only)

## 1. Resume triage (worktree preserved)

Worktree on resume (`feat/vercel-supabase-migration`):
- `backend/src/config.rs` — modified (Supabase env fields + Default + tests) — prior W1b session. KEPT.
- `backend/src/auth/supabase.rs` — new, complete but **unwired** (not in `mod.rs`). KEPT + wired.
- No `backend/tests/` existed.

During this session, concurrent W1a edits appeared in `graphql/types/**`, `graphql/resolvers/**`, `schema.graphql` (naming/enums phase). **Untouched and preserved.** A stray empty file `backend/&1` (0 bytes) also appeared — likely another agent's shell redirect artifact; not deleted (outside my ownership).

## 2. Delivered — dual JWT verification + identity resolution

- `backend/src/auth/mod.rs` — wired `supabase`, new `identity`, new `cookies` modules (+ re-exports).
- `backend/src/auth/identity.rs` (new) — single entry point `resolve_bearer_claims(token, db, config)`:
  1. Supabase HS256 (`SUPABASE_JWT_SECRET` configured) → verify → resolve app `users.user_id` by email (web parity: `appUser?.user_id ?? authUser.id` fallback to Supabase auth UUID),
  2. fallback to legacy Rust JWT (`JWT_SECRET`) — mobile keeps working.
  Pure mappers `claims_from_supabase` / `claims_from_legacy` (unit-tested, no I/O).
- `backend/src/graphql/handlers.rs` — Bearer extraction now calls `identity::resolve_bearer_claims`; raw tokens no longer logged (was: full Authorization header to stderr).
- `backend/src/graphql/context.rs` — **unchanged** (struct `auth: Option<Claims>` still satisfied by resolved claims; zero resolver churn → B3 fixed without touching non-owned resolver files).
- `backend/src/auth/supabase.rs` — prior-session module (verify, identity-by-email, `SupabaseAdminClient` with Admin createUser/generateLink, no hardcoded secrets). Unchanged except rustfmt.

## 3. Delivered — REST auth parity (`backend/src/api/auth.rs`)

Mounted under existing `/api/v1/auth` scope (`api/routes.rs` — not modified, not owned):

| Route | Parity target | Behavior |
|---|---|---|
| `POST /firebase/login` | `web/.../firebase/login/route.ts` | Firebase ID token verified (+UID match); app `users` row upserted **email-first** (`AuthService::upsert_user_by_email`); Supabase auth user ensured + magic-link generated (`session.properties.email_otp`); sets `auth-token` + `user-session` cookies (24h, lax, non-httpOnly, `COOKIE_SECURE`); responds `{success, user{id,email,name}, session}` |
| `GET /me` | `web/.../me/route.ts` | Cookie session first (user-session JSON), then Bearer dual-verify + fresh `users` row; `{user:{id,email,name,emailVerified}}`; 401 `{user:null}` |
| `POST /logout` | `web/.../logout/route.ts` | Expires both cookies; `{success, message}` |
| `POST /register` | `web/.../register/route.ts` | Validation (email/min-length); when Supabase configured → Admin createUser `email_confirm:false` (ignores already-registered); app row via legacy `register()`; responds web shape `{success, message, user}` + legacy fields (`user_id/email/name/token`) for mobile |
| `POST /resend-verification` | web proxy expects `{user:{id,email,emailVerified}}` | Bearer dual-verify → users row → Supabase magic link when unverified & configured |
| `POST /refresh` | `web/src/lib/api.ts` | Bearer dual-verify → mints fresh **legacy** JWT for resolved UUID; `{token, access_token, token_type, expires_in}` |

Supporting: `backend/src/auth/cookies.rs` (new) — `auth-token`/`user-session` cookie builders + parser (pure, tested); `backend/src/auth/service.rs` — added `upsert_user_by_email` (uid → email → insert); `register_firebase_user` refactored onto it (same public signature).

## 4. Config & env (no secrets)

- `backend/src/config.rs` — prior-session fields kept: `supabase_url`, `supabase_service_role_key`, `supabase_jwt_secret`, `firebase_project_id`, `cookie_secure`, `frontend_url`; all optional (`unwrap_or_default`) — backend boots on plain local Postgres (D1 dual-db). Helpers `supabase_auth_configured()` / `supabase_jwt_configured()` gate every Supabase path.
- `backend/.env.example` — documented optional Supabase/Firebase/cookie vars, commented out, "NEVER commit real values".
- `backend/Cargo.toml` — **no changes needed** (jsonwebtoken 8.3, reqwest 0.11 json, base64 0.22, chrono, tokio already present).

## 5. Tests (no real network)

- `backend/tests/auth/main.rs` (new, 10 tests, all pass): Supabase verify (valid/wrong-secret/expired/missing-secret), dual resolution prefers Supabase, legacy fallback, garbage rejection, identity→claims mapping (app UUID wins / auth-UUID fallback), cookie round-trip, already-exists error detection. DB-free via `connect_lazy` pool (legacy path performs no queries; Supabase-path identity failure is soft by design, 250ms acquire timeout).
- In-module tests: `supabase.rs` (6), `identity.rs` (4), `cookies.rs` (4), `api/auth.rs` (1 bearer parsing). `config.rs` optional-vars tests (2). All pass.
- Pre-existing owned-file test bugs fixed while here: `auth/token.rs` `verify_access_token` mis-classified `ExpiredSignature` as `TokenVerification` (test_expired_token now passes); `auth/password.rs` test asserted `unwrap_or(true)` against an `Err`-on-mismatch API (fixed to `unwrap_or(false)`).

## 6. Verification results

- `cargo check --lib --tests`: **0 errors** (after including concurrent W1a edits; warnings pre-existing).
- `cargo test --lib auth::`: **25/26** — only `auth_common::tests::test_token_flow` fails: pre-existing test hard-requires real `DATABASE_URL` (network); left as-is per no-network constraint.
- `cargo test --test auth`: **10/10 pass**. `config::tests`: **2/2 pass**.
- Targeted `rustfmt --edition 2021` applied to all edited files.

## 7. Not done / notes for W1a & manager

- W1a compile errors: none encountered in final state (0 errors); their `graphql/**` edits compile alongside mine.
- `graphql/context.rs` intentionally unchanged — resolution happens in handler; resolvers read the same `Option<Claims>`.
- `/api/auth/me` Bearer path queries `users.email_verified` — column verified present (already used by `auth_common::get_auth_info_from_token`).
- Web `/api/auth/register` inserts users row keyed by Supabase auth UUID (`id` column); Rust app row keeps `user_id` PK + email mapping — dual-db D1 decision respected; reconcile at Phase 3 if `users.id` column parity is needed.
- No commit/push/deploy performed. Browser work not needed (browsermcp unused).

## 8. Files touched (all within ownership)

Modified: `graphql/handlers.rs`, `auth/mod.rs`, `auth/service.rs`, `auth/token.rs`, `auth/password.rs`, `auth/jwt.rs`, `auth/auth_common.rs` (test-config `..Default::default()` only), `api/auth.rs`, `config.rs` (prior session), `.env.example`.
New: `auth/identity.rs`, `auth/cookies.rs`, `tests/auth/main.rs` (+ prior-session `auth/supabase.rs`).

**Unresolved questions:** (1) Should `/me` cookie path also validate `auth-token` signature (currently web-parity: trusts user-session JSON)? (2) `/register` response unions web + legacy shapes — confirm mobile tolerates extra fields. (3) Stray `backend/&1` file ownership/cleanup.
