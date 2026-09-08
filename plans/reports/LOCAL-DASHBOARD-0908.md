# LOCAL-DASHBOARD-0908

## Status

**READY FOR PM CHROME RELOAD** — backend-only CORS fix live. Frontend unchanged; local Next server remains on `127.0.0.1:3000`, listener PID `45716`; no restart performed.

## Root cause

Local Apollo directly calls `https://pm-api.khampha.dpdns.org/graphql` from `http://localhost:3000`. Ubuntu production backend had exact `FRONTEND_ORIGINS=https://prjmngr.vercel.app`; Actix `block_on_origin_mismatch(true)` rejected localhost preflight before GraphQL execution.

This was CORS, not CSP, Firebase login, backend health, DNS/IP, or wrong endpoint.

## Evidence before fix

- Local `NEXT_PUBLIC_BACKEND_URL` → `https://pm-api.khampha.dpdns.org`; `web/src/lib/apollo-client.ts` appends `/graphql` and sends browser `Authorization` + `Content-Type`.
- `GET https://pm-api.khampha.dpdns.org/health/ready` → `200`; `status=ready`, `database=up`, `migrations=current`.
- Read-only `POST /graphql` query `ReadOnlyProbe { __typename }` → `200`, `__typename=Query`.
- Exact preflight (`POST`, requested headers `authorization,content-type`):
  - `Origin: http://localhost:3000` → `400`, no `Access-Control-Allow-Origin`, 42-byte response.
  - `Origin: https://prjmngr.vercel.app` → `200`, matching ACAO, credentials true, allowed headers include `authorization,content-type`.
- Local `/dashboard` response had no CSP header. Endpoint and backend were healthy.

## Fix

User rejected proxy approach. All proxy edits/worktree were discarded; local Apollo remains direct and unchanged.

Backend source now permits one production HTTP exception only: exact `http://localhost:3000`. Existing HTTPS origins remain supported. `http://localhost:3001`, `http://127.0.0.1:3000`, wildcards, and arbitrary origins remain invalid/rejected.

Live runtime allowlist:

```text
https://prjmngr.vercel.app,http://localhost:3000
```

No secret/runtime values beyond the non-secret origin allowlist were printed or committed.

## Tests and live verification

- Changed-file `rustfmt --check`: passed.
- Focused Ubuntu platform tests: **7 passed, 0 failed**; includes exact localhost acceptance and nearby localhost/127.0.0.1 rejection.
- New immutable image: `task-scheduler-backend:20260908T0925-0218f17`.
- Local backend readiness: `ready / up / current`.
- Public backend readiness: `ready / up / current`.
- Post-fix exact preflight (`POST`, `authorization,content-type`):
  - `Origin: http://localhost:3000` → `200`; `access-control-allow-origin: http://localhost:3000`; credentials true; allowed headers include `content-type, authorization`; body 0 bytes.
  - `Origin: https://prjmngr.vercel.app` → `200`; matching production ACAO; credentials true; allowed headers include `content-type, authorization`; body 0 bytes.
  - `Origin: https://evil.example` → `400`; no ACAO; 42-byte response.
- No database/schema/migration/task writes. Docker build used the existing database connection only for SQLx compile-time query metadata.

## Commits / branch

Branch pushed: `fix/local-dashboard-cors-0908`

- `0218f17 fix(cors): allow exact local dashboard origin`
- `52e74b5 docs(deploy): record local dashboard CORS release`

PM integration target: source commit `0218f17`; documentation commit `52e74b5` follows it.

## Live deployment and rollback

Live container:

- Image: `task-scheduler-backend:20260908T0925-0218f17`
- Restart policy: `unless-stopped`
- Network/user/mount contract preserved.

Exact previous container retained stopped:

- `task-scheduler-backend-prev-20260908T0925-0218f17`
- Previous image: `task-scheduler-backend:20260908T0712-01f1718`

Rollback:

```bash
docker stop task-scheduler-backend && docker rm task-scheduler-backend
docker rename task-scheduler-backend-prev-20260908T0925-0218f17 task-scheduler-backend
docker start task-scheduler-backend
curl --fail --silent --show-error http://127.0.0.1:8081/health/ready
curl --fail --silent --show-error https://pm-api.khampha.dpdns.org/health/ready
```

## PM handoff

Reload `http://localhost:3000/dashboard` in the already-authenticated Chrome tab. CORS transport is ready; confirm dashboard projects/notifications render and browser console no longer shows Apollo `Failed to fetch`.

## Unresolved questions

None.
