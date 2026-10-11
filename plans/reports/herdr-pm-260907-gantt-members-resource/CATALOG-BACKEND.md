# CATALOG-BACKEND

**Status: FROZEN — backend catalog scope complete; independent integrated review remains.** 2026-09-07 Asia/Bangkok. Source worktree: `C:/Users/TienVNV/Documents/prjmngr/worktrees/catalog-backend-20260907`, base `049a6c5`, branch `codex/project-catalog-backend-20260907`.

## Delivered

- Append-only migration `20260907000002_project_task_catalogs.sql`: per-project Progress/Category/Task-type catalog items plus localized labels; nullable task IDs; composite same-project FKs; deferred slot-kind trigger.
- Scalar-only legacy seed/backfill for nonblank task `progress_type`, `category`, and `type`. No `project_phases`, `project_categories`, taxonomy-title, or plan-JSON inference/mutation.
- Mounted GraphQL catalog reads and batch-create/update/reorder mutations, project authorization, transaction/recheck locking, validation, stale-order `CONFLICT`, and label replacement.
- Task create/update preserve correct omit/null/value semantics and bridge seeded values safely; clone copies all catalog IDs; every mounted task response exposes them.
- Migration-readiness fingerprint now requires migration 16, catalog tables, task columns, and existing canonical member relations.
- `backend/schema.graphql` regenerated; frozen API contract retained as `CATALOG-API-CONTRACT.md`.

## Required evidence

Owned isolated rehearsal only: `/home/azuraith/task-scheduler/rehearsals/gm-20260907/catalog-verification`, DB `gm_catalog_verify_20260907`, loopback `55435`. Production/5434, deploy, commit, push, dependencies, Cargo.lock, historical migrations, web, and PM ledger untouched.

| Check | Result | Raw evidence |
|---|---|---|
| `cargo test --locked --test project_catalogs -- --test-threads=1` | PASS: 2/2 | `project-catalogs-final-suite.{out,err,rc}` |
| Catalog CRUD/labels/reorder/stale/duplicate/kind/cross-project/auth/task bridge/clone | PASS in mounted test | `project-catalogs-final-suite.*` |
| Missing catalog schema -> `PartialSchema` | PASS | same suite; destructive probe restored from backup |
| Existing SDL contract suite | PASS: 29/29 | `contract-test.{out,err,rc}` |
| `cargo check --locked` | PASS | retained prior `cargo-check.*` |
| Restored history-14 -> migration-16 | PASS | `migrate-final-14-to-16.*`, `migrate-preservation-14-to-16.*` |
| Legacy task classification backfill | PASS: unmatched Progress/Category/Type `0/0/0` | `final-preservation.txt` |
| Task/plan preservation | PASS: `181` tasks, `2` plans, plan JSON digest unchanged `5f1c4cb01bc37debb44b6b1696d6bb15` | `pre-upgrade-plan-fingerprint.txt`, `post-upgrade-plan-fingerprint.txt`, `final-preservation.txt` |
| Canonical member relation | PASS: `project_members=r`, `resource_members=v` | `final-preservation.txt` |
| Reset safety | PASS: compressed backup verified before every reset/change | `backups/` |

The host builder lacks `rustfmt`; `cargo fmt --check` could not run (`fmt-check.*`). This is environment-only, not a source failure. No full release build, independent review, integration suite, or deployment run here.

## Freeze boundary

Source is frozen for release build/review. Remaining work is external: full integrated review/build, user parallel tests, independent code review, release artifact, and deployment pending under existing authorization.

Unresolved questions: none.
