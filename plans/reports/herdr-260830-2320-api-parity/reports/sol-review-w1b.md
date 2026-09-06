# Sol Review — W1b Auth Parity (Phase 2)

**Reviewer:** sol (high rigor) | **Target:** `reports/w1b-auth.md` | **Branch/worktree:** `feat/vercel-supabase-migration` (uncommitted, mixed with W1a)
**Method:** read full report; read every cited source file (`auth/identity.rs`, `auth/supabase.rs`, `auth/cookies.rs`, `auth/service.rs`, `auth/jwt.rs`, `auth/token.rs`, `auth/password.rs`, `auth/auth_common.rs`, `auth/error.rs`, `api/auth.rs`, `graphql/handlers.rs`, `config.rs`, `tests/auth/main.rs`), the diff vs HEAD, web contract routes (`firebase/login`, `me`, `logout`, `register`, `resend-verification`, `lib/api.ts`, `lib/graphql/context.ts`), schema migration; **re-ran tests** (not just trusting the report).

## Verdict: REWORK

Architecture is sound and most claims verified true, but one common-path 500 defect in new code plus three parity-claim inaccuracies must be fixed before accept. Scope of rework is small and localized to W1b-owned files.

---

## 1. Independent verification (what I ran)

| Command | Result | Report claim |
|---|---|---|
| `cargo test --test auth` | **10/10 pass** | ✓ verified |
| `cargo test --lib auth::` | **25 pass, 1 fail** (`auth_common::tests::test_token_flow` panics `DATABASE_URL must be set`) | ✓ verified, pre-existing |
| `cargo test --lib config::` | **2/2 pass** | ✓ verified |

`test_token_flow` pre-existence confirmed via diff: W1b only added `..Default::default()` to `create_test_config` + rustfmt; the `env::var("DATABASE_URL").expect(...)` at `auth_common.rs:57` is untouched legacy. Not a W1b regression. Integration tests are genuinely network-free (`connect_lazy` pool, 250ms acquire timeout — verified in `tests/auth/main.rs`).

## 2. Verified correct

- **Dual JWT verification** (`auth/identity.rs`): Supabase-first (gated on `SUPABASE_JWT_SECRET`), legacy fallback preserved for mobile. Algorithm pinned to HS256 *before* decode (alg-confusion/`alg:none` rejected — unit test covers a hand-crafted none token). `exp` validated. Garbage → error. Fallback logs do not leak tokens.
- **Identity mapping** (`supabase.rs` `resolve_supabase_identity` + `identity.rs`): email → `users.user_id`, fallback to Supabase auth UUID — matches `web/src/lib/graphql/context.ts` (`appUser?.user_id ?? authUser.id`). DB errors soft-fail to auth-UUID fallback (web parity). Pure mappers unit-tested.
- **Firebase verification** (`firebase/mod.rs::verify_id_token`, pre-existing): RS256-only, `kid` → Google certs, `aud=project_id`, `iss=securetoken.google.com/{project}`. Solid; called correctly from `firebase_login`.
- **Supabase Admin API** (`SupabaseAdminClient`): correct endpoints (`/auth/v1/admin/users`, `/auth/v1/admin/generate_link`), `apikey` + Bearer service-role headers, `email_confirm` semantics match web (`false` register / `true` firebase-login fallback), `already-registered` detection tested. No secrets in code; `Debug` masks the key.
- **REST shapes (success paths)**: `firebase/login` `{success, user{id,email,name}, session}` + cookies (24h, path=/, lax, non-httpOnly, `COOKIE_SECURE`) = exact web parity incl. storing app `user_id` in `user-session`; `logout` `{success,message}` + expiry; `/me` `{user}` / 401 `{user:null}`; `resend-verification` `{user:{id,email,emailVerified}}` — proxy reads `error.message` on failure and `AuthError` body does carry `message` ✓.
- **Route mounting**: new routes added inside existing `api/auth.rs` `config()` under `/api/v1/auth`; `routes.rs` untouched ✓.
- **Config/env safety**: all new fields optional with gating helpers; boots without Supabase; `.env.example` commented, no real values; no hardcoded secrets anywhere in diff.
- **GraphQL handler**: Bearer path now dual-resolves via `identity::resolve_bearer_claims`; raw token no longer logged (only length + email/sub); `context.rs` untouched; resolvers (W1a lane) preserved — confirmed via diff.
- **Test-fix claims** (`token.rs` ExpiredSignature, `password.rs` `unwrap_or(false)`): diffs match exactly what the report describes.

## 3. Findings requiring rework

### F1 (HIGH — functional bug, new code): username unique-constraint 500 in `upsert_user_by_email`
`backend/src/auth/service.rs:99-109` inserts `username = name` (display name / email local part) with **no collision handling**. Schema (`migrations/20250319000000_create_initial_schema.sql:21`): `username VARCHAR NOT NULL UNIQUE`. Two users whose display names or email local parts match (`john@gmail.com`, `john@outlook.com` → both `john`) → second `firebase_login` hits 23505 → `AuthError::Database` → **500 on a primary login path**. The cited web parity target (`firebase/login/route.ts`) explicitly handles this: sanitized base (`email.split('@')[0].replace(/[^a-zA-Z0-9_]/g,'_')`) + `_${Date.now()}` suffix retry loop + re-select fallback. The Rust port dropped that logic and also stores raw display names (spaces/unicode) as username.
**Exact fix** (in `upsert_user_by_email`):
```rust
let base = email_local_part(&email)
    .replace(|c: char| !(c.is_ascii_alphanumeric() || c == '_'), "_");
for suffix in ["", &format!("_{}", Utc::now().timestamp_millis())] {
    let username = format!("{}{}", base, suffix);
    match sqlx::query("INSERT INTO users (user_id, email, username, firebase_uid) VALUES ($1,$2,$3,$4)")
        .bind(user_id).bind(&email).bind(&username).bind(&firebase_uid)
        .execute(&self.db).await
    {
        Ok(_) => { /* created */ }
        Err(e) if matches!(&e, sqlx::Error::Database(d) if d.code().as_deref() == Some("23505")) => continue,
        Err(e) => return Err(e.into()),
    }
}
// final fallback: re-select by email (concurrent insert), mirroring web
```
(Legacy `register()` has the same latent collision — pre-existing; fix opportunistically or ticket it.)

### F2 (MEDIUM — false parity claim): `/refresh` does not match its cited contract
Report cites `web/src/lib/api.ts` as parity target. Actual consumer (`api.ts:30-51`, also `frontend/src/lib/graphqlClient.ts:20`): `POST ${NEXT_PUBLIC_BACKEND_URL}/api/auth/refresh` — **no `/v1`**, `credentials: 'include'` with **no Authorization header**, reads **`data.accessToken`** (camelCase). Delivered: `/api/v1/auth/refresh`, **Bearer required**, returns `{token, access_token, token_type, expires_in}`. As delivered it can never serve the cited consumer (three independent mismatches: path, credential source, field name). Note: the web caller looks stale — it also calls `/api/projects/...` (no `/v1`) elsewhere, so it predates this backend layout; the endpoint itself is well-built (dual-verify, UUID-parse guard, legacy mint).
**Exact fix (either):**
- (a) Correct the report/claim: state the real consumer contract (mobile/legacy Bearer + `access_token`) and record web `api.ts` refresh as stale/dead (it 404s today regardless) — manager decision, no code change; **or**
- (b) Actually serve web: add alias `POST /api/auth/refresh` (mount alongside `/api/v1`), accept `auth-token` cookie as credential when Bearer absent, and include `"accessToken": new_token` in the response body.

### F3 (MEDIUM — parity gaps in `firebase/login`)
1. Web checks `decodedToken.uid !== firebase_uid || decodedToken.email !== email`; Rust checks only UID (`api/auth.rs` `firebase_login`). **Fix:** also compare Firebase-claims email (if present) to `data.email`.
2. Web returns **403** on verification failure; Rust returns 401 (`AuthError::TokenVerification` → UNAUTHORIZED). **Fix:** map verification failures in this handler to `AuthError::Forbidden(...)` (already → 403) or a dedicated variant.
3. Missing-field validation: web → 400 `{error: 'Firebase token, email, and uid are required'}`; Rust relies on serde → actix default 4xx body, not the `{error}` shape. **Fix:** explicit field check returning `{ "error": ... }` 400.

### F4 (MEDIUM — register error-path divergence)
Web register: Supabase failure → 400 `{success:false, error}`; profile-insert failure → **non-fatal** (returns success). Rust: Supabase-create failure → 400 ✓, but app-row failure via `auth_service.register()` → email-exists returns `Database(RowNotFound)` → **500** (web: 400), username collision → 500, and any app-row failure is **fatal** after the Supabase user was already created (orphaned auth user, client told "failed"). **Fix:** in the `/register` handler catch email-exists → 400 `{success:false, error:"Email already exists"}`; treat app-row insert failure after successful Supabase createUser as non-fatal (log + still return `{success:true, message:...}` per web) or compensate by deleting the Supabase user; response-shape union (web + legacy fields) is acceptable additive divergence (report Q2 — fine).

## 4. Accepted with notes (no code change required in W1b)

- **N1 `/me` trusting `user-session` JSON (report Q1):** exact web parity — web route has the identical flaw (unsigned cookie echoed back, `emailVerified: true` hardcoded, and even carries a TODO admitting it). Forged `user-session` yields a 200 `{user:{...}}` echo of attacker-chosen data; risk is real if the frontend gates UI on `/me`. Inherited-by-parity, not a W1b regression. Recommend Phase-3 hardening (verify `auth-token` signature + fresh DB row on cookie path). One small parity miss worth fixing alongside F3: web **deletes both cookies** when the session JSON fails to parse; Rust returns 401 without clearing — add `expired_cookie` for both in that path.
- **N2 Cookie security / public Vercel→Cloudflare:** non-httpOnly cookies are a web-parity requirement (`api.ts getAuthHeaders` reads `auth-token` from JS) — inherited XSS exposure, flag for Phase 3. `SameSite=Lax` means the backend cookie paths are only exercised same-site (e.g. `app.example.com`→`api.example.com`) or via proxies; browser→API cross-site fetches won't carry them, so Bearer (and Next.js proxies forwarding Bearer, as `resend-verification` does) is the operative path — architecture works, but confirm deployment domains. `COOKIE_SECURE` defaults false: correct for local dev per D1, but a prod misconfiguration silently drops `Secure`. Recommend (outside W1b, main.rs owner): boot warning when `cookie_secure=false` and host is non-localhost.
- **N3 CORS (out of W1b ownership):** `main.rs:102-108` `allow_any_origin().supports_credentials()` — permissive credentialed CORS on a public backend. Pre-existing; Lax cookies limit practical abuse today, but tighten to `FRONTEND_URL` before public deploy. Route to manager / owner of `main.rs`.
- **N4 Test hygiene:** `config.rs` tests mutate process env (`set_var`/`remove_var`) — can race with `test_token_flow`'s `DATABASE_URL` read in the same `--lib` binary (currently fails benignly). Consider serializing or env-locking; pattern is pre-existing, new test follows it.
- **N5 Report accuracy (correct the report when reworking):** (a) files-touched omits rustfmt-only edits to `auth/middleware.rs`, `auth/error.rs`, `auth/types.rs` (verified formatting-only via diff — harmless, still should be listed); (b) `upsert_user_by_email` is described "email-first" but is actually **uid-first, then email** (behavior is *better* than described — binds existing Firebase accounts correctly); (c) stray `backend/&1` is now a 28 KB compiler-output artifact (report said 0 bytes) — not W1b's, but manager should delete it.

## 5. Ownership check

All functional edits confined to `auth/**`, `api/auth.rs`, `graphql/handlers.rs`, `config.rs`, `.env.example`, `tests/auth/` — W1b lane. W1a's `graphql/types/**`, `resolvers/**`, `schema.graphql` edits coexist and compile (test runs prove it). `routes.rs`, `context.rs`, `main.rs` untouched by W1b ✓.

## 6. Gate for ACCEPT

1. F1 fixed (username collision) — required.
2. F2 resolved (correct the claim **or** implement the alias/cookie/camelCase variant) — required.
3. F3 items 1–2 fixed (email check, 403); item 3 (400 `{error}` shape) strongly recommended.
4. F4 email-exists → 400 + non-fatal/compensated app-row failure — required.
5. Report §3/§8 corrected per N5.
Re-run: `cargo test --test auth`, `cargo test --lib auth::` (expect 25/26 + fixed pre-existing counting note), `cargo check --lib --tests` = 0 errors.

**Unresolved → manager:** (1) F2 option (a) vs (b) — is web `api.ts` refresh stale-dead (also implies `/api/projects` callers) or a contract to honor? (2) Delete `backend/&1` (28 KB cargo-output artifact). (3) Ticket N2/N3 hardening (cookie signature on `/me`, CORS allowlist, COOKIE_SECURE boot warning) to the `main.rs`/deployment owner for Phase 3.
