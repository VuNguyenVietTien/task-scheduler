# CLONE-TITLE-0908

## Status

DEPLOYED

## Owner / implementation

Server owner: `backend/src/graphql/resolvers/tasks/mutation/clone.rs`. The shared insert previously appended ` (copy)` to every root/child title.

- Source commit: `a2dcddf` (`fix(tasks): preserve titles when cloning`).
- Integrated commit deployed: `0ce6e937fc231c48e261909b675a75e06303528d`.
- Shared insert now binds the exact source title for roots, children, nested children, and every quantity.
- Existing DB flow assertions verify exact root/child titles across three copies, but that DB-backed flow was **updated, not run**.
- No frontend rename, API/schema change, migration, or production task mutation.

## Focused unit result

Ubuntu committed archive:

```text
cargo test --release --locked graphql::resolvers::tasks::mutation::clone::tests::cloned_titles_remain_exact --lib
1 passed; 0 failed; 71 filtered out
```

A preliminary invocation did not compile because the shell value was not exported into the temporary Docker test process; exporting the same preserved runtime `DATABASE_URL` fixed the invocation. No source change was needed.

## Release evidence

- Release: `20260908T1306-0ce6e937`.
- Image: `task-scheduler-backend:20260908T1306-0ce6e937`.
- Image ID: `sha256:6dc08b3a24dc3e9059c7efb6f919e47e416c028d437af5d63cc39916e89478f8`.
- Archive: `/home/azuraith/task-scheduler/releases/20260908T1306-0ce6e937/source.tar.gz`.
- Archive SHA-256: `2e1b82e6c069f557b7cd5eaff1e410636eefbf9435cc276f8bfb292442b6843e`.
- Backup: `/home/azuraith/task-scheduler/releases/20260908T1306-0ce6e937/backup/db-before-20260908T1306-0ce6e937.sql.gz`.
- Backup: 33,043 bytes; mode `0600`; gzip verified; SHA-256 `7fa312c45945d188525c48cf5421afc70713bf900a6293040cdbcf5c449fb1c7`.
- Runtime env/CORS, user `1000:1000`, host network, restart/log policy, config, and uploads match retained prior container.
- Rollback container: `task-scheduler-backend-prev-20260908T1306-0ce6e937` (stopped).
- Local readiness: `{"status":"ready","database":"up","migrations":"current"}`.
- Public readiness: `{"status":"ready","database":"up","migrations":"current"}`.

Rollback:

```bash
docker stop task-scheduler-backend && docker rm task-scheduler-backend
docker rename task-scheduler-backend-prev-20260908T1306-0ce6e937 task-scheduler-backend
docker start task-scheduler-backend
curl --fail --silent --show-error http://127.0.0.1:8081/health/ready
curl --fail --silent --show-error https://pm-api.khampha.dpdns.org/health/ready
```

## Unresolved questions

None.
