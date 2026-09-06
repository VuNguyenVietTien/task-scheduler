# Resume Review — pm-resume-review-1

**Session:** herdr-260901-1842 · **Reviewer pane:** w3:p1F · **Mode:** READ-ONLY independent review, **no git worktree** (confirmed: primary checkout only; consistent with ledger worktree-audit)
**Scope:** pm-taxonomy-fix-1 (taxonomy hardening) + pm-resource-import-impl-1 (Task 1.2 resource/import) against accepted design `docs/superpowers/specs/2026-09-01-project-scheduling-wbs-design.md` (§4/§6/§9.2/§10/§11/§12) and plan `docs/superpowers/plans/2026-09-01-project-scheduling-wbs.md` (Tasks 1.1–1.3).
**Skills:** `ak:code-review` (SKILL.md + spec-compliance/verification references). No secret/.env/live-DB/network/browser access; no commit/push/deploy; only this report file written.

---

## 1. Fresh verification (run this session, exit codes)

| Command | Result | Exit |
|---|---|---|
| `cargo test --lib migration_runner` | `7 passed; 0 failed; 0 ignored; 65 filtered out` | 0 |
| `cargo test --test taxonomy_hardening --test taxonomy_hierarchy --test import_issue_1115_dry_run --test resource_members` | hardening `2 passed; 2 ignored` · hierarchy `5 passed; 1 ignored` · import_1115 `20 passed; 0 failed` · resource_members `8 passed; 0 failed` | 0 |
| `cargo test --bin import_redmine` | `3 passed; 0 failed` | 0 |
| `cargo check --all-targets` | 0 errors (pre-existing unused-import/dead-code warnings only) | 0 |

Ignored tests (live-PG) intentionally not run per review mode. Note: `--all-targets` now compiles clean — the earlier baseline failure (unregistered `imports`/`resource_identity` modules) is resolved by Task 1.2 registration.

## 2. Spec matrix — pm-taxonomy-fix-1

| Requirement (design §4.1/§6/§12 + accepted review findings) | Status | Evidence |
|---|---|---|
| Archive self-reassign rejected BEFORE any write | PASS | `backend/src/domain/taxonomy.rs:639-647` (`validate_archive_strategy`) called as first statement of `archive_phase` (line 662), before `pool.begin()` and before any read/update/deactivation; pure test `archive_reassign_to_same_phase_is_rejected` green |
| `assemble_forest` exactly-once, no panic on corrupt rows | PASS | `taxonomy.rs:223-282`: first-row-per-id dedup, `visited`-set `take` returns `None` on revisit (never `expect`/panic); self-parent/orphan → root; cycle members appended as roots post-assembly. Test `corrupt_parent_cycle_never_panics_and_surfaces_each_task_exactly_once` green (2/2 hardening pure tests) |
| Healthy hierarchy regression | PASS | Projection `backend/src/graphql/resolvers/tasks/query/tasks.rs:135` delegates to `assemble_forest`; 5/5 `taxonomy_hierarchy` pure tests green (first-encounter order preserved) |
| Advisory-lock transactional reparent (TOCTOU) | PASS | `taxonomy.rs:578-593` `pg_advisory_xact_lock(hashtextextended(project_id::text, 6202401))` (xact-scoped, correct bigint overload); `reparent_task` (597-637): begin → resolve project → lock → `fetch_task_refs` through tx → `validate_reparent` → UPDATE → commit, single atomic pair. GraphQL path `mutation/update.rs:19-49`: same lock→validate→UPDATE→commit inside one tx. Live concurrency test exists (ignored, not run per mode; prior worker evidence recorded) |
| Deadlock/race assessment | PASS w/ note | Advisory lock is the first lock acquired in both txs (before row locks), single lock key per tx, both callers use the identical key derivation → classic lock-order safety. No other callers of `lock_project_hierarchy` (grep: `update.rs`, `taxonomy.rs` only). Residual P3s below |
| Detach-to-root path | PASS w/ note | `update.rs:39` validation block only runs when `parent_task_id` is `Some`; detach cannot create a cycle → sound, though asymmetric (documented behavior, not a defect) |
| Owned-files-only diff discipline | PASS | Touched files match report: `taxonomy.rs`, `tasks/query/tasks.rs`, `tasks/mutation/update.rs`, `tests/taxonomy_hardening.rs` (new) |

## 3. Spec matrix — pm-resource-import-impl-1 (Task 1.2)

| Requirement (design §6.2/§6.3/§9.2, plan Task 1.2) | Status | Evidence |
|---|---|---|
| Migrations forward-only, additive, correct FKs | PASS | `20260901000200_create_import_provenance.sql`: `external_import_runs` (UNIQUE project/source/root — deterministic re-run identity), `wbs_groups` composite parent FK scoped to (project, source) ON DELETE CASCADE; `tasks.source_system/external_id/source_metadata/wbs_group_id` additive; partial-unique `idx_tasks_source_identity` `WHERE source_system IS NOT NULL AND external_id IS NOT NULL` (NULLs for local tasks unrestricted). `20260901000300`: `resource_members` (member_kind CHECK, `user_id` FK SET NULL), partial-unique `(project_id, user_id) WHERE user_id IS NOT NULL`, classifications no-self CHECK, cascades. Legacy `project_members` untouched |
| Migration fingerprints append-only | PASS | `migration_runner.rs` FP_V5/FP_V6 appended; `cargo test --lib migration_runner` 7/7 incl. chain-head coverage |
| Stable identity / link rules | PASS | `domain/resource_identity.rs:123-175`: placeholder = no user, required display_name; `link_user` preserves `resource_member_id`, idempotent same-member relink, `DuplicateLinkedUser` for same-project same-user on another member, cross-project allowed (spec-conformant) |
| Companies/groups non-assignable | PASS | `is_assignable` (line 140) `matches!(kind, Member)` only; classification validator (178-202): MEMBER target, COMPANY/GROUP classifier, same project |
| Hard gates 1115/23/156/69-69-6-6-6/387.00/1139 | PASS | Constants `imports/issue_1115.rs:40-52` (`Decimal::from_parts`, no floats); **fixture independently re-parsed this review**: root 1115 "Detailed Design", 23 headings, 156 tasks, workflow counts Create 69 / Try-S-Review-1 69 / Address-1 6 / Try-S-2 6 / Toshiba 6, total effort exactly `387.00`, issue 1139 = 40.00h / p-1 = "Shuichi Nakama"→Nakayama (person alias verified) / wbs_row 5. 20/20 gate tests green incl. wrong-root, drift, unknown-workflow, dup-identity, cycle, heading-as-dependency rejections |
| Deterministic dry-run | PASS | `dry_run(manifest: &ImportManifest) -> Result<DryRunReport,…>` (issue_1115.rs:269) is pure sync — no pool/async/clock params; `DryRunReport` carries no timestamps; equality-of-two-runs test asserts bit-stable rerun |
| No apply/write path | PASS | `bin/import_redmine.rs`: `--apply` → hard refuse `exit(2)`; strict args; no DB opened anywhere in bin; apply structurally absent until Increment 4 |
| SHA-256 correctness | PASS | `manifest.rs:171-260` FIPS 180-4 implementation; NIST vectors tested (empty `e3b0c442…`, `abc` `ba7816bf…`); `canonical_snapshot` = SHA-256 of canonical JSON (hex) for `external_import_runs.snapshot_sha256` |
| Resolver compile-gated, unmounted (per report) | SUPERSEDED — see F1 | At report time: `#[cfg(test)] #[path]` gate in `lib.rs`. Current tree: mounted (post-report, unattributed session) |

## 4. Findings

### F1 (P1 — current tree state; NOT attributable to the two reviewed workers) — resolvers already mounted without ledger entry; mounted resource_members writes show no project-authorization
- **Evidence:** `src/graphql/resolvers/mod.rs` (mtime Sep 2 17:06) now has `pub mod resource_members; pub mod taxonomies; pub mod schedule_projection;`; `src/graphql/schema.rs:14-15` mounts `ResourceMemberQuery/Mutation` (+ TaxonomyQuery); `src/lib.rs` compile gates removed; `schema.graphql:353-363,581-585` exposes `create_resource_member` / `link_resource_member_user` / `classify_resource_member`. A **new** `schedule_projection` resolver (`resolvers/schedule_projection/`, Sep 2 17:09-17:12) and `tests/contract/increment1_graphql.rs` exist with **no ledger entry and no report**. Grep of `resource_members/mod.rs` (294 lines) finds no role/require/authorize/project-membership check; design §10 mandates "Project authorization and same-project validation on every write".
- **Attribution:** both reviewed workers delivered exactly the unmounted/compile-gated handoff they claimed (verified vs. their reports; mounting post-dates their close by ~17h). This is untracked Task 1.3 WIP by an unrecorded session after the Herdr server crash.
- **Risk:** if this schema builds as-is, any authenticated caller may create/link/classify resource members in arbitrary projects (authorization gap), and unreviewed schedule_projection code rides the same schema.
- **Fix (Task 1.3 owner):** audit + add project authorization/same-project validation to all resource_members (and taxonomies/schedule_projection) writes before any Increment-1 gate; record the Sep 2 session in the ledger or re-derive the mounting under a tracked worker; run `tests/contract/increment1_graphql.rs`.

### F2 (P3 — taxonomy) — advisory-lock seed unregistered
`6202401` (taxonomy.rs:585) arbitrary-but-fixed; register if a lock-key registry emerges (Task 1.3+). Collision would only over-serialize, not corrupt. Accept.

### F3 (P3 — taxonomy) — recursion depth in `assemble_forest` = tree depth
Same as pre-fix assembler; pathological depth unchanged. Matches deferred performance note. Accept at expected scale.

### F4 (P3 — import) — `tasks.wbs_group_id` FK not scoped to (project, source)
`wbs_group_id → wbs_groups(group_id)` (000200) permits cross-project group reference at SQL level; apply-time validation (Increment 4) must enforce same-project. Harden with composite FK then if needed.

### F5 (P3 — import) — custom SHA-256 maintained in-tree
Hash-only, dependency-free rationale documented, FIPS vectors tested — no correctness issue. Prefer the audited `sha2` crate when a dependency budget allows. `link_user` uses `Utc::now()` (documented; dry-run never touches members). `resource_members` ordering is Rust-side (no order column) — documented. Accept.

### F6 (P3 — process) — live-DB migration evidence deferred
Manager scope correction (no DB) is respected; fingerprints + static review green; live throwaway-DB evidence owed at Task 1.5 gate per report. Track it.

## 5. Callers / public-contract audit

- `assemble_forest` pub in `domain::taxonomy`; sole caller `tasks/query/tasks.rs:135`; old panic-assembler removed. `fetch_task_refs` executor-generic; all callers (`reparent_task`, `update.rs`) compile and pass through tx — `cargo check --all-targets` exit 0.
- `lib.rs` module registration: `pub mod imports;` present; `domain/mod.rs` + `db/models/mod.rs` additive registrations intact; no compile-gated unmounted resolver remains (superseded by F1 mounting — Task 1.3 handoff partially executed, unreviewed).
- No product/test/migration/config edits by this review; dirty user worktree preserved.

## 6. Task 1.3 prerequisites (current-state delta)

1. **Reconcile the Sep 2 unattributed mounting** (`resolvers/mod.rs`, `schema.rs`, `lib.rs`, `schema.graphql`, `schedule_projection/**`, `tests/contract/increment1_graphql.rs`) — either ledger-backfill with a report or redo under a tracked worker. **File ownership:** whoever claims this owns `backend/src/graphql/schema.rs` + `backend/schema.graphql` solely (plan's exclusive-path rule).
2. **Authorization audit/gap-fix** on mounted resource_members + taxonomies + schedule_projection writes (F1) — blocking before Increment-1 gate.
3. Contract test `increment1_graphql.rs` green + SDL/Jest fixture sync (`web/src/graphql` w3-contract/w3-sdl-fixture tests, plan lines 266-268).
4. Register advisory-lock seed if registry emerges (F2); carry F4 into Increment-4 apply validation; live-DB migration evidence at Task 1.5 (F6).
5. Frontend `TaskScheduleItem.source_wbs` metadata typing (deferred from prior review; Task 1.3/1.4 handoff).

## 7. Verdict

**ACCEPT** for the two reviewed slices — pm-taxonomy-fix-1 and pm-resource-import-impl-1 match their accepted scope, specs, and reports; fresh pure test gates all green (35 passed + 0 failed across required suites, exit 0); no blocking correctness/security defect found **within their delivered (unmounted) scope**. F1 is a P1 against the *current tree*, caused by untracked post-report Task 1.3 WIP, and must gate Increment-1 acceptance — it does not regress either reviewed worker's delivered contract.

## 8. Unresolved questions

1. Who performed the Sep 2 17:06-17:12 mounting/schedule_projection work, and under what instruction? (No ledger/report exists; needs user confirmation before backfill.)
2. Should `reparent_task` (domain fn) acquire callers beyond the two current paths, all must take `lock_project_hierarchy` first — enforce in Task 1.3 code review checklist?
