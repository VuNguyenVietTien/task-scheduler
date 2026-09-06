# Sol/high Review — Backend Platform Hardening

**Verdict: REWORK**  
**Date:** 2026-08-31  
**Mode:** read-only review; no source/config edits.

## Reviewed scope

- Plan/report: `plans/reports/herdr-260831-backend-platform-hardening.md`
- Owned diff:
  - `backend/src/main.rs`
  - `backend/src/api/routes.rs`
  - `backend/src/config.rs`
  - `backend/.env.example`
  - `backend/src/migration_runner.rs`
  - `backend/src/bin/migrate.rs`
  - `backend/tests/platform/main.rs`
- Supporting read-only evidence: current migration chain, auth alias definition, Docker Compose contract, prior architecture review.

## Findings

### F1 — P0: migration command is compiled but not operational for a supported fresh database

**Evidence**

- Both runners embed every file under `backend/migrations/` (`src/migration_runner.rs:5`, `src/bin/migrate.rs:6`) and execute the chain in version order.
- The first migration, `20230705000001_create_plans_table.sql:2-6`, creates `plans` with foreign keys to `projects` and `users`.
- Those referenced tables are not created until `20250319000000_create_initial_schema.sql:16,43`.
- The next pre-baseline migration also references `projects`, `plans`, `tasks`, `users`, and `task_status` before the baseline defines them.
- The implementation report itself acknowledges that an empty database fails on the first migration.
- No platform test executes `MIGRATOR.run` against an empty/current database; compile success does not verify migration behavior.

**Impact**

`cargo run --bin migrate` now exists, but it cannot initialize the documented fresh PostgreSQL setup. `RUN_MIGRATIONS=true` likewise makes first boot fail. This does not satisfy the P0 “reliable migration command” gate.

The migration files are outside this lane’s ownership, but that makes this an integration blocker—not an acceptable completed deliverable. Coordinate with the DB owner, reconcile/version the authoritative chain, then provide empty/current/restored-state migration evidence.

### F2 — P1: readiness can report ready with missing/outdated schema and has no bounded query timeout

**Evidence**

- `health_ready` only runs `SELECT 1` (`src/api/routes.rs:30-36`). It does not verify `_sqlx_migrations`, required schema objects, or pending embedded migrations.
- `RUN_MIGRATIONS` defaults false (`src/config.rs:229`), so a reachable PostgreSQL instance with an absent or stale schema returns `200 {status:"ready"}`.
- The readiness query has no endpoint-level timeout. Pool acquisition is globally bounded at 30 seconds in `main.rs`, but a query on an acquired unhealthy connection is not bounded here.
- Tests cover Boolean status mapping and an unavailable lazy pool, not stale-schema readiness or a hung query.

**Impact**

Deploy/blue-green traffic can be sent to a release that cannot execute application queries. A slow/hung dependency can also make the probe itself exceed proxy/orchestrator budgets.

**Required rework**

Add a short readiness timeout and a migration/schema status check appropriate to the reconciled migration strategy. Test at least DB unavailable, schema/migrations stale, and ready states.

### F3 — P1 security: `APP_ENV=production` still accepts insecure auth-cookie defaults

**Evidence**

- Production parsing defaults `COOKIE_SECURE=false`, `COOKIE_HTTP_ONLY=false`, and `COOKIE_SAMESITE=lax` when variables are absent (`src/config.rs:196-204,222-225`).
- Production validation checks origins and secrets but not cookie policy (`src/config.rs:266-275`).
- `production_defaults_bind_all_interfaces_and_parse_migration_flag` successfully constructs a production config without any cookie variables (`tests/platform/main.rs:56-69`).
- The server always enables credentialed CORS (`src/api/routes.rs:79`), and the mounted auth flow issues/consumes cookies.
- `.env.example` documents secure production values, but documentation is not fail-fast validation.

**Impact**

A production misconfiguration can boot while issuing non-Secure, script-readable auth cookies. This leaves the production validation item incomplete and preserves the previously recorded XSS/token-exfiltration and transport downgrade risk.

**Required rework**

For production cookie-enabled operation, reject or hard-fail insecure cookie policy. At minimum require `COOKIE_SECURE=true`; require `HttpOnly` unless an explicitly selected compatibility mode documents why browser JavaScript must read the token. Keep the existing `SameSite=None => Secure` safeguard.

### F4 — P1 security/operations: production bind silently defaults to all interfaces

**Evidence**

- When neither canonical nor alias host is set, production chooses `0.0.0.0` (`src/config.rs:157-165`).
- The platform test explicitly locks in this behavior (`tests/platform/main.rs:56-63`).
- `HOST` fallback already fixes the Docker/Compose mismatch, so a broad production default is not needed for existing containers.
- The approved Ubuntu topology calls for the Rust service behind a local reverse proxy/Tunnel and recommends loopback binding for a host service.

**Impact**

Omitting one production variable broadens the listener instead of failing safely. Firewall/reverse-proxy mistakes can expose the Rust origin directly.

**Required rework**

Require an explicit production bind host, or retain loopback as the safe default and let containers explicitly set `HOST=0.0.0.0`/`SERVER_HOST=0.0.0.0`.

## Areas accepted

### Route alias — PASS

- `web::scope("/api").configure(auth::alias_config)` correctly mounts the existing `/auth/refresh` alias beside `/api/v1` (`src/api/routes.rs:95-97`).
- Static routing and the platform test confirm both `/api/v1/auth/refresh` and `/api/auth/refresh` are registered.
- Test quality note: the current assertion only proves “not 404/405” and permits a 500 due to absent app data. A full app-data route test would be stronger, but the mount itself is correct.

### Health semantics — PARTIAL

- `/health/live` is process-only and does not query PostgreSQL: correct.
- DB failure maps readiness to 503 with a stable body: correct.
- F2 blocks acceptance because readiness does not establish application/schema readiness and is not time-bounded.

### Credentialed CORS — PASS

- Wildcard origin handling was removed.
- Exact configured origins, explicit methods/headers, credentials, mismatch blocking, and default `Vary: Origin` behavior are compatible and safe.
- Production rejects wildcard and non-HTTPS origins.
- The integration test proves exact allowed-origin reflection and rejection of an untrusted origin.
- Non-blocking coverage gap: add a real preflight test for `Authorization`/JSON and assert requested method/header handling.

### Bind/env aliases — PARTIAL

- `SERVER_HOST`/`SERVER_PORT` precedence with `HOST`/`PORT` fallback is correct and tested.
- Port parsing and zero-port rejection are correct.
- F4 blocks the unsafe production default.

### Regression/scope — PASS

- Owned files match the reported lane.
- No auth, GraphQL schema/resolver, or migration SQL file was modified by this lane.
- W1b auth integration tests remain green.

## Independent verification

Run from `backend/` unless noted:

- `cargo test --test platform` → **PASS: 6 passed, 0 failed**
- `cargo test --test auth` → **PASS: 21 passed, 0 failed**
- `cargo test --lib config::tests` → **PASS: 4 passed, 0 failed**
- `cargo test --lib api::routes::tests` → **PASS: 1 passed, 0 failed**
- `cargo check --lib --tests --bin migrate` → **PASS**, warnings only
- `rustfmt --edition 2021 --check` on owned Rust files → **PASS**
- `git diff --check` on all owned files → **PASS**
- DB-backed migration execution → **not runnable in this environment** (`DATABASE_URL` unset); static ordering proves the documented empty-DB failure, and no automated migration behavior test exists.

## Final verdict

**REWORK.** Route alias, basic liveness/readiness mapping, exact CORS, env aliases, build, and regression tests are good. Acceptance is blocked by the non-functional fresh-database migration path, readiness that ignores migration/schema state, production cookie policy that still fails open, and an unnecessarily broad production bind default.

**Unresolved questions:** the DB owner must choose the authoritative forward-only migration strategy for already deployed databases before the platform migration/readiness gate can be accepted.
