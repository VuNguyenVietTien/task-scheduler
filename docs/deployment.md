# Production Deployment

Last verified: 2026-09-08 (Asia/Bangkok)

## Topology

```text
Browser
  -> https://prjmngr.vercel.app (Next.js on Vercel)
  -> /api/* and /api/graphql (same-origin Next.js proxy)
  -> https://pm-api.khampha.dpdns.org (Cloudflare Tunnel)
  -> Ubuntu localhost:8081 (Rust/Actix backend)
  -> PostgreSQL localhost:5434 (Docker)
```

## Live services

| Component | Production target |
| --- | --- |
| Frontend | `https://prjmngr.vercel.app` |
| Vercel project | `vunguyenviettiens-projects/task-scheduler` |
| Vercel deployment | `dpl_GjrYjW8BTdF7yNEPqqD1ZuLaY2dF` (`task-scheduler-mhg3tac41-vunguyenviettiens-projects.vercel.app`, aliased `prjmngr.vercel.app`) |
| Backend API | `https://pm-api.khampha.dpdns.org` |
| Backend container | `task-scheduler-backend` |
| Backend image | `task-scheduler-backend:20260908T1328-c6fd89b7` |
| Backend release | `/home/azuraith/task-scheduler/releases/20260908T1328-c6fd89b7` |
| PostgreSQL container | `task_scheduler_postgres` |
| Cloudflare origin | `http://localhost:8081` |

The immediate rollback container is retained, stopped, with the prior live image/configuration:

- `task-scheduler-backend-prev-20260908T1328-c6fd89b7`
- `task-scheduler-backend:20260908T1306-0ce6e937`

The older rollback containers and images documented below remain retained too.

## Release 20260908T1328-c6fd89b7 (2026-09-08)

Explicit task-date clear release from integrated source `c6fd89b78af27b2f707862de53758d388431b337`.

- Immutable image: `task-scheduler-backend:20260908T1328-c6fd89b7` (`sha256:6287387784b87fe35692f5dcf6b16ed1ad06a4ca2dd956849cf701ed2b14b471`).
- Committed Git archive: `/home/azuraith/task-scheduler/releases/20260908T1328-c6fd89b7/source.tar.gz`, SHA-256 `fbfdd5f79546b4b0d03ea98f9e8f4eeb120571f1fc30c78b385c3fc0adea530a`.
- Verified pre-cutover backup: `/home/azuraith/task-scheduler/releases/20260908T1328-c6fd89b7/backup/db-before-20260908T1328-c6fd89b7.sql.gz` (33,046 bytes; SHA-256 `400cb6d6d9b6e4180ee95dcd4348eb0ee99335173ec80c41f1ea679101f21922`; mode `0600`; gzip verified).
- No migration or production task mutation was run. Existing runtime environment, CORS, host network, user, restart policy, logging, config, and uploads were preserved exactly.
- Focused date-patch unit test passed 1/1 (72 filtered). Immutable Docker build passed. Local/public readiness report `ready` / `up` / `current`.

Immediate backend rollback:

```bash
docker stop task-scheduler-backend && docker rm task-scheduler-backend
docker rename task-scheduler-backend-prev-20260908T1328-c6fd89b7 task-scheduler-backend
docker start task-scheduler-backend
curl --fail --silent --show-error http://127.0.0.1:8081/health/ready
curl --fail --silent --show-error https://pm-api.khampha.dpdns.org/health/ready
```

Database rollback is not required for this code-only release; the verified backup is retained as an additional safeguard.

## Release 20260908T1306-0ce6e937 (2026-09-08)

Exact clone-title preservation release from integrated source `0ce6e937fc231c48e261909b675a75e06303528d`.

- Immutable image: `task-scheduler-backend:20260908T1306-0ce6e937` (`sha256:6dc08b3a24dc3e9059c7efb6f919e47e416c028d437af5d63cc39916e89478f8`).
- Committed Git archive: `/home/azuraith/task-scheduler/releases/20260908T1306-0ce6e937/source.tar.gz`, SHA-256 `2e1b82e6c069f557b7cd5eaff1e410636eefbf9435cc276f8bfb292442b6843e`.
- Verified pre-cutover backup: `/home/azuraith/task-scheduler/releases/20260908T1306-0ce6e937/backup/db-before-20260908T1306-0ce6e937.sql.gz` (33,043 bytes; SHA-256 `7fa312c45945d188525c48cf5421afc70713bf900a6293040cdbcf5c449fb1c7`; mode `0600`; gzip verified).
- No migration or production task mutation was run. Existing runtime environment, CORS, host network, user, restart policy, logging, config, and uploads were preserved exactly.
- Focused clone-title unit test passed 1/1 (71 filtered); the DB-backed clone flow was updated but not run. Immutable Docker build passed. Local/public readiness report `ready` / `up` / `current`.

Immediate backend rollback:

```bash
docker stop task-scheduler-backend && docker rm task-scheduler-backend
docker rename task-scheduler-backend-prev-20260908T1306-0ce6e937 task-scheduler-backend
docker start task-scheduler-backend
curl --fail --silent --show-error http://127.0.0.1:8081/health/ready
curl --fail --silent --show-error https://pm-api.khampha.dpdns.org/health/ready
```

Database rollback is not required for this code-only release; the verified backup is retained as an additional safeguard.

## Release 20260908T0952-53011ef (2026-09-08)

Atomic project-member removal release from committed source `53011efe21a52219e603bfdbc8f2286877d3e65a`.

- Immutable image: `task-scheduler-backend:20260908T0952-53011ef` (`sha256:88ed2f11577ebc223b446a0b95473e24fb8a3dd484bfe623753985346198eb22`).
- Committed Git archive: `/home/azuraith/task-scheduler/releases/20260908T0952-53011ef/source.tar.gz`, SHA-256 `016ef34481b25423d3bee773ed201f65d1d277297a4f061568f3377fa2680e1d`.
- Verified pre-cutover backup: `/home/azuraith/task-scheduler/releases/20260908T0952-53011ef/backup/db-before-20260908T0952-53011ef.sql.gz` (33,565 bytes; SHA-256 `2e96debaf6ed7520648ecdfbc0e298956626cdb7c5cf3345a6bbe3cdaa0fa9ad`; gzip verified).
- No migration or production member/task/timesheet mutation was run. Local/public readiness reports `ready` / `up` / `current`.
- Existing CORS environment was preserved exactly; localhost and production GraphQL preflights remain 200 with matching exact ACAO.
- Focused DB-backed GraphQL integrity test passed 1/1 before release; it used and then removed a disposable isolated database, not production data.

Immediate backend rollback:

```bash
docker stop task-scheduler-backend && docker rm task-scheduler-backend
docker rename task-scheduler-backend-prev-20260908T0952-53011ef task-scheduler-backend
docker start task-scheduler-backend
curl --fail --silent --show-error http://127.0.0.1:8081/health/ready
curl --fail --silent --show-error https://pm-api.khampha.dpdns.org/health/ready
```

Database rollback is not required for this code-only release; the verified backup is retained as an additional safeguard.

## Release 20260908T0925-0218f17 (2026-09-08)

Exact local-dashboard CORS release from committed source `0218f17`.

- Immutable image: `task-scheduler-backend:20260908T0925-0218f17` (`sha256:0624fa1fb2c76cf7ca8d178e30527e832e06eac3b48ec9b6e35686d6ff9f1adc`).
- Committed Git archive: `/home/azuraith/task-scheduler/releases/20260908T0925-0218f17/source.tar.gz`, SHA-256 `78cd254540d316ce7c60e362679a18fab902b4e2d2920134dcc1bc5e3806114b`.
- Runtime allowlist is exactly `https://prjmngr.vercel.app,http://localhost:3000`. Production HTTPS support remains; only exact `http://localhost:3000` is accepted as the production HTTP exception. Other localhost ports, `127.0.0.1`, wildcards, and untrusted origins remain rejected.
- No database/schema/task write or migration was run. Local and public readiness report `ready` / `up` / `current`.
- Exact GraphQL preflight probes requesting `POST` with `authorization,content-type`: localhost and production return 200 with their matching `Access-Control-Allow-Origin`; an untrusted origin returns 400 without ACAO.
- Checks: changed-file rustfmt and 7 focused production platform tests passed. Docker build used the existing database URL only for SQLx compile-time metadata and made no database writes.

Immediate backend rollback:

```bash
docker stop task-scheduler-backend && docker rm task-scheduler-backend
docker rename task-scheduler-backend-prev-20260908T0925-0218f17 task-scheduler-backend
docker start task-scheduler-backend
curl --fail --silent --show-error http://127.0.0.1:8081/health/ready
curl --fail --silent --show-error https://pm-api.khampha.dpdns.org/health/ready
```

## Release 20260908T0712-01f1718 (2026-09-08)

Member, ownership, settings, and timesheet permission release from committed source `01f1718cd7d59a54e67a3a1f8c18544c9c0774b3`.

- Immutable image: `task-scheduler-backend:20260908T0712-01f1718` (`sha256:c817f5595c6dc7d3620a2d8b0faf01d33583210cf059f133c8099c322e57ee96`).
- Committed Git archive (`backend` + `web`, LF): `/home/azuraith/task-scheduler/releases/20260908T0712-01f1718/source.tar.gz`, SHA-256 `0bef323a75559db74e788249a29b8bc4ef4aadc98f7b3e1393bccf2058a7170a`.
- Backup before replacement: `/home/azuraith/task-scheduler/releases/20260908T0712-01f1718/backup/db-before-20260908T0712-01f1718.sql.gz` (33,685 bytes; SHA-256 `9e8077d2c2e0f4358c2a5d614b8820b5ebe7ccb34bde4663037a2e5a466c37c8`; gzip verified).
- No migration or production member/owner/timesheet mutation was run. Local/public readiness reports `ready` / `up` / `current`; public introspection exposes the role enum, role-aware member queries, `Projects.user_role`, `transfer_project_ownership`, and optional timesheet `user_id` fields.
- Checks: frontend focused Jest 21/21; Ubuntu changed-file rustfmt, `cargo check --locked`, permission 4/4, contract 33/33, and immutable Docker image passed.

Immediate backend rollback:

```bash
docker stop task-scheduler-backend && docker rm task-scheduler-backend
docker rename task-scheduler-backend-prev-20260908T0712-01f1718 task-scheduler-backend
docker start task-scheduler-backend
curl --fail --silent --show-error http://127.0.0.1:8081/health/ready
curl --fail --silent --show-error https://pm-api.khampha.dpdns.org/health/ready
```

Database rollback requires a validated restore from the named pre-release backup; do not overwrite the live database in place.

## Release 20260908T0626-54da8ec5 (2026-09-08)

Clone-child destination and hard-delete GraphQL release from committed source `54da8ec5a82dd49c455f5bdccd4c9833cf618402`.

- Immutable image: `task-scheduler-backend:20260908T0626-54da8ec5` (`sha256:df387c7d2a5ecacb91e8553275256653b0038c0da0eb2b55304065438108f2ee`).
- Committed Git archive (`backend` + `web`, LF): SHA-256 `735affa4c238a8740f3e6c8b5177f407bdda5cbf0c81327a4f36ea4e6fc7a2c8`.
- Backup before replacement: `/home/azuraith/task-scheduler/releases/20260908T0626-54da8ec5/backup/db-before-20260908T0626-54da8ec5.sql.gz` (32,386 bytes; gzip verified).
- No migration or production task mutation was run. Local/public readiness reports `ready` / `up` / `current`; public schema introspection exposes clone destination inputs, `delete_task`, `DeleteTaskPayload`, and `Task.child_tasks`.
- Focused checks: combined frontend Jest 35/35; Ubuntu `cargo check --locked` and backend contract 33/33; immutable Ubuntu Docker build passed.

Immediate backend rollback:

```bash
docker stop task-scheduler-backend && docker rm task-scheduler-backend
docker rename task-scheduler-backend-prev-20260908T0626-54da8ec5 task-scheduler-backend
docker start task-scheduler-backend
curl --fail --silent --show-error http://127.0.0.1:8081/health/ready
curl --fail --silent --show-error https://pm-api.khampha.dpdns.org/health/ready
```

Database rollback requires a validated restore from the named pre-release backup; do not overwrite the live database in place.

## Release 20260908T0453-a73fff41 (2026-09-08)

Catalog delete release from source `a73fff41e6070f2fbfed46483faba93ff18bf7ad`, the clean dev integration of `b24b3b92f0d26da70867f48b57ed9aa7bcbcebd8`.

- Immutable image: `task-scheduler-backend:20260908T0453-a73fff41` (`sha256:07186991ed4fffac7c94985dfe2903dd4bb07d223dc819f66f8812949e517bba`).
- Committed Git archive (`backend` + `web`, LF): SHA-256 `bab3321f1f38362fc4c68cdfb7f36cc8225baf6634a72536e11131243b44d26e`.
- Backup before replacement: `/home/azuraith/task-scheduler/releases/20260908T0453-a73fff41/backup/db-before-20260908T0453-a73fff41.sql.gz` (32,943 bytes; gzip verified).
- No migration or production catalog mutation was run. Readiness reports `ready` / `up` / `current`; public GraphQL introspection exposes `delete_project_catalog_item`.
- Focused checks: frontend catalog Jest 13/13; Ubuntu backend contract 31/31; Ubuntu and Vercel production builds passed.
- Vercel production deployment `dpl_GjrYjW8BTdF7yNEPqqD1ZuLaY2dF` is READY and aliases `https://prjmngr.vercel.app` (final HTTP 200).

Immediate backend rollback:

```bash
docker stop task-scheduler-backend && docker rm task-scheduler-backend
docker rename task-scheduler-backend-prev-20260908T0453-a73fff41 task-scheduler-backend
docker start task-scheduler-backend
curl --fail --silent --show-error http://127.0.0.1:8081/health/ready
curl --fail --silent --show-error https://pm-api.khampha.dpdns.org/health/ready
```

Database rollback requires a validated restore from the named pre-release backup; do not overwrite the live database in place.

## Release 20260906T0645 (2026-09-06)

Ubuntu release with image `task-scheduler-backend:20260906T0645`.

Release evidence:

- Pre-release DB backup: `/home/azuraith/task-scheduler/backups/db-before-20260906T0645.sql.gz`.
- 7 forward migrations applied before serving traffic.
- Public health endpoint reports `status: ready`, `database: up`, `migrations: current`.
- GraphQL introspection sanity check returned `__typename: Query`.
- Running container: `task-scheduler-backend` on image `task-scheduler-backend:20260906T0645`, restart policy `unless-stopped`.
- Rollback container retained: `task-scheduler-backend-prev-20260906T0645` (stopped, previous release configuration).
- Vercel production deployment `task-scheduler-j2d76y4zf-vunguyenviettiens-projects.vercel.app` aliased to `prjmngr.vercel.app`.

Runtime notes:

- Container runs with the Docker runtime override `user=1000:1000`.
- The release log and config directories are bind-mounted from the host because host credential file permissions require the host uid; the image default non-root user is not used on this host.

Chrome verification (production, all passed):

1. Login.
2. Gantt view, daily granularity, 2h entry.
3. New Plan saved as revision r1.
4. Recalculate draft, then save new revision r2.
5. Excel mode and Clone controls visible.
6. Timesheet batch save of 0.25h.
7. Members capacity, groups, and recurrence forms visible.

Rollback for this release (retained previous container is pre-configured with the prior release environment):

```bash
docker stop task-scheduler-backend && docker rm task-scheduler-backend
docker rename task-scheduler-backend-prev-20260906T0645 task-scheduler-backend
docker start task-scheduler-backend
curl --fail --silent --show-error http://127.0.0.1:8081/health/ready
curl --fail --silent --show-error https://pm-api.khampha.dpdns.org/health/ready
```

Re-point the Vercel production alias `prjmngr.vercel.app` back to the previous deployment in the Vercel dashboard if a frontend rollback is also required.


## Required environment keys

Vercel Production and Preview:

- `NEXT_PUBLIC_BACKEND_URL`
- `AUTH_SESSION_SECRET`

Backend runtime:

- `DATABASE_URL`
- Firebase project/verifier configuration
- JWT and application runtime configuration already supplied by the release environment

Do not commit secret values. The server-side Firebase verifier can validate Google/Firebase ID tokens using public signing keys. Full Firebase Admin credentials are still required for service-account operations such as OAuth-backed FCM sending.

## Release artifact assembly

- Build release artifacts from a committed Git archive using `git -c core.autocrlf=false archive`, not from implicit working-tree conversion.
- Keep `backend/migrations/*.sql` as LF through `.gitattributes`; verify all historical archived migrations against deployed SQLx checksums and verify the new migration independently before building.
- Include the committed `backend/Cargo.lock` that matches `backend/Cargo.toml`, and use `cargo build --locked`. Do not regenerate or upgrade dependencies during release assembly.

## Forward migration gate

`backend/migrations/20260907000001_consolidate_project_members.sql` and `20260907000002_project_task_catalogs.sql` are forward-only and fail closed. Apply them in order. Before applying either:

1. stop or gate application writes and take a restorable database backup;
2. verify the committed archive, both migration checksums, lock file, and tested backend source identity;
3. run the migrations with the repository runner, then require migration 16 plus local and public readiness before serving traffic.

The catalog migration seeds stable per-project Progress type, Category, and Task type IDs from nonblank legacy task scalars without rewriting plan JSON. Starting the previous image does not reverse either schema change. Database rollback requires restoring the pre-migration backup; that discards or separately reconciles writes made after the backup. Keep the prior image, release files, backup, and exact runtime/network configuration until the new release is accepted. Do not record this release as deployed until those operational checks and browser acceptance complete.

## Health checks

```bash
curl --fail --silent --show-error https://pm-api.khampha.dpdns.org/health/ready
curl --fail --silent --show-error https://prjmngr.vercel.app/login
```

Expected backend readiness response:

```json
{"status":"ready","database":"up","migrations":"current"}
```

## Verified production flow

The following flow was executed with `xekobanh@gmail.com`:

1. Google sign-in through Firebase.
2. Next.js creates the signed `pm_session` cookie.
3. `/api/auth/me` resolves the Firebase identity.
4. Authenticated GraphQL requests pass through Cloudflare to Rust.
5. A project and task are created through the UI.
6. The task appears in List, Kanban, and Dashboard views.
7. The project, task, assignee, category, type, effort, and due date are present in PostgreSQL.

The dashboard deadline mapping is covered by a regression test and was verified on the production alias after the final deployment.

Production E2E data retained for inspection:

- Project: `Codex E2E Production 2026-09-01`
- Project ID: `b24aac96-4f0e-4689-8469-7222945b5df8`
- Task: `Codex E2E Task 2026-09-01`

## Rollback outline

1. Stop and remove only the current `task-scheduler-backend` container.
2. Rename and start the retained immediate rollback container `task-scheduler-backend-prev-20260908T0712-01f1718`.
3. Confirm local readiness at `http://127.0.0.1:8081/health/ready`.
4. Confirm public readiness through `pm-api.khampha.dpdns.org`.

The rollback container retains the prior image, network, mounts, runtime user, and environment. Do not remove it or the pre-release backup until the new release has remained stable.

## Known non-blocking follow-ups

- GraphQL WebSocket authentication is not covered by the new Firebase HTTP fallback.
- Production GraphQL logging currently includes full query documents and variables; redact or reduce this before handling sensitive mutation inputs.
- Full Firebase service-account credentials are needed if FCM OAuth sending is enabled.
- One legacy Rust test fixture (`auth_common::test_token_flow`) inserts a null username into a non-null column; the production auth and targeted Firebase GraphQL tests pass independently.
