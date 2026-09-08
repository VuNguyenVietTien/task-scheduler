# RELEASE-CATALOG-DELETE-0908

- Date: 2026-09-08 Asia/Bangkok
- Status: DONE
- Scope: backward-compatible GraphQL catalog delete + catalog Settings UI only

## Integration

- Source: `b24b3b92f0d26da70867f48b57ed9aa7bcbcebd8` from `origin/codex/catalog-access-0908`.
- Dev integration: `a73fff41e6070f2fbfed46483faba93ff18bf7ad`; clean exact-path cherry-pick on `2fe9db9`.
- Author/committer: `TienVNV <xekobanh@gmail.com>`.
- No migration, reset, dependency, or production catalog-data mutation.

## Built artifacts and focused checks

- Committed LF Git archive (`backend` + `web`): SHA-256 `bab3321f1f38362fc4c68cdfb7f36cc8225baf6634a72536e11131243b44d26e`.
- Ubuntu frontend production build: PASS.
- Catalog Jest: `project-catalog-settings.test.tsx`, 1 suite / 13 tests PASS. Used the existing reporter override only because clean `npm ci` lacks configured `jest-junit`; source unchanged.
- Ubuntu backend: `cargo test --locked --test contract`, 31/31 PASS. Contract locks the authorized transaction, lock ordering, all three ID + legacy-scalar clear pairs, and SDL mutation/payload.
- Immutable backend image: `task-scheduler-backend:20260908T0453-a73fff41`, `sha256:07186991ed4fffac7c94985dfe2903dd4bb07d223dc819f66f8812949e517bba`; image-history audit PASS.
- The first backend build could not reach loopback PostgreSQL from Docker bridge; reran builder with host networking for SQLx metadata only. No data mutation.

## Backend release

- Release directory: `/home/azuraith/task-scheduler/releases/20260908T0453-a73fff41`.
- Pre-replacement backup: `backup/db-before-20260908T0453-a73fff41.sql.gz`, 32,943 bytes, gzip verified.
- Running image: `task-scheduler-backend:20260908T0453-a73fff41`.
- Immediate stopped rollback: `task-scheduler-backend-prev-20260908T0453-a73fff41` on `task-scheduler-backend:20260908T0352-db31fcb9`; retains its runtime configuration.
- Local and public `/health/ready`: `ready` / `up` / `current`.
- Public GraphQL introspection: `delete_project_catalog_item` present.

## Git and frontend release

- Before release documentation commit, `origin/dev` and `origin/main` were fast-forwarded without force to identical `a73fff41e6070f2fbfed46483faba93ff18bf7ad`.
- Vercel account/project: `vunguyenviettien` / `vunguyenviettiens-projects/task-scheduler`.
- Initial CLI deploy from `web/` failed before publication because Vercel project Root Directory is `web`; corrected by deploying repository root with explicit existing project/scope.
- Production deployment: `dpl_GjrYjW8BTdF7yNEPqqD1ZuLaY2dF`.
- Deployment URL: `https://task-scheduler-mhg3tac41-vunguyenviettiens-projects.vercel.app`.
- Vercel: READY; alias `https://prjmngr.vercel.app` final HTTP 200.

## Rollback

```bash
docker stop task-scheduler-backend && docker rm task-scheduler-backend
docker rename task-scheduler-backend-prev-20260908T0453-a73fff41 task-scheduler-backend
docker start task-scheduler-backend
curl --fail --silent --show-error http://127.0.0.1:8081/health/ready
curl --fail --silent --show-error https://pm-api.khampha.dpdns.org/health/ready
```

Database rollback requires a validated restore from the named pre-release backup; never overwrite the live database in place.

## Unresolved questions

None.
