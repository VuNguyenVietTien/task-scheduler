# Production Deployment

Last verified: 2026-09-06 (Asia/Ho_Chi_Minh)

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
| Vercel deployment | `task-scheduler-j2d76y4zf-vunguyenviettiens-projects.vercel.app` (aliased `prjmngr.vercel.app`) |
| Backend API | `https://pm-api.khampha.dpdns.org` |
| Backend container | `task-scheduler-backend` |
| Backend image | `task-scheduler-backend:20260906T0645` |
| Backend release | `/home/azuraith/task-scheduler/releases/20260906T0645` |
| PostgreSQL container | `task_scheduler_postgres` |
| Cloudflare origin | `http://localhost:8081` |

The previous backend image and release are retained for rollback:

- `task-scheduler-backend:20260901T0900`
- `/home/azuraith/task-scheduler/releases/20260901T0900`

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
2. Start the same container configuration with image `task-scheduler-backend:20260901T0900` and the retained release environment.
3. Confirm local readiness at `http://127.0.0.1:8081/health/ready`.
4. Confirm public readiness through `pm-api.khampha.dpdns.org`.

Resolve and record the exact container environment/network flags before running a rollback. Do not remove either retained image/release until the new release has remained stable.

## Known non-blocking follow-ups

- GraphQL WebSocket authentication is not covered by the new Firebase HTTP fallback.
- Production GraphQL logging currently includes full query documents and variables; redact or reduce this before handling sensitive mutation inputs.
- Full Firebase service-account credentials are needed if FCM OAuth sending is enabled.
- One legacy Rust test fixture (`auth_common::test_token_flow`) inserts a null username into a non-null column; the production auth and targeted Firebase GraphQL tests pass independently.
