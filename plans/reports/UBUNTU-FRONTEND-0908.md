# UBUNTU-FRONTEND-0908

## Status

DONE — read-only discovery. No deployment action is supported on Ubuntu today.

## Existing route

- Existing test domain: `https://prjmngr.vercel.app` only. It is Vercel-backed and currently cannot be retried before the stated rate-limit window.
- Existing backend domain: `https://pm-api.khampha.dpdns.org`.
- Ubuntu has the current task-scheduler backend plus retained backend rollback containers/images. It has **no** task-scheduler frontend container, image, systemd unit, or frontend tunnel route.
- Therefore there is no existing Ubuntu frontend domain, deploy command, or frontend rollback target for commit `3790856`.

## Why the dormant Docker route is not deployable as-is

- `web/Dockerfile` expects `.next/standalone`.
- `web/next.config.mjs` disables `output: 'standalone'` for Vercel.
- The tracked root compose frontend route is not evidence of a live Ubuntu service. Do not run it as an ad-hoc replacement.

## Auth/proxy compatibility

- Active Apollo traffic uses `NEXT_PUBLIC_BACKEND_URL` (default `pm-api.khampha.dpdns.org`) directly, sends Firebase bearer tokens, and omits cookies.
- `/api/graphql` is local GraphQL Yoga, not a proxy to the Rust backend.
- A future Ubuntu frontend would need a public HTTPS hostname plus backend CORS and Firebase authorized-origin/redirect compatibility. This requires a separately approved frontend/tunnel configuration; no existing proxy can safely be reused from the evidence.

## Rollback

- Frontend rollback remains Vercel alias re-pointing to the prior Vercel deployment. Deployment reports conflict on the latest deployment ID, so do not select a rollback deployment from these docs alone.
- Ubuntu backend rollback assets are unrelated and must not be used for frontend rollback.

## Read-only evidence

- Safe SSH metadata confirmed only task-scheduler backend containers/images; no frontend counterparts.
- No remote/local service, database, tunnel, environment, or credential changed.

## Unresolved questions

- If Ubuntu frontend deployment is later assigned: approve a new HTTPS hostname/tunnel, restore or change standalone build support, configure authorized origins, and define an explicit retained frontend image/container rollback target.
