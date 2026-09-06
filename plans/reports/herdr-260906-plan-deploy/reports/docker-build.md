# Docker build fix — backend/Dockerfile (REWORK: BuildKit secret)

- Task: herdr-260906-plan-deploy (docker-build) — **rework round**
- Mode: edit only; no commit / push / deploy / SSH / delete
- Files written: `backend/Dockerfile`, this report
- Deadline: 5 minutes; report written within deadline
- Rework objective: replace the `ARG DATABASE_URL` build-arg with a **BuildKit secret** so production DB credentials can never be stored in image layers/history/metadata.

## 1. Scope inspection results (unchanged from first pass)

| File | Status |
| --- | --- |
| `backend/Dockerfile` | Old version broken — **rewritten twice (final: BuildKit-secret variant)** |
| `backend/Cargo.toml` | Binary `task-scheduler-backend`, edition 2021, native-tls (openssl-sys) dep tree |
| `backend/Cargo.lock` | Lockfile format `version = 4` (line 3) → requires Cargo ≥ 1.78 |
| `docs/deployment.md` | Production: container `task-scheduler-backend`, host port 8081, image tags `task-scheduler-backend:YYYYMMDDTHHMM`, retained previous image for rollback |
| `README.md` (repo root) | **Does not exist** (ENOENT). Nearest: `backend/README.md` (docker build/run contract, port 8080) |

Source facts verified earlier (read-only):

- `backend/src/config.rs:161-170`: `SERVER_HOST`→`HOST` fallback (default `127.0.0.1`), `SERVER_PORT`→`PORT` fallback (default `8080`); SERVER_* canonical and **wins** over HOST/PORT; HOST/PORT is the existing Docker/Compose contract.
- `backend/src/main.rs:99`: reads `config/firebase-service-account.json` relative to WORKDIR → `/usr/src/app/config` mount target with WORKDIR `/usr/src/app`.
- Compose mounts `./uploads:/usr/src/app/uploads`; production healthcheck uses `curl -f http://localhost:8080/health`.
- `sqlx::query!` macros used; no `backend/.sqlx/` cache; `.env` dockerignored → build context carries no DATABASE_URL.
- sqlx-macros-core 0.7.4 registry source (`query/mod.rs:142,183`): macros need DATABASE_URL env **or** `.sqlx/` cache, else compile error.

## 2. Root cause of failed production build (unchanged)

1. `rust:1.70` cannot parse `Cargo.lock` v4 (needs Cargo ≥ 1.78) — build fails before compiling.
2. `debian:bullseye-slim` runtime is EOL; `apt-get install libssl1.1` 404s.

## 3. Exact changes to `backend/Dockerfile` (final state)

1. Builder: `rust:1.70` → **`rust:1-bookworm`** (maintained rolling-stable; Docker Hub tag verified live, updated 2026-08-25; parses lockfile v4; OpenSSL 3 ABI matches runtime).
2. Runtime: `debian:bullseye-slim` + `libssl1.1` → **`debian:bookworm-slim` + `libssl3`**; added `curl` (production healthcheck), kept `ca-certificates`; `--no-install-recommends` everywhere.
3. Non-root: dedicated **`app` user/group uid/gid 10001** (system, nologin), `chown -R app:app /usr/src/app`, `USER app` (replaces `nobody`).
4. Mount compatibility preserved: WORKDIR `/usr/src/app` unchanged; pre-created writable `uploads/` and `config/` (compose `./uploads:/usr/src/app/uploads`; main.rs relative `config/firebase-service-account.json`).
5. Env conventions: image defaults `ENV HOST=0.0.0.0` / `ENV PORT=8080` (Docker/Compose contract). `SERVER_*` deliberately NOT baked in — per `config.rs` they override `HOST`/`PORT`, which would silently defeat the production `PORT=8081` override. `EXPOSE 8080`, exec-form `CMD ["./task-scheduler-backend"]` (binary name preserved).
6. **REWORK — credential handling**: the previous `ARG DATABASE_URL` is **removed**. The build stage now uses a BuildKit secret consumed only by the build RUN:

   ```dockerfile
   RUN --mount=type=secret,id=database_url \
       if [ -s /run/secrets/database_url ]; then \
           export DATABASE_URL="$(cat /run/secrets/database_url)"; \
       fi && \
       cargo build --release --locked
   ```

   Properties: secret mounted at `/run/secrets/database_url` **only for that RUN**; BuildKit secrets are never written to layers, image config, or `docker history`; `-s` guard treats an empty secret as absent (sqlx fails parsing `""` as a live URL); without the secret the build proceeds for `.sqlx`-offline workflows; `--locked` keeps lockfile v4 integrity.

## 4. Validation performed (Docker daemon still unavailable locally)

Daemon down (`Cannot connect to the Docker daemon ...docker.sock`) → no local `docker build`. Strongest available validation:

1. **Acceptance grep**: `grep -nE '^\s*(ARG|ENV).*DATABASE_URL' backend/Dockerfile` → **no matches** (`NO_ARG_ENV_DATABASE_URL`); exactly 1 `mount=type=secret` occurrence.
2. **RUN script syntax**: the secret-consuming shell script passes `sh -n` and `bash -n` (`RUN_SYNTAX_OK`).
3. **BuildKit compatibility**: local Docker `27.5.1` + buildx `v0.20.1-desktop.2` — BuildKit is the default builder and `RUN --mount=type=secret` is stable under the `# syntax=docker/dockerfile:1` frontend already declared on line 1. Compatible with any Docker ≥ 23.0 (or `DOCKER_BUILDKIT=1` on older CLIs).
4. **Toolchain consistency** (from first pass, still valid): `cargo metadata --locked` exit 0 (449 crates); lockfile v4 valid; strum 0.27.1 MSRV 1.66.1; `rust:1-bookworm` tag live.
5. **Dockerfile review**: secret is RUN-scoped only; no other directives reference DATABASE_URL; exec-form CMD, layer hygiene, non-root, mounts, binary name, HOST/PORT defaults all preserved.

### Exact safe build command (acceptance test when Docker is available)

```bash
cd backend
export DATABASE_URL='postgres://user:pass@db-host:5432/task_scheduler'   # shell env only; never a build-arg
DOCKER_BUILDKIT=1 docker build --pull \
  --secret id=database_url,env=DATABASE_URL \
  -t task-scheduler-backend:$(date +%Y%m%dT%H%M) .
# Post-build leak audit (expect NO credentials anywhere):
docker history --no-trunc task-scheduler-backend:<tag> | grep -i 'postgres://' && echo LEAK || echo CLEAN
docker inspect task-scheduler-backend:<tag> --format '{{json .Config.Env}} {{json .Config.Args}}'
# Runtime sanity: user, TLS libs, mounts:
docker run --rm --entrypoint sh task-scheduler-backend:<tag> \
  -c 'id && ldd ./task-scheduler-backend | grep -E "libssl|not found" && ls -ld uploads config'
```

BuildKit secret semantics guarantee `docker history`/`inspect` show no credential, and the secret is absent from `/run/secrets` in every subsequent layer.

## 5. Rollback risk

- **Trivial**: only `backend/Dockerfile` (uncommitted) changed. `git checkout -- backend/Dockerfile` restores the pre-fix version. No images/containers/releases touched; production image `task-scheduler-backend:20260901T1235` and rollback image `:20260901T0900` untouched.
- Behavioral deltas on first deploy from the new image: (a) container uid 10001 (was nobody) — bind-mounted host dirs must permit that uid; (b) OpenSSL 3 runtime — monitor first TLS handshakes (native-tls line in lock is OpenSSL 3-compatible); (c) builds now REQUIRE `--secret id=database_url,env=DATABASE_URL` (or a committed `.sqlx/` cache) — CI scripts using the old no-arg/no-secret invocation will fail at sqlx macro expansion with a clear error.
- Rework-specific risk: if a wrapper forgets `--secret`, the build fails loudly (macro error) rather than silently embedding creds — fail-safe direction.

## 6. Remaining acceptance

1. **`docker build` not executed locally** — Docker daemon down (exact error above). Run the §4 command to close acceptance; verify with the history/inspect leak audit.
2. **sqlx offline cache still missing** (pre-existing): credential-free builds need `cargo sqlx prepare --workspace` + committed `backend/.sqlx/` + `ENV SQLX_OFFLINE=true` in the build stage — out of 2-file write scope.
3. Dependency-layer caching (manifests-first dummy build / cargo-chef) not added — perf only.
4. Repo-root `README.md` absent (scope listed it); separate docs task if expected.
5. CI/pipeline definitions referencing the old `--build-arg DATABASE_URL` pattern (if any exist outside scope) must switch to `--secret id=database_url,env=DATABASE_URL`.

*Report written before deadline; all validation evidence reproducible from quoted commands.*
