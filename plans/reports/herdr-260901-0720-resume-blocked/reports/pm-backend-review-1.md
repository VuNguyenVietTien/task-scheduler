# PM Independent Final Review — Backend Platform/Migration Rework

**Verdict: ACCEPT**
**Date:** 2026-09-01
**Mode:** independent read-only review. Evidence limited to `backend/src/migration_runner.rs`, `backend/src/api/routes.rs`, `backend/src/bin/migrate.rs`, `backend/tests/platform/**`, `backend/migrations/**`, the two prior reports, and Cargo config for running tests. No production edits, no commit/push/deploy/delete. Live PostgreSQL evidence rerun only against isolated throwaway `platform_evidence_*` databases; cleanup verified afterwards.

## Blocker-by-blocker verification

### B1 — Empty/partial baseline refusal — CLOSED

- `baseline()` resolves `represented_version()`, which requires the FULL cumulative fingerprint (table count via `information_schema.tables … = ANY($1)`, plus every column and enum-label check) of some embedded version. An empty DB matches nothing (v1 needs 15 tables); a lone `users` table matches nothing.
- Refusal happens BEFORE any write; the whole validation+marking runs inside one transaction that is rolled back on refusal (rows only inserted after the fingerprint + `prefix_expressible` checks pass under the lock).
- Live evidence (rerun by me, Case A): `baseline()` on empty DB → error containing `baseline refused` / `ANY embedded version`. Case C2 (partial import, only `users`): refused, and `successful_migration_count == 0` proves zero synthetic rows were written.

### B2 — Full versioned fingerprint + represented-prefix correctness — CLOSED

I verified every fingerprint entry against the actual migration SQL line-by-line:

| Version | Fingerprint claims | Migration file evidence |
|---|---|---|
| 20250319 | 15 tables | `20250319…create_initial_schema.sql` has exactly 15 `CREATE TABLE` (users, projects, project_members, task_statuses, tags, tasks, task_tags, task_durations, comments, comment_mentions, attachments, snapshots, task_snapshots, notifications, activity_logs) |
| 20230705 | + `plans` | file creates only `plans` |
| 20240616 | + `reports`,`bugs`,`report_tasks`,`task_status_history` | file creates exactly those 4 |
| 20250408 | + `notifications.sender_id` | confirmed (multi-line `ALTER TABLE notifications ADD COLUMN sender_id …`) |
| 20250501 | + `users.fcm_tokens` | confirmed |
| 20260325 | + `reports.{rejected_tasks,on_schedule_percentage,delay_percentage}` + `member_role{manager,leader,guest}` | all confirmed (ALTER TABLE/ADD VALUE lines) |
| 20260328 | + `task_status` enum label `TODO` | confirmed (new uppercase enum type created) |

- Marking uses the **dependency prefix** `0..=index` (`represented_version_set`), not "all versions" nor naive "version ≤ represented": live Case C legacy schema at 20250501 → `BaselineMarked{marked:5, represented_version:20250501000000}`, probe `Stale`, then `ForwardOnly{applied:2}` → `Current` — proving not over-marked.
- `prefix_expressible()` correctly refuses v1-only/v2-only schemas (version order ≠ dependency order at chain head); unit test `dependency_prefixes_are_prefix_expressible_only_from_reports_on` pins the boundary (expressible only from index ≥ 2). Fingerprints cover every embedded version and the latest tracks the chain head (unit test).

### B3 — Advisory lock + single transaction, sqlx-compatible — CLOSED

- `baseline()` = one transaction: `BEGIN → pg_advisory_xact_lock(sqlx_lock_id(current_database())) → re-validate history/dirty → fingerprint → prefix check → CREATE TABLE IF NOT EXISTS _sqlx_migrations → INSERT … ON CONFLICT DO NOTHING (all rows) → COMMIT`. No lock-free window; concurrent migration cannot observe partial history.
- Lock-id algorithm independently verified against the actual dependency source (`~/.cargo/registry/src/.../sqlx-postgres-0.7.4` and `0.8.6` `migrate.rs`): `0x3d32ad9e * CRC_32_ISO_HDLC(db_name)` — byte-identical to `migration_runner::sqlx_lock_id` (CRC-32/ISO-HDLC reference vector `"123456789" → 0xCBF43926` unit-tested). Session-level sqlx lock and xact-level baseline lock share the same id → mutually exclusive.
- Live Case C additionally proves the synthetic rows are byte-compatible: a stock `sqlx::migrate!` run after baseline succeeds (checksums validated by sqlx itself).

### B4 — Strict unknown CLI arg rejection — CLOSED

- `parse_args`: exactly `[]` → Apply, exactly `["--baseline"]` → Baseline, anything else → usage + `exit(2)`. No substring/contains matching remains.
- Unit test covers `--baselin`, `--BASELINE`, bare `baseline`, `--force`, duplicate flag, extra args — all rejected; error message contains the offending arg and usage.

### B5 — Readiness validates full embedded version/checksum set — CLOSED

`probe_state` strong-currency pipeline: no history table/rows → `NoHistoryTable`/`NoHistory`; any `success=false` → `Dirty`; any unknown version or rows.len() > chain → `Ahead`; ascending-prefix walk with version equality → `MissingInterior{version}`; byte-identical checksum per row → `ChecksumMismatch{version}`; short valid prefix → `Stale`; full history → latest-fingerprint table contract → else `PartialSchema`; only then `Current`. Prefix walk operates on version-sorted rows vs version-sorted embedded chain, so bootstrap-order-recorded histories classify correctly.

`/health/ready` wraps `SELECT 1` + probe in a 1500 ms `tokio::time::timeout`; `readiness_decision` maps every state — only `Current` returns 200; `missing-interior`, `checksum-mismatch`, `ahead`, `partial-schema`, `stale`, `dirty`, `missing` all return 503 with exact labels. Verified by unit matrices (routes + platform) and live Cases D/E:
- D: DELETE interior `20250408` → `MissingInterior` + 503 `missing-interior`; corrupt `20250319` checksum → `ChecksumMismatch` + 503; INSERT `20990101000000` → `Ahead` + 503; each restored → back to `Current` + 200 (guards precise, not sticky).
- E: full synthetic history with correct versions/checksums but no schema → `PartialSchema` + 503 `partial-schema` (exactly the prior reviewer's failure scenario).

## Independent verification runs (mine, this session)

- `cargo test --lib migration_runner::` → **7/7 pass**
- `cargo test --lib api::routes` → **1/1 pass**
- `cargo test --bin migrate` → **1/1 pass**
- `cargo test --test platform` → **12/12 pass, 5 ignored** (F3/F4 closure tests still green — no regression)
- `cargo test --test platform -- --ignored --test-threads=1` (live PG 127.0.0.1:5432) → **5/5 pass** (Cases A–E, incl. C2 partial refusal)
- Post-run: `platform_evidence%` leftover databases = **0**; dev `task_scheduler_db` intact (**5** successful rows, max version **20250501000000**)
- `git diff -- backend/migrations` → **empty** (immutability claim holds)
- `cargo fmt --check` → **pass**

## Regression / overclaim check

- No regressions found: migration files untouched; previously-closed F3 (cookies) and F4 (bind) tests still pass; CORS/health/alias platform tests pass.
- No overclaim found: the final-rework claims in `herdr-260831-backend-platform-hardening.md` §"Final rework #2" match the code and the tests I ran, including the honest disclosure of the pre-existing, out-of-scope `--lib auth::auth_common::tests::test_token_flow` failure and the deliberate v1/v2-only baseline refusal.

## Non-blocking findings (notes only)

1. **Partial-schema guard depth:** `probe_state`'s schema contract checks the latest fingerprint's TABLE set only (not columns/enum labels). A tampered DB holding all 20 tables but missing e.g. `reports.rejected_tasks` would still read `Current`. This is exactly what the report claims (no overclaim), but extending the guard to the latest fingerprint's columns/enums would be cheap hardening.
2. **`BootstrappedFresh{applied}` reports the planned chain length** (`MIGRATOR.migrations.len()`) rather than a value read back after the run. Cosmetic; evidence confirms the real applied count equals it.
3. **Baseline uses `pg_advisory_xact_lock` vs sqlx's session-scoped `pg_advisory_lock`** — same lock id, so exclusion is correct; noted only to document the intentional difference.

## Verdict

**ACCEPT.** All five final-review blockers are genuinely closed with code, unit tests, and rerunnable live-PostgreSQL evidence I independently executed: baseline refuses empty/partial schemas and marks only the fingerprint-validated dependency prefix atomically under the sqlx-compatible advisory lock; CLI rejects unknown args strictly; readiness enforces the full embedded version/checksum contract with precise non-sticky guard states. No regressions, no overclaims, clean cleanup.

**Unresolved questions:** none.
