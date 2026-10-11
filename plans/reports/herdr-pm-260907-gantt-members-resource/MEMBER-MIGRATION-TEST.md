# MEMBER-MIGRATION-TEST — independent migration rehearsal

Task: `MEMBER-MIGRATION-TEST` · 2026-09-07 Asia/Bangkok  
Status: **DONE_WITH_CONCERNS**  
Release verdict: **BLOCKED** — the frozen runner cannot upgrade the restored production baseline.

## Executive result

Actual custom-runner populated upgrade failed before the new migration with:

```text
Error: VersionMismatch(20230705000001)
```

Root cause reproduced: all 14 applied historical migration files in the frozen remote build snapshot contain CRLF bytes, while every stored production-baseline SQLx checksum matches the same file after CR removal (LF). Therefore stock SQLx checksum enforcement rejects the first historical version. This is concrete release-blocking artifact incompatibility, not fixture failure.

The same actual custom runner successfully bootstrapped an empty DB with all 15 migrations and reported `Current`. Exact frozen consolidation SQL also passed a supplemental populated-data rehearsal through `psql`, preserving IDs/configuration/plan hash, but that does **not** replace the failed runner-upgrade gate.

## Authority and boundaries

- Read primary `AGENTS.md`; startup docs in required order; deployment doc; primary plan, acceptance and decisions; `TESTENV.md`, `MEMBERS.md`, `DESIGN.md`, `MIGRATION-PREVIEW.md`; requested migration/runner/CLI and direct DDL/test context.
- Applied `ak-test` and `supabase-postgres-best-practices` constraint guidance. `mempalace wake-up` was attempted under the controller and unavailable (`rc=127`); no effect on testing.
- Product source stayed read-only. No local product/test/plan/ledger edits. Only this report plus uniquely owned remote operational artifacts written.
- Producer source/build and active clone build untouched. Remote operational build used a copied source snapshot and independent copied target/lock path.
- No GraphQL/API/UI/deploy/production operation. `127.0.0.1:5434`, `task_scheduler_postgres`, backend services, tunnel and `gm_rehearsal` unchanged.
- Shell tracing stayed off. Credential loaded into process memory only; never printed or persisted in command output.

## Frozen hashes

Start and end hashes matched:

| Artifact | SHA-256 |
|---|---|
| Canonical SQL, local + remote snapshot | `6484C09A8C602BD30A535EB532C000B8277FCCE7229251AB902CED5AF55E952A` |
| Canonical SQL size | `23,508` bytes |
| `migration_runner.rs`, remote snapshot | `f3ab77d74f022b157e00530190962290f3ca02debe470898b141b88bc563de00` |
| `bin/migrate.rs`, remote snapshot | `fb2d30e61a9b3fa4a20b4229e998d4517be5685431009644539ffaac428da353` |
| Authorized original backup | `be43f15286ae50248a5b87d8e4388b4e475a3eb9e958566d0014904b90826346` |
| Populated fault-copy pre-change backup | `53ded3e5da39d94c89152a95632ffc83d951214c623d1c05419658204cd8ec19` |
| Bootstrap pre-readiness-fault backup | `a6bb842544de72646b1092504f4c2ec423b1d832ac96df98e6349ca952583877` |

Per-version raw/LF/stored SHA-384 evidence: `history-checksum-comparison.txt` and `history-line-ending-diagnosis.txt`. Result: `14 MISMATCH` raw; `14/14 LF_MATCH`; consolidation version pending.

## Environment/isolation proof

Before creation and every destructive fixture operation:

- container `pm-gm-rehearsal-20260907`
- label `pm.rehearsal.owner=TESTENV`
- label root `/home/azuraith/task-scheduler/rehearsals/gm-20260907`
- binding `127.0.0.1:55435 -> 5432/tcp`
- exact target database owned by `gm_tester`

Created only after proving names absent:

| DB | Retained state |
|---|---|
| `gm_members_verify_20260907` | original backup restored; synthetic fixtures loaded; old schema retained after runner mismatch |
| `gm_members_bootstrap_20260907` | actual custom-runner bootstrap; trigger/readiness fixtures; final state `Current` |
| `gm_members_fault_20260907` | clone of populated old-schema verify DB; rollback probe passed; then exact SQL applied manually for supplemental preservation proof |

Original restored baseline captured before fixtures:

```text
history 14; project_members 2; resource_members 5; tasks 181; plans 2
history digest 06a5763d9987ba976e0bd462bbe65970
project_members digest dc58ba68bb98cfba97f97d428ad082bf
resource_members digest d82041dceaf18b9cfe24fc7ba2fc5b2c
tasks digest 208bb07864f87679cc79c51bf9e95e68
plans digest ff20a5ccf6aa63006c43ec828ea48afc
```

Digest formulas intentionally exclude personal names/emails/content from output.

## Commands and results

Commands below used in-memory `[redacted]` URL/password:

```text
cargo build --locked --bin migrate                         PASS
DATABASE_URL=[redacted]/gm_members_verify_20260907 migrate FAIL rc=1
DATABASE_URL=[redacted]/gm_members_bootstrap_20260907 migrate PASS rc=0
psql -v ON_ERROR_STOP=1 -f fault-injected.sql              expected FAIL rc=3; rollback PASS
psql -v ON_ERROR_STOP=1 -f exact-frozen-canonical.sql      PASS (supplemental only)
DATABASE_URL=[redacted]/bootstrap migrate after tampering  PartialSchema detected
```

Build needed compile-time SQLx metadata and pointed only to unchanged old migrated `gm_rehearsal`; runtime pointed only to each unique DB.

### Actual runner

| Case | Result |
|---|---|
| Restored + populated upgrade | **FAIL** `VersionMismatch(20230705000001)`; no schema/history/data commit |
| Empty bootstrap | PASS, `BootstrappedFresh { applied: 15 }`, `Current { version: 20260907000001 }` |
| Missing compatibility view | detected `PartialSchema (partial-schema)` |
| Missing required access constraint | detected `PartialSchema (partial-schema)` |
| Restored view/constraint | `Current { version: 20260907000001 }` |

The migrate CLI exits `0` after printing `PartialSchema`; it reports state but does not itself enforce a nonzero readiness exit. Mounted `/health/ready` was not run in this operational-only task.

### Populated exact-SQL supplemental result

Synthetic pre-migration coverage: P-only; R-only unlinked; R-only linked; exact user pair; email pair; old-ID collision; owner-only; legacy-assignee-only; role/access; unlinked task; linked task; capacity setting/override; individual and group leave; group membership; MEMBER classification by COMPANY; group commitment; saved plan.

```text
old fixture P rows 3; old fixture R rows 6; tasks 4
final canonical fixture rows 10 (3 access + 6 resource - 2 pairs + 3 required accounts)
old member IDs preserved 3/3; old resource IDs preserved 6/6
collision dual handles 1/1; normalized task assignments 4/4
roles non-null 3; roles null 7; linked rows 7
project_members relkind r; resource_members relkind v
required canonical constraints 3/3
identity nullability: resource_member_id/display_name NO; user_id/role YES
```

Preservation hashes before/after exact SQL:

- all configuration rows aggregate: `24a6faead61a5afb4e53bc4eb5d4569c` unchanged
- saved fixture `plan_data`: `9f56ea9021a6d582f70fec39b8c089a4` unchanged
- fixture row counts unchanged through injected rollback; old relation kinds restored `r/r`; no migration-history row added

### Trigger/constraint tests

PASS on actual-runner bootstrap schema:

- valid group membership, individual leave, group leave, group commitment
- valid classification, capacity setting and date override
- rejected wrong-project group member, leave, commitment, task assignment and classification
- rejected non-MEMBER group member, task assignee, classification target and capacity target
- rejected task linked-user mirror mismatch
- rejected access role on unlinked member
- rejected canonical project/kind mutation
- account deletion preserved canonical resource row, cleared link/role, retained resource task assignment and cleared account mirror in valid order

Total explicit negative writes rejected: 13/13.

## Operational artifacts

Root: `/home/azuraith/task-scheduler/rehearsals/gm-20260907/member-verification`

Key evidence:

- `source-start.txt`, `source-end.txt`, `build-source-hashes.txt`
- `baseline-before-fixtures.txt`, `fixture.sql`, `fixture-before-migration.txt`
- `runner-verify.{out,err,rc}`, `runner-bootstrap.{out,err,rc}`
- `history-checksum-comparison.txt`, `history-line-ending-diagnosis.txt`
- `fault-{pre-state,post-rollback-state}.txt`, `fault-injected.{sql,out,err,rc}`
- `populated-post-migration.txt`
- `bootstrap-{catalog,trigger-tests,classification-tests,self-consistency-tests}.*`
- `readiness-{missing-view,missing-constraint,restored}.{out,err,rc}`
- `backup-hashes.txt`, `owned-databases.txt`, `final-process-cleanup.txt`

## Untested/release gates

- **Not passed:** actual custom-runner upgrade of the restored populated baseline. Must fix artifact line-ending/checksum compatibility, freeze/rebuild, then repeat this exact gate.
- Mounted GraphQL authorization/link/revoke tests intentionally deferred to final API TEST; no proof fabricated.
- `/health/ready` HTTP 503 behavior not invoked; only its actual shared `probe_state` result exercised through custom migrate CLI.
- Concurrent link/revoke/assignment and app-role view grants not exercised here.
- No production backup/migration/deploy/public readiness/browser verification performed.

## Processes and cleanup ownership

- Tester-owned running processes at finish: `0`.
- Retain all three `gm_members_*_20260907` DBs and artifact root for acceptance.
- Cleanup owner: PM/acceptance operator. Re-verify TESTENV labels, port and DB owner first; drop only the three names above and remove only `member-verification`. Do not reset/drop `gm_rehearsal`; do not remove the shared TESTENV container/root until all rehearsal owners release it.

## Required next action

Normalize/freeze migration artifact bytes so historical embedded SQLx checksums exactly match deployed history while keeping canonical SQL at the approved hash, rebuild the custom runner, then rerun populated upgrade. Do not patch `_sqlx_migrations` or bypass checksum enforcement.

## Unresolved questions

None. Release blocker is reproduced and actionable.
