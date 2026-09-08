# MEMBER-REMOVE-0908

## Status

DONE — scoped backend fix committed, pushed, deployed, and healthy.

## Root cause

`remove_resource_member` deleted `project_members` directly. Production FK `tasks_assignee_resource_member_id_fkey` is `ON DELETE RESTRICT`; assigned tasks therefore blocked deletion.

## Implementation

Commit `53011efe21a52219e603bfdbc8f2286877d3e65a` keeps existing authorization and transaction boundaries, then:

1. locks/reads target `resource_member_id` and linked `user_id`;
2. clears both task assignment mirrors for canonical assignments and same-project stale legacy user links;
3. deletes the member;
4. commits only if every statement succeeds.

Tasks and timesheets are never deleted. Task parent links, hierarchy, titles, descriptions, tags, and other content remain unchanged. A delete failure rolls assignment changes back with the member deletion.

## Inbound FK evidence

Read-only production `pg_constraint` inspection found all inbound canonical member FKs:

| Reference | Rule | Result |
| --- | --- | --- |
| `tasks.assignee_resource_member_id` | RESTRICT | Explicit assignment nulling before delete |
| `member_capacity_settings.resource_member_id` | CASCADE | Existing configuration cleanup |
| `member_capacity_overrides.resource_member_id` | CASCADE | Existing configuration cleanup |
| `member_days_off.resource_member_id` | CASCADE | Existing configuration cleanup |
| `resource_group_members.resource_member_id` | CASCADE | Existing membership cleanup |
| `resource_member_classifications.resource_member_id` | CASCADE | Existing classification cleanup |
| `resource_member_classifications.classified_by_resource_member_id` | CASCADE | Existing classifier cleanup |

`timesheet_entries` references users and tasks, not project members. Since neither user nor task is deleted, timesheet history remains.

## Test evidence

Focused command:

```text
cargo test --locked --test member_removal -- --nocapture
1 passed; 0 failed
```

Coverage: assigned and unassigned removal, null canonical/stale assignments, preserved task hierarchy/content, preserved timesheet, authorization no-change, dependent FK cleanup, and forced failure rollback.

Honesty note: this was a focused DB-backed GraphQL integration test, not a pure unit test. It ran against disposable isolated DB `member_remove_0908`; production data was never used or mutated. The disposable DB and remote test source were removed. No further integration suite ran after the user narrowed testing.

Changed-file rustfmt passed. The focused Cargo test compiled the backend target; existing unrelated warnings remained.

## Git

- Branch: `codex/member-remove-0908`
- Base: `52e74b5`
- Source commit: `53011ef fix(members): clear task assignments before removal`
- Source push: `origin/codex/member-remove-0908`
- Files: `backend/src/graphql/resolvers/resource_members/mod.rs`, `backend/tests/member_removal.rs`

## Ubuntu release

- Release: `/home/azuraith/task-scheduler/releases/20260908T0952-53011ef`
- Image: `task-scheduler-backend:20260908T0952-53011ef`
- Image ID: `sha256:88ed2f11577ebc223b446a0b95473e24fb8a3dd484bfe623753985346198eb22`
- Source archive SHA-256: `016ef34481b25423d3bee773ed201f65d1d277297a4f061568f3377fa2680e1d`
- Verified backup: `backup/db-before-20260908T0952-53011ef.sql.gz`
- Backup: 33,565 bytes; SHA-256 `2e96debaf6ed7520648ecdfbc0e298956626cdb7c5cf3345a6bbe3cdaa0fa9ad`; `gzip -t` passed.
- No migration and no production member/task/timesheet mutation.
- Existing exact CORS environment preserved; localhost and production preflights remain 200 with matching ACAO.
- Local health: `ready / up / current`.
- Public health: `ready / up / current`.

Immediate rollback retained stopped:

- Container: `task-scheduler-backend-prev-20260908T0952-53011ef`
- Image: `task-scheduler-backend:20260908T0925-0218f17`
- Runtime configuration preserved exactly.

Rollback:

```bash
ssh u-cf 'set -e
docker stop task-scheduler-backend && docker rm task-scheduler-backend
docker rename task-scheduler-backend-prev-20260908T0952-53011ef task-scheduler-backend
docker start task-scheduler-backend
curl --fail --silent --show-error http://127.0.0.1:8081/health/ready
curl --fail --silent --show-error https://pm-api.khampha.dpdns.org/health/ready
'
```

Database restore is not required for rollback because the release has no migration or production data operation. Backup retained as safeguard.

## Unresolved questions

None.
