# TESTENV — isolated PostgreSQL migration rehearsal

Task: TESTENV  
Checked: 2026-09-07 Asia/Bangkok  
Status: **DONE**

## Result

Prepared and verified a PostgreSQL 16 rehearsal on authorized Ubuntu host `khampha` through SSH alias `u-cf`. Production remained a read-only dump/metadata/count source. No migration, schema reset, product edit, service restart, deployment, browser action, commit, or push occurred.

Before creation:

- Deterministic container `pm-gm-rehearsal-20260907`: absent.
- Host listener `127.0.0.1:55435`: free.
- Rehearsal root: absent.
- Source `task_scheduler_postgres`: running, `postgres:16-alpine`, bound only at `127.0.0.1:5434`.

## Owned resources retained for next tester

| Resource | Exact value |
| --- | --- |
| PM-owned container | `pm-gm-rehearsal-20260907` |
| Image / restart | `postgres:16-alpine` / `no` |
| Target endpoint | `127.0.0.1:55435` |
| Target database/user | `gm_rehearsal` / `gm_tester` |
| Root | `/home/azuraith/task-scheduler/rehearsals/gm-20260907` |
| Data bind | `/home/azuraith/task-scheduler/rehearsals/gm-20260907/data` |
| Secured config | `/home/azuraith/task-scheduler/rehearsals/gm-20260907/config/postgres.env` |
| Credential file | `/home/azuraith/task-scheduler/rehearsals/gm-20260907/config/postgres-password` (mode `600`; value not displayed) |
| Ownership marker | `/home/azuraith/task-scheduler/rehearsals/gm-20260907/OWNERSHIP` |
| Container labels | `pm.rehearsal.owner=TESTENV`, `pm.rehearsal.root=<root>`, `pm.rehearsal.cleanup=PM-owned-after-testing` |

Root/config/backup directories are mode `700`; credential and backup are mode `600`. PostgreSQL local and host authentication initialize as `scram-sha-256`; no trust-auth option was used. A credential-backed TCP `SELECT 1` succeeded. Binding is loopback-only.

Source and rehearsal are distinct containers, ports, databases, and storage mounts. Source uses its existing Docker volume; target uses the dedicated bind path above.

## Backup and restore evidence

- UTC timestamp: `20260907T061653Z`
- Backup: `/home/azuraith/task-scheduler/rehearsals/gm-20260907/backups/task-scheduler-production-20260907T061653Z.sql.gz`
- Size: `23,976` bytes, nonempty
- SHA-256: `be43f15286ae50248a5b87d8e4388b4e475a3eb9e958566d0014904b90826346`
- `gzip -t`: passed
- Full `pg_dump --no-owner --no-privileges` restore into `gm_rehearsal`: passed with `ON_ERROR_STOP=1`
- Source baseline before vs. after dump/restore: byte-identical
- Restored rehearsal baseline vs. source baseline: byte-identical
- Backup stayed on Ubuntu; no personal-data download occurred.

Evidence artifacts, all mode `600`:

- `evidence/baseline.sql`
- `evidence/source-before.txt`
- `evidence/source-after.txt`
- `evidence/rehearsal-restored.txt`
- `evidence/manifest.txt`
- backup `.sha256` sidecar

## Sanitized baseline

Hashes exclude names, emails, descriptions, titles, leave reasons, and raw rows. Plan hash incorporates only an aggregate digest of stored `plan_data`, not its content.

| Relation | Count | Digest |
| --- | ---: | --- |
| `project_members` | 2 | `9551b9fbb1898bcbd90e84850921229d` |
| `resource_members` | 5 | `a3f010fcbec388fd9d26d4b08eca8316` |
| `tasks` | 181 | `fcf96ecd6ff64e954d70baf8ab7cdb5e` |
| `member_capacity_settings` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `member_capacity_overrides` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `member_days_off` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `resource_groups` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `resource_group_members` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `resource_member_classifications` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `recurring_commitments` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `plans` | 2 | `c25e8cc6ebecbae7d073dcec1e365bc3` |

SQLx: 14 successful versions; history digest `20b6cbe7b186e4292118ca4fcb2586f3`.

`20230705000001, 20240616000001, 20250319000000, 20250408000000, 20250501000000, 20260325000000, 20260328000001, 20260901000100, 20260901000200, 20260901000300, 20260905000001, 20260905000002, 20260906000001, 20260906000002`

## Required consolidation preflight counts

All observed counts are `0`:

- duplicate `(project_id,user_id)` in access members
- duplicate `(project_id,user_id)` in resource members
- duplicate normalized MEMBER email per project
- ambiguous normalized user-email groups
- empty resource display names
- linked resource/account email mismatches
- task account/resource identity conflicts
- cross-project or non-MEMBER task resource assignments
- non-MEMBER capacity rows
- cross-project group membership
- invalid classification project/kind edges
- cross-project leave targets
- cross-project commitment groups
- access rows with multiple unlinked normalized-email candidates
- unexpected FK relations targeting `resource_members`

No reconciliation or mutation was attempted.

## Safe tester usage

Do not point tests at production `127.0.0.1:5434`. Keep shell tracing disabled and read the secret without echoing it:

```bash
set +x
ROOT=<rehearsal-root>
export PGPASSWORD="$(cat "$ROOT/config/postgres-password")"
psql -X -h 127.0.0.1 -p 55435 -U gm_tester -d gm_rehearsal
unset PGPASSWORD
```

For the later migration runner, construct `DATABASE_URL` in-memory from the same file and target only port `55435`; never log the variable. Do not use `--baseline`. Confirm container labels, target database, port, and storage path again before running any destructive command.

**Important:** existing `backend/tests/herdr_flow.rs` executes `DROP SCHEMA public CASCADE`. Do not run it against this restored baseline. Give that test a separate disposable database with a positive isolation guard. This rehearsal is intentionally preserved unchanged until the new migration is ready.

## Cleanup ownership

PM owns cleanup after assigned migration testing. Required cleanup target is only:

```bash
docker rm -f pm-gm-rehearsal-20260907
rm -rf /home/azuraith/task-scheduler/rehearsals/gm-20260907
```

Re-verify labels/root before cleanup. Do not touch `task_scheduler_postgres`, backend, tunnel, releases, or production backups. All SSH/helper commands exited; the intentionally retained rehearsal container is the only started resource.

## Unresolved questions

None.
