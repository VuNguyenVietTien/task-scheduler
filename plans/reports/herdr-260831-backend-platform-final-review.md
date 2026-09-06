# Sol/high Final Independent Review — Backend Platform Rework

**Verdict: REWORK**  
**Date:** 2026-08-31  
**Mode:** read-only source review and targeted tests; no source/config edit, deploy, or commit.

## Scope

Reviewed:

- `plans/reports/herdr-260831-backend-platform-review.md`
- Rework section of `plans/reports/herdr-260831-backend-platform-hardening.md`
- Current platform/migration diff and `backend/tests/platform/**`

This review is limited to closure of F1–F4.

## Closure matrix

| Finding | Result |
|---|---|
| F1 migration ordering/checksum/existing DB/baseline | **PARTIAL — blocking baseline risk remains** |
| F2 readiness timeout + migration currency | **PARTIAL — timeout closed, currency still fail-open** |
| F3 production cookie fail-fast | **CLOSED** |
| F4 safe production bind | **CLOSED** |

## Blocking findings

### F1 — REWORK: bootstrap and existing-history paths pass, but `--baseline` can certify an incomplete or empty schema as fully current

Confirmed good:

- Migration SQL files are unchanged; `git diff -- backend/migrations` is empty.
- Fresh bootstrap executes the same embedded migration objects/checksums in dependency order, with the 2025 initial schema before plans/reports.
- A stock `sqlx::migrate!` run succeeds after bootstrap, independently proving checksum compatibility.
- An existing five-version database clone migrates only the two pending versions; no previously applied migration is re-executed.
- The original `task_scheduler_db` remained at 5 successful rows, max version `20250501000000`, after evidence tests.

Blocking baseline behavior:

- `run()` checks `schema_marker_exists` before recommending baseline (`src/migration_runner.rs:157-164,192-198`), but `baseline()` itself does **not** require even that marker (`:212-247`). It can be invoked directly on an empty database.
- `baseline()` marks **all embedded versions** successful without validating the tables, columns, enums, constraints, or which historical version the existing schema actually represents.
- The live Case C test creates only `users`, runs baseline, then asserts `projects` does not exist while `probe_state` reports `Current`. This is direct evidence that a structurally unusable database can be certified as fully migrated.
- Baseline inserts rows one by one after the empty migrator releases its advisory lock; the marking loop is not one transaction/lock. A concurrent normal migration can observe partial synthetic history.
- Source comments call baseline idempotent, while the implementation intentionally refuses a second call. This is documentation drift, though not the blocking defect.

Impact: a typo/operator misunderstanding around `cargo run --bin migrate -- --baseline`, or a partially imported legacy schema, can produce a green migration history without the required application schema. Future stock migration runs then skip every migration because all seven versions are recorded.

Required rework:

1. Refuse baseline on an empty database.
2. Validate a versioned schema fingerprint/required objects before marking history; do not equate a single `users` table with parity.
3. Baseline only the versions actually represented by that validated schema, not automatically the complete latest chain.
4. Hold the SQLx advisory lock and use one transaction while writing synthetic history.
5. Reject unknown CLI arguments so a misspelled baseline flag cannot silently run the normal path.

### F2 — REWORK: readiness is time-bounded, but migration “Current” is not a trustworthy currency check

Confirmed good:

- `health_ready` wraps `SELECT 1` plus migration probing in one 1,500 ms `tokio::time::timeout` (`src/api/routes.rs:17-21,41-55`).
- DB down/timeout/missing/dirty/stale states map to 503; only `MigrationState::Current` maps to 200.
- Unit/endpoint tests cover the decision matrix and unavailable pool.

Blocking currency behavior:

- `probe_state` reads only `(version, success)` and classifies the DB as current when the **largest** successful version is `>= latest_embedded_version` (`src/migration_runner.rs:253-269`).
- It does not verify that every embedded version exists, that no interior version is missing, that checksums match, or that an ahead/unknown version is compatible.
- The live Case C test proves the consequence: a database containing only `users` plus synthetic history is classified `Current`; `/health/ready` would return 200 although core tables such as `projects` are absent.

Required rework: make readiness currency validate the complete embedded version/checksum set (and explicitly classify ahead/unknown histories), or use an equally strong schema contract. Add live endpoint/probe tests for missing interior version, checksum mismatch, ahead history, and partial-baseline schema.

## Closed findings

### F3 — CLOSED: production cookies fail fast

- Production requires `COOKIE_SECURE=true`.
- Production requires `COOKIE_HTTP_ONLY=true` unless `COOKIE_JS_COMPAT=true` is explicitly selected.
- Missing/insecure defaults fail configuration construction.
- Explicit compatibility mode remains Secure and visibly accepts the documented JavaScript/XSS trade-off.
- `SameSite=None` cannot bypass the raw production Secure requirement.
- Tests cover insecure defaults, hardened mode, and explicit compatibility mode.

### F4 — CLOSED: safe bind behavior

- Missing `SERVER_HOST`/`HOST` now defaults to `127.0.0.1` in every environment.
- `SERVER_*` retains precedence over `HOST`/`PORT` aliases.
- Containers/public listeners must explicitly opt into `0.0.0.0`.
- Tests cover safe production default and explicit public container bind.

## Independent verification

Run from `backend/` unless noted:

- `cargo test --test platform` → **12 passed, 0 failed, 3 ignored**
- `cargo test --test platform -- --ignored --test-threads=1` → **3 passed, 0 failed** against live local PostgreSQL
  - Case A fresh bootstrap/stock checksum compatibility: pass
  - Case B existing DB forward-only: pass and **not skipped**
  - Case C schema-without-history/baseline behavior: pass; also exposes F1/F2 risk above
- `cargo test --lib migration_runner::tests` → **3 passed**
- `cargo test --lib config::tests` → **4 passed**
- `cargo test --lib api::routes::tests` → **1 passed**
- `cargo test --test auth` → **21 passed**
- `cargo check --lib --tests --bin migrate` → **pass**, warnings only
- `cargo fmt --check` → **pass**
- Owned `git diff --check` → **pass**
- Post-test PostgreSQL check → **0** `platform_evidence_*` databases remain; source development DB still has **5** successful migration rows with max version `20250501000000`.

## Final verdict

**REWORK.** F3 and F4 are genuinely closed. F1’s fresh bootstrap, checksum compatibility, and existing-history path are substantially improved and pass live PostgreSQL evidence, while F2’s timeout is correctly closed. Acceptance remains blocked because explicit baseline can mark an empty/partial schema as the complete latest chain, and readiness trusts that synthetic/incomplete history without version-set or checksum validation.

**Unresolved questions:** none; the remaining work is confined to baseline validation/atomicity and strong migration-currency probing.
