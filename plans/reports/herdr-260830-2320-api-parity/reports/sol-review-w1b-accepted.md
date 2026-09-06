# Sol Review — W1b Final Auth Rework

**Verdict: ACCEPT**  
**Date:** 2026-08-31  
**Mode:** read-only source/config review; this report is the only written artifact.

## Scope reviewed

- `reports/sol-review-w1b-final.md`
- `reports/w1b-rework-final.md`
- `backend/src/api/auth.rs`
- `backend/tests/auth/main.rs`
- Supporting token/identity code needed to verify the minted JWT subject

## Acceptance verification

### Firebase cookie refresh fallback — PASS

- `/refresh` still selects `Authorization: Bearer` first and otherwise accepts the `auth-token` cookie.
- `resolve_app_identity` first invokes the existing Supabase/legacy resolver and invokes Firebase verification only when that path fails.
- Firebase fallback uses `FirebaseService::verify_token_and_get_claims`; it therefore retains Firebase signature, algorithm, audience, issuer, and expiry validation.
- `verified_firebase_email` requires `email_verified == Some(true)` and rejects absent or blank email claims before any app-user lookup.
- A successfully verified email is resolved through a fresh PostgreSQL query for `users.user_id`, DB email, DB display name, and verification state. A missing app row is unauthorized; database errors are not hidden.
- The new tests prove a verified Firebase-cookie fallback reaches a known fresh app-user UUID and prove unverified, blank, and absent emails never invoke app lookup.

### Minted legacy JWT uses the app `user_id` — PASS

`refresh` passes `app_identity.user_id` to `auth_common::create_token`. That function forwards the UUID to `token::create_access_token`, whose `Claims::new` writes it to `sub`. The fresh DB identity—not the Firebase UID—is therefore the subject of the returned legacy JWT.

The helper-level fallback test and the existing token creation/verification test independently cover identity selection and JWT subject serialization. An endpoint-level mock-Firebase/DB test would be stronger coverage but is not required to accept this narrowly scoped fix.

### Supabase and legacy behavior — PASS

- Verification order remains Supabase HS256, then legacy Rust JWT, before Firebase fallback.
- Existing network-free tests continue to prove valid Supabase selection, legacy fallback, and rejection of invalid tokens.
- Both accepted JWT issuers now converge on the same fresh canonical app-user lookup used by `/me`; Firebase handling does not replace or bypass either verifier.

### Scope discipline — PASS

The final rework is confined to the reported W1b files:

- `backend/src/api/auth.rs`
- `backend/tests/auth/main.rs`

No route-mount, CORS, deployment, commit, push, or deploy change is part of this final pass. The working tree contains cumulative earlier W1a/W1b changes, so Git cannot isolate the final pass as a standalone commit; inspection found no final-fix logic outside the two reported files.

## Independent commands

Run from `backend/` unless noted:

- `cargo test --test auth` → **PASS: 21 passed, 0 failed**
- `cargo check --lib --tests` → **PASS**, warnings only
- `cargo test --lib auth::token::tests::test_token_creation_and_verification` → **PASS: 1 passed**
- `cargo test --lib auth::identity::tests` → **PASS: 4 passed**
- `git diff --check -- backend/src/api/auth.rs backend/tests/auth/main.rs` → **PASS**

## Non-W1b production blockers

Acceptance closes the Firebase-cookie `/refresh` defect identified in the prior review. It does not clear the separately owned production blockers already recorded there: mounting the `/api/auth/refresh` alias, replacing credentialed wildcard CORS, and enforcing production cookie/environment policy.

## Final verdict

**ACCEPT.** The final W1b rework satisfies the requested Firebase cookie fallback, verified-email gate, fresh app-user resolution, canonical app-user JWT subject, issuer compatibility, tests, and scope boundary.

**Unresolved questions:** none within W1b final-rework scope.
