# W1b Final Auth Rework — Firebase Refresh Fallback

**Status:** Complete
**Review input:** `sol-review-w1b-final.md`

## Changes

Final rework touched only W1b-owned files:

- `backend/src/api/auth.rs`
- `backend/tests/auth/main.rs`

`backend/src/api/routes.rs` and `backend/src/main.rs` were not modified.

### Shared identity resolution

Added one shared issuer-to-app-identity flow used by both `/me` and `/refresh`:

- `verified_firebase_email` (`api/auth.rs:77`): requires a non-empty Firebase email and `email_verified == Some(true)`.
- `resolve_app_identity_with_fallback` (`api/auth.rs:94`): mockable orchestration that attempts Supabase/legacy verification first, falls back to Firebase only on failure, then resolves the verified email through an injected fresh app-user lookup.
- `load_app_identity_by_email` (`api/auth.rs:121`): reloads `users.user_id`, email, display name, and verification state from PostgreSQL by verified email; missing app identity is unauthorized.
- `resolve_app_identity` (`api/auth.rs:152`): production adapter using existing `identity::resolve_bearer_claims`, `FirebaseService::verify_token_and_get_claims`, and the fresh DB lookup.

`/me` (`api/auth.rs:421`) now uses the shared resolver rather than its previous independent Firebase fallback.

### `/refresh` fix

`refresh` (`api/auth.rs:528`) now injects the existing `FirebaseService` and resolves identity in this order:

1. Supabase HS256 JWT.
2. Legacy Rust JWT.
3. Firebase ID token via `FirebaseService::verify_token_and_get_claims`.
4. Require Firebase `email_verified=true` and a non-empty email.
5. Reload the canonical app user by email.
6. Mint the legacy JWT using the fresh app `users.user_id`, DB email, and DB display name.

This makes the `auth-token=<Firebase ID token>` cookie written by `/firebase/login` valid for `/refresh` while preventing unverified Firebase email claims from selecting an app identity.

## Network-free targeted tests

Added to `backend/tests/auth/main.rs`:

- `firebase_cookie_fallback_resolves_fresh_app_user_id` (`:252`): mocked dual verification fails, mocked verified Firebase email succeeds, mocked fresh app lookup returns a known UUID; assertion proves the selected/minted identity is the app user ID.
- `firebase_cookie_fallback_rejects_unverified_or_empty_email` (`:282`): covers `email_verified=false`, blank email, and missing email; verifies app lookup is never invoked.

No Firebase, Supabase, or PostgreSQL network connection is used by these tests.

## Verification evidence

Final commands after formatting:

```text
cargo test --test auth
 test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.26s

cargo check --lib --tests
 cargo_check_exit=0 errors=0
 Finished `dev` profile [unoptimized + debuginfo] target(s) in 5.16s
```

`git diff --check -- backend/src/api/auth.rs backend/tests/auth/main.rs` also passed with no whitespace errors.

Only existing compiler warnings remain. The pre-existing DB-dependent `auth_common::tests::test_token_flow` was not changed and is separate from the required network-free final checks.

## External ownership note

The previously documented `/api/auth/refresh` alias mount and credentialed CORS hardening remain owned by `routes.rs` / `main.rs` owners and were intentionally not changed here.

No commit, push, or deploy was performed.
