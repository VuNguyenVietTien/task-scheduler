# PM Backend Firebase GraphQL Auth Fallback — Independent Review

**Date:** 2026-09-01 09:26 | **Mode:** read-only (only this report + ledger event). No source edits/install/commit/push/deploy.
**Scope:** `backend/src/api/auth.rs`, `backend/src/graphql/handlers.rs` only (resolver/context reads for fail-closed verification; `git diff HEAD` to attribute new vs pre-existing behavior).
**Verdict: ACCEPT** — fallback chain correct, fail-closed verified, issuer order documented and implemented, Claims mapping canonical, test genuine and green, `cargo fmt -- --check` clean.

---

## 1. `resolve_graphql_claims_with_fallback` (handlers.rs)

- **Chain:** `primary_verify` (dual: Supabase HS256 → legacy Rust JWT via `identity::resolve_bearer_claims`, identity.rs:60–84) → on `Err` only, `firebase_verify` = `auth::resolve_app_identity` (re-runs dual, then Firebase ID-token verification → `verified_firebase_email` gate). Issuer order **Supabase → legacy → Firebase** matches the documented order in `/refresh` (auth.rs doc-comment) and W2 transport expectations. ✅
- **Firebase gate:** `verified_firebase_email` (auth.rs:74–85) requires `email_verified == Some(true)` **and** non-empty email before email-based user lookup — unverified Firebase emails cannot authenticate. ✅
- **Claims synthesis:** `Claims::new(identity.user_id.to_string(), email, display_name, 1h)` — `sub` = canonical app `users.user_id` UUID (not the Firebase UID), resolved from the DB row (`load_app_identity_by_email`). `exp = iat + 1h` (types.rs:36–47); synthesized fresh per request, never minted into a token or cached → no stale-expiry path. ✅
- **Fallback identity re-verification note (O1, non-blocking):** the fallback closure re-runs the full dual verification inside `resolve_app_identity` for a token that already failed it — redundant work per failed token, deterministic and correctness-neutral.

## 2. `graphql_handler` injection

- Bearer extraction via `strip_prefix("Bearer ")` (no Basic/cookie confusion; `graphql_handler` is header-only — cookie flow is the REST layer's `bearer_or_auth_cookie`, correctly out of GraphQL scope). ✅
- On resolution success → `Some(claims)` into `Context { auth: Option<Claims> }`; on **any** resolution failure → `None` — no partial/anonymous claims are ever synthesized. ✅
- **Old → new (git diff HEAD):** previous code was legacy-JWT-only, set `display_name: jwt_claims.sub` (defect), and logged the **raw Authorization header**. New code fixes all three (no raw token logging — only length). Genuine hardening, no regression. ✅

## 3. Fail-closed behavior

Resolution failure yields `auth: None`; guarded resolvers reject anonymous context — spot-checked, all `ok_or_else`-style:
- `resolvers/project.rs:26–28, 208–210, 355` → `AuthError::Unauthorized("You must be logged in")`
- `resolvers/tasks/mutation/create.rs:19–22` → `AuthError::InvalidCredentials`; `task_resolver.rs:337` same
- `resolvers/plans/mutation.rs:63,93,133,155` + `plans/query.rs:21,45,65` → `AppError::forbidden`
No `unwrap`/`unwrap_or_default`/`if let Some` fail-open patterns found in guarded resolvers (`resolvers/auth.rs` register/login is intentionally anonymous). ✅

## 4. The new test

`firebase_fallback_provides_graphql_app_claims_when_primary_rejects_token` (handlers.rs tests): primary mock rejects → fallback mock returns `AppAuthIdentity` → asserts `sub == app_user_id`, canonical email, display_name, `!claims.is_expired()`. Mock-closure based (network-free, no Firebase SDK, no DB). Independent rerun: **1 passed, 0 failed** (58 filtered). ✅

## 5. Command verification (independent)

- `cargo fmt -- --check` → **exit 0, no diff** (with `backend/.env` loaded via `set -a; . ./.env`).
- `cargo test --lib graphql::handlers::tests::firebase_fallback_provides_graphql_app_claims_when_primary_rejects_token` → **ok** (0.01s).

## 6. Non-blocking observations

1. **O1** redundant dual re-verification in fallback closure (perf only, see §1).
2. **O2** handler `eprintln!`s full query, variables, and response JSON in the production path (pre-existing style retained). Variables/responses may carry sensitive content; recommend a debug gate in a follow-up. Raw-token leakage is fixed (length only).
3. **O3** `graphql_ws_handler` resolves no identity at all — pre-existing, untouched by this change; subscriptions execute anonymous. Follow-up candidate, out of scope here.
4. **O4** 116 compiler warnings in test build (dead code etc.) — repo-wide hygiene, not this change.

## 7. Residual questions (manager, non-blocking)

1. Should `graphql_ws_handler` gain the same fallback chain (O3) before subscriptions ship?
2. Production logging gate for query/variables/response dumps (O2)?

**Final: ACCEPT.** No blocking defects; change is a strict hardening over the legacy-only, raw-token-logging handler it replaces.
