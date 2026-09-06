# Vercel upload containment — root `.vercelignore`

- Task: herdr-260906-plan-deploy (vercel-upload)
- Mode: edit only; no deploy / network / commit / delete
- Files written: root `.vercelignore`, this report
- Deadline: 5 minutes; report written within deadline

## 1. Scope inspection results

| File | Finding |
| --- | --- |
| `.gitignore` (root) | Ignores `node_modules/`, `.next/`, `.env*`, `target/`, `*.log`, `.vercel`, `logDebug/`, `plans`-adjacent task dirs. Confirms what is local-only, but Vercel CLI does not use .gitignore as its upload filter — hence a dedicated `.vercelignore` was needed. |
| `.vercelignore` (root, `web/`) | **Did not exist** before this task (created now at root). |
| `web/package.json` | `task-scheduler` — private Next.js app (`next build`), jest for tests, postinstall only disables telemetry. Deploy requires `src/`, `public/`, config files, and `package-lock.json` (npm ci on Vercel). |
| `web/.vercel/project.json` | Link exists: `{"projectId":"prj_q4s9b505ULq8NkSwy0FDWMK0uoz3","orgId":"team_x3BJBnMaOL2NCDpQ74kb1Pv9"}` — non-secret IDs; confirms project linked at `web/`. |
| `docs/deployment.md` | Frontend on Vercel (`prjmngr.vercel.app`), repo `vunguyenviettiens-projects/task-scheduler`; backend explicitly NOT on Vercel (Cloudflare → Ubuntu). Justifies excluding everything outside `web/`. |

## 2. Problem

`web/` on disk is **1.7 GB** (`node_modules` 1.3 G + `.next` 425 M), and the repo root holds `backend/` (incl. `target/`, logs), other app trees, `plans/` reports, docs, secrets templates. A `vercel` CLI run from the repository root would try to upload far beyond the 10 MB deployment limit and/or ship local artifacts/secrets.

## 3. Solution: whitelist-style root `.vercelignore`

Pattern logic (gitignore semantics; later rules override earlier):

1. `*` — **deny-all default**. Nothing at repo root uploads: `backend/`, `frontend/`, `design-doc-service/`, `docs/`, `plans/` (local reports/artifacts), `.git`, caches, stray logs, secrets — all covered by one rule, future-proof for new top-level dirs.
2. `!web` + `!web/**` — re-allow the Vercel **Root Directory** and its full tree (source, `public/`, `scripts/`, `supabase/`, all config files, `package-lock.json`).
3. Override re-allow for generated/local artifacts inside `web`: `web/node_modules/` (installed during Vercel build), `web/.next/` (build output), `web/logs/`, `web/logDebug/`, `web/plans/`, `web/Users/`, `web/tsconfig.tsbuildinfo` (incremental cache), `.DS_Store`/`**/.DS_Store`.
4. Explicit secrets guard: `web/.env`, `web/.env.*` (matches the existing `web/.env.local`), re-allowing only `.env.example`. `web/.env.local.example` stays excluded (template, not needed for build — fails closed).

**Deliberately kept:** `web/package-lock.json` (required for reproducible `npm ci`), `web/public/`, `web/src/` (including `*_backup.tsx` — referenced or harmless source), `next.config.mjs`, `jest.*` configs, `supabase/`, `scripts/`, `docs/` inside web (tiny). **Tests kept** (task said "if safe"): they are small and excluding `*.test.*` risks breaking imports for zero meaningful size gain; current set is already well under budget. `web/.vercel` link dir is auto-excluded by the CLI and excluded in the inventory.

## 4. Validation — upload-set inventory (per the rules above)

Computed with `find` mirroring the ignore rules (dependency install artifacts and build outputs excluded):

| Metric | Value |
| --- | --- |
| Upload set | **472 files, 4.11 MB** |
| Limit | 10 MB → **~2.4× headroom** |
| Largest files | `package-lock.json` 672K, `TaskDetailPage_backup.tsx` 96K, `TaskDetailPage.tsx` 92K, `Timeline.tsx` 88K, `TaskListView.tsx` 80K |
| Excluded heavies | `node_modules` 1.3 G, `.next` 425 M, `logs` 888K, `tsbuildinfo` 924K, `logDebug` 168K, `plans` 176K |

Reproducible check (no network, no deploy):

```bash
find web -type f \
  -not -path "web/node_modules/*" -not -path "web/.next/*" \
  -not -path "web/logs/*" -not -path "web/logDebug/*" \
  -not -path "web/plans/*" -not -path "web/Users/*" \
  -not -path "web/.vercel/*" -not -name "tsconfig.tsbuildinfo" \
  -not -name ".DS_Store" -not -name ".env" -not -name ".env.*" \
  -exec du -k {} + | awk '{s+=$1; n++} END {printf "%d files, %.2f MB\n", n, s/1024}'
# -> 472 files, 4.11 MB
```

Dry-run acceptance command when CLI use is authorized (not run here — no network/deploy in mode): `vercel deploy --dry-run` from repo root should list only the 472 web files.

## 5. Rollback risk

- Trivial: root `.vercelignore` is a new untracked file; delete it (or `git clean`) to restore prior behavior. No other file touched.
- Residual risks: (a) if the Vercel project's Root Directory ever changes away from `web`, the whitelist would exclude the new root — update rule 2 accordingly; (b) gitignore-negation corner cases (a file inside an excluded dir cannot be re-allowed) — not exercised here since exclusions inside `web` are intentional leaves.

## 6. Remaining acceptance

- `vercel deploy --dry-run` / actual upload not executed (no network per mode). Static inventory proves <10 MB; run the dry-run to fully close acceptance.
- `web/.env.local.example` excluded by the `.env.*` pattern — harmless, but re-allow it (`!web/.env.local.example`) if the team wants templates uploaded.

*Report written before deadline; all evidence reproducible from quoted commands.*
