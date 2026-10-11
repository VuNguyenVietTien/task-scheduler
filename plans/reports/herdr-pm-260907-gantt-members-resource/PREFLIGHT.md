# PREFLIGHT — Ubuntu + Vercel release readiness

**Task:** PREFLIGHT  
**Checked:** 2026-09-07 Asia/Bangkok  
**Mode:** read-only external readiness; no build, migration, deploy, restart, container mutation, browser, install, commit, or push  
**Status:** DONE_WITH_CONCERNS

## Verdict

- **Ubuntu backend: READY.** Current Windows SSH route is alias `u-cf`, not historical alias `u`. Non-interactive existing authentication succeeded as `azuraith` on host `khampha` through configured Cloudflare SSH proxy.
- **Vercel frontend: BLOCKED on CLI authentication.** CLI and local project link are ready, but `vercel whoami` reports logged out and no `VERCEL_TOKEN` is present. Do not release frontend until existing account authentication is restored through a non-echoing operator path.
- **Public production: READY now.** Backend readiness is `ready / up / current`; GraphQL returns `Query`; frontend login redirect resolves to HTTP 200.

## Sources checked

Authority: `AGENTS.md`; `docs/README.md`; `docs/project-overview-pdr.md`; `docs/code-standards.md`; `docs/system-architecture.md`; `docs/development-roadmap.md`; `docs/deployment.md`.

Release inputs: `release-manifest.json`; `backend/Dockerfile`; `backend/.dockerignore`; `backend/Cargo.toml`; `backend/src/bin/migrate.rs`; `backend/src/migration_runner.rs`; `backend/docker-compose.yml`; `backend/deploy/production.yml`; `frontend/package.json`; `frontend/next.config.mjs`; `web/package.json`; `web/next.config.mjs`; `web/vercel.json`; `web/.vercel/project.json`; `web/.gitignore`; root `.vercelignore`; plan and prior deployment reports under `plans/reports/herdr-260906-plan-deploy/` and `herdr-260831-ubuntu-deploy-preflight.md`.

`release-manifest.json` is a ClaudeKit boilerplate manifest (`2.10.1`, generated 2026-02-05), not the production release manifest. Current authority is `docs/deployment.md` plus live inspection.

## Ubuntu evidence

### Access

| Check | Result |
| --- | --- |
| Verified alias | `u-cf` |
| SSH metadata | user `azuraith`, host `ssh.khampha.dpdns.org`, port 22, proxy command configured |
| Non-interactive auth | `ssh -o BatchMode=yes u-cf ...` succeeded; remote hostname `khampha` |
| Historical alias `u` | Not configured in this Windows SSH config |
| Direct LAN `192.168.1.5:22` | Timed out from this machine; do not use for this release |

### Runtime and storage

| Item | Live result |
| --- | --- |
| OS | Ubuntu 24.04 |
| `/home` | 401G total, 19G used, 362G available (5%) |
| Backend | `task-scheduler-backend`, running, image `task-scheduler-backend:20260906T0645`, restart `unless-stopped` |
| Immediate rollback container | `task-scheduler-backend-prev-20260906T0645`, stopped, image `task-scheduler-backend:20260901T1235` |
| PostgreSQL | `task_scheduler_postgres`, running, `postgres:16-alpine`, bound only to `127.0.0.1:5434`, restart `unless-stopped` |
| Backend networking | host network; app serves host port 8081 from runtime configuration |
| Runtime user | `1000:1000` |
| Docker storage | images 1.691GB; build cache 5.501GB; ample host headroom |
| Writable release roots | `/home/azuraith/task-scheduler`, `releases`, `backups`, and shared uploads |

Current bind mounts were verified by metadata only: release configuration read-only, shared uploads read-write, and release log read-write. No environment or credential value was read or printed.

### Releases, backup, and migrations

- Releases present: `20260901T0900`, `20260901T1235`, `20260906T0645`.
- Current release: `/home/azuraith/task-scheduler/releases/20260906T0645`.
- Current pre-release backup: `/home/azuraith/task-scheduler/backups/db-before-20260906T0645.sql.gz`; readable and `gzip -t` valid.
- Database authentication from inside the PostgreSQL container works non-interactively without exposing values.
- Database records **14 successful migrations**; latest `20260906000002`.
- Required backend runtime key names are present: `APP_ENV`, `SERVER_PORT`, `DATABASE_URL`, `JWT_SECRET`, `AUTH_SECRET`, `FRONTEND_ORIGINS`, `RUN_MIGRATIONS`. Values were not displayed.
- Current release directory has source and migrations, but no host `target/release` binary; production runs the Docker image. Future migration command therefore compiles/runs from release source.

### Tool availability

- Docker `28.4.0`; Buildx `0.27.0`.
- Cargo/Rust `1.91.0-nightly` through login shell.
- GNU tar `1.35`, gzip `1.12`, curl `8.5.0`.
- Container `pg_dump` `16.10`.

## Vercel evidence

| Check | Result |
| --- | --- |
| CLI | Vercel CLI `59.11.7`, Node.js `24.16.0` |
| Build root | `web/` (production app; `frontend/` is not the linked production project) |
| Build command | `npm run build` → `next build` |
| Link | `web/.vercel/project.json` links project `task-scheduler` in `vunguyenviettiens-projects` |
| Packaging | `web/.gitignore` excludes `.env*`, `.vercel`, `node_modules`, `.next`, build output, logs, and key files; root `.vercelignore` also whitelists only `web/` for root-origin uploads |
| Authentication | **Not ready:** CLI logged out; no token environment variable present |
| Current CLI dry option | `vercel deploy --dry` (prior report's `--dry-run` is stale for CLI 59.11.7) |
| Production command supported | `--prod`, `--yes`, `--cwd`, `--scope` confirmed by current help |
| Rollback command supported | `vercel rollback <url-or-id> --yes` confirmed by current help |

Required Vercel key names per deployment authority are `NEXT_PUBLIC_BACKEND_URL` and `AUTH_SESSION_SECRET`. Their remote presence could not be checked while logged out; this remains part of the auth blocker.

## Public health evidence

```text
https://pm-api.khampha.dpdns.org/health/ready -> HTTP 200
body metadata -> status=ready, database=up, migrations=current
POST /graphql { __typename } -> Query, no errors
https://prjmngr.vercel.app/login -> HTTP 307
follow redirect -> https://prjmngr.vercel.app/auth?next=%2Flogin, HTTP 200
```

## Exact commands for the later assigned release

**Not run in this preflight.** Release operator must first substitute one UTC tag consistently and retain the current assets.

### 1. Package backend on Windows without local secrets/artifacts

```powershell
$tag = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmm')
$archive = "$env:TEMP\task-scheduler-backend-$tag.tgz"
tar -czf $archive `
  --exclude=backend/target `
  --exclude=backend/node_modules `
  --exclude=backend/.env `
  --exclude=backend/.env.* `
  --exclude=backend/config `
  --exclude=backend/*.log `
  backend
scp $archive "u-cf:/home/azuraith/task-scheduler/task-scheduler-backend-$tag.tgz"
```

### 2. Stage and build Ubuntu image

```bash
ssh -o BatchMode=yes u-cf
set -euo pipefail
set +x
TAG=<same-UTC-tag>
ROOT=/home/azuraith/task-scheduler
CURRENT="$ROOT/releases/20260906T0645"
RELEASE="$ROOT/releases/$TAG"
ARCHIVE="$ROOT/task-scheduler-backend-$TAG.tgz"
IMAGE="task-scheduler-backend:$TAG"

mkdir -p "$RELEASE"
tar -xzf "$ARCHIVE" -C "$RELEASE"
rm "$ARCHIVE"

# BuildKit receives only DATABASE_URL as a transient secret; nothing echoed.
(
  set -a
  . "$CURRENT/backend/.env.production"
  set +a
  DOCKER_BUILDKIT=1 docker build --pull \
    --secret id=database_url,env=DATABASE_URL \
    -t "$IMAGE" "$RELEASE/backend"
)

# Fail closed without printing any matching history line.
if docker history --no-trunc "$IMAGE" | grep -q 'postgres://'; then
  echo 'BLOCKED: database URL marker detected in image history'
  exit 1
fi

# Preserve runtime-only secret/config material outside the build context.
cp -a "$CURRENT/backend/.env.production" "$RELEASE/backend/.env.production"
mkdir -p "$RELEASE/backend/config" "$RELEASE/runtime"
cp -a "$CURRENT/backend/config/config" "$RELEASE/backend/config/config"
: > "$RELEASE/runtime/backend.log"
chmod 600 "$RELEASE/backend/.env.production" "$RELEASE/backend/config/config"

grep -q '^SERVER_PORT=8081$' "$RELEASE/backend/.env.production" || { echo 'BLOCKED: SERVER_PORT must remain 8081'; exit 1; }
grep -q '^RUN_MIGRATIONS=false$' "$RELEASE/backend/.env.production" || { echo 'BLOCKED: startup auto-migration must remain disabled'; exit 1; }
```

### 3. Backup, then apply migrations explicitly

```bash
BACKUP="$ROOT/backups/db-before-$TAG.sql.gz"
TMP_BACKUP="$BACKUP.tmp"

docker exec task_scheduler_postgres sh -lc \
  'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip -c > "$TMP_BACKUP"
test -s "$TMP_BACKUP"
gzip -t "$TMP_BACKUP"
mv "$TMP_BACKUP" "$BACKUP"

(
  cd "$RELEASE/backend"
  set -a
  . ./.env.production
  set +a
  bash -lc 'cargo run --release --locked --bin migrate'
)
```

Constraints:

- Backup must complete and validate before migration.
- Use only the project migration runner (`cargo run --release --locked --bin migrate`); do not invoke raw stock SQLx migration ordering.
- Do not use `--baseline` on this established database.
- Keep `RUN_MIGRATIONS=false` for normal container startup.
- Migration `20260906000001` contains a non-concurrent task index; schedule a brief write window if a later release has not already applied it. Current production has applied it.

### 4. Swap backend container using the verified runtime contract

```bash
PREV="task-scheduler-backend-prev-$TAG"
docker stop task-scheduler-backend
docker rename task-scheduler-backend "$PREV"

docker run -d \
  --name task-scheduler-backend \
  --restart unless-stopped \
  --network host \
  --user 1000:1000 \
  --env-file "$RELEASE/backend/.env.production" \
  -v "$RELEASE/backend/config/config:/usr/src/app/config:ro" \
  -v "$ROOT/shared/uploads:/usr/src/app/uploads" \
  -v "$RELEASE/runtime/backend.log:/usr/src/app/backend.log" \
  "$IMAGE"

curl --fail --silent --show-error http://127.0.0.1:8081/health/ready
curl --fail --silent --show-error https://pm-api.khampha.dpdns.org/health/ready
curl --fail --silent --show-error \
  -H 'Content-Type: application/json' \
  --data '{"query":"{ __typename }"}' \
  https://pm-api.khampha.dpdns.org/graphql
```

Do not remove `$PREV`, prior images, prior releases, or the DB backup until the new release remains stable.

### 5. Vercel production release after authentication is restored

```powershell
vercel whoami
vercel deploy --dry --cwd web --scope vunguyenviettiens-projects
vercel deploy --prod --yes --cwd web --scope vunguyenviettiens-projects
curl.exe --fail --silent --show-error --location --output NUL https://prjmngr.vercel.app/login
```

`vercel whoami` must succeed first. Never pass or echo a token on the command line; use the operator's existing secure Vercel credential mechanism. Confirm the two required Vercel key names before production deployment.

## Rollback commands

### Backend: immediate retained-container rollback

```bash
docker stop task-scheduler-backend
docker rm task-scheduler-backend
docker rename "task-scheduler-backend-prev-$TAG" task-scheduler-backend
docker start task-scheduler-backend
curl --fail --silent --show-error http://127.0.0.1:8081/health/ready
curl --fail --silent --show-error https://pm-api.khampha.dpdns.org/health/ready
```

Database migrations are forward-only. Restore the validated pre-release dump only after explicit DB-owner approval and compatibility assessment; container rollback alone does not reverse schema.

### Vercel

Record the production deployment URL before releasing. Current known rollback target is `task-scheduler-j2d76y4zf-vunguyenviettiens-projects.vercel.app`:

```powershell
vercel rollback task-scheduler-j2d76y4zf-vunguyenviettiens-projects.vercel.app --yes --cwd web --scope vunguyenviettiens-projects
```

## Blockers and concerns

1. **Blocking frontend release:** Vercel CLI authentication absent; remote project environment and deployment listing cannot be verified.
2. **Route correction:** use `u-cf`; `u` is stale/unconfigured on this Windows host and direct LAN SSH is unavailable.
3. Backend container has no Docker-native healthcheck; release gate must use explicit local and public readiness curls.
4. `next.config.mjs` skips ESLint and TypeScript build failures. Tests/review must remain the quality gate before Vercel release.
5. Prior Vercel report names `--dry-run`; current CLI uses `--dry`.

## Unresolved questions

- Who will restore the existing Vercel CLI authentication (or securely provide the established release token) before the frontend release assignment begins?
