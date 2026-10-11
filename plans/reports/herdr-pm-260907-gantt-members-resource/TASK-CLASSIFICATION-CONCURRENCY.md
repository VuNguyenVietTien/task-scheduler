# TASK-CLASSIFICATION-CONCURRENCY

Status: **BLOCKED**

## Scope and source state

- Worktree: `C:/Users/TienVNV/Documents/prjmngr/worktrees/catalog-backend-20260907`
- Base: `049a6c5ddf31de2c373ae69c384bb2e0a14089d7`
- No source or test file was edited. All inherited catalog changes remain untouched.
- Frozen hashes observed before any prospective change:
  - `backend/src/graphql/resolvers/tasks/mutation/update.rs`: `fa89a903eaabf9997cfda972fb99481e21b9aa9ce1ba5a3f0aa3a2e1388be984`
  - `backend/tests/project_catalogs.rs`: `2bffd3a86e6de68f5b08932a9ce6fef2831c3e152883558429544b1ddbfe9e58`
- Frozen manifest expectation for `update.rs` matches the observed hash.

## Current code-level result

A stale-classification overwrite is present by inspection, but an authorized fixture reproduction was not completed:

1. `update.rs` fetches `existing` classification IDs/scalars before `require_project_write_tx` acquires the project lock (current lines 32–43).
2. The later task `FOR UPDATE` only locks/rechecks task existence (lines 45–47); it does not refresh the already-read classification state.
3. `resolve_update_task_catalogs` uses that pre-lock state (lines 49–67) and the final `UPDATE` writes every catalog ID and bridged legacy scalar (lines 107–122).

Therefore: request A can read old classifications, block on the project lock; request B can commit an explicit classification update; after A gets the lock it writes the old state while changing only its unrelated field. This can revert all three catalog IDs and paired legacy scalars.

Required narrow fix, not applied due blocker: after `require_project_write_tx` and task row lock, re-read the authoritative task classification IDs and legacy bridge scalars before calling `resolve_update_task_catalogs`. No helper/schema/API change is needed.

## TESTENV preparation and raw evidence

Authorized isolated TESTENV only was checked:

- Container ownership/health marker: `pm-gm-rehearsal-20260907`, owner `TESTENV`; loopback `127.0.0.1:55435` verified.
- Existing `catalog-functional-verification` root and `gm_catalog_functional_20260907` database were absent.
- Created only the assigned fixture root and database, restored from a fresh owned compressed backup of `gm_rehearsal`; credentials were not printed.
- Retained artifacts:
  - `/home/azuraith/task-scheduler/rehearsals/gm-20260907/catalog-functional-verification/OWNERSHIP`
  - `/home/azuraith/task-scheduler/rehearsals/gm-20260907/catalog-functional-verification/backups/before-functional-db-create.sql.gz`
  - `/home/azuraith/task-scheduler/rehearsals/gm-20260907/catalog-functional-verification/backups/before-migrations.sql.gz`
- Fixture database remains at migration count `14`; migration/test execution did not start.
- Frozen remote catalog source was read-only hash-checked against the frozen `update.rs` hash above.

## Blocker

The required owned compiler output command was blocked by a runtime policy before remote execution:

```text
BLOCKED: Access to '$ROOT/target' denied
Pattern: target
Tool: Bash
```

Per task instruction, no wording change or retry was attempted. The environment also has no local Cargo executable. Consequently no deterministic GraphQL/fixture transaction ran, no focused test was added, and no before/after test result exists.

## Cleanup and gates

- No local tunnel, listener, worker, server, or cargo job was started; none require stopping.
- The assigned fixture DB and backups are retained for independent functional retest, as requested.
- Do not use producer `gm_catalog_verify_20260907`, release/review DBs, or production.
- Remaining: authorize/resolve compiler-output policy; apply the one-file fresh-read fix; add/run focused concurrent GraphQL persistence test proving explicit set, clear, and omitted behavior for all three IDs and legacy bridges; then independent functional retest and release gates.

## Unresolved questions

- Can the runtime policy permit the assigned isolated compiler output path so the authorized fixture test can run?
