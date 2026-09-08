# MAIN-ONLY-LOCAL-0908

## Status

DONE

## Vercel configuration

- Isolated worktree: `C:/Users/TienVNV/Documents/prjmngr/worktrees/main-only-local-0908`
- Branch: `codex/main-only-local-0908`
- Base: `dev` at `3790856a9ee836b782d38a6f47b491bccbc18c58`
- Commit: `817105adef8bff7db23520eb4736c7e55c1fa0b0`
- Remote branch verified: `origin/codex/main-only-local-0908`
- No merge to `main`; no Vercel deployment or remote backend change performed.

Changed paths:

- `web/vercel.json`: enables automatic Git deployment for `main`; disables wildcard-matched branches.
- `vercel.json`: disables automatic Git deployment for the unwanted duplicate root project.

Live Vercel metadata observed before configuration:

| Project | GitHub repository | Root Directory | Production branch | Result after integration |
| --- | --- | --- | --- | --- |
| `task-scheduler` | `VuNguyenVietTien/task-scheduler` | `web` | `main` | `web/vercel.json`: deploy `main` only |
| `web` | `VuNguyenVietTien/task-scheduler` | repository root (`.`) | `main` | root `vercel.json`: disable all automatic Git deployments, preventing duplicate deploys |

Official acceptance evidence: [Vercel `git.deploymentEnabled` documentation](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled) states branch patterns use minimatch and, when multiple rules match, any matching `true` rule causes deployment. Therefore `main: true` overrides `*: false` for `main`; every other branch matches only `*: false`. The same official page documents boolean `false` as disabling all automatic deployments.

Focused checks passed:

- Both JSON files parse.
- Exact policy assertions passed.
- `git diff --check` passed.
- Staged secret-pattern scan passed.
- Remote commit identity verified with `git ls-remote`.

## Local frontend

- URL: `http://localhost:3000/login`
- Final auth URL: `http://localhost:3000/auth?next=%2Flogin`
- HTTP result: `200`
- Port/address: `127.0.0.1:3000`
- CWD: `C:/Users/TienVNV/Documents/prjmngr/worktrees/dev-0908/web`
- Verified dev commit: `891e6f52fcc84a22f97979257814703a1bff5007`
- Launcher PID: `38200`
- Listener PID: `45716`
- Stop command: `taskkill /PID 38200 /T /F`

The server is intentionally left running. One listener exists on port 3000; no duplicate server was started. Local ignored environment configuration was refreshed through the already-linked `task-scheduler` Vercel project without printing or committing values. Required backend, session, and public Firebase settings are present. Backend target matches `https://pm-api.khampha.dpdns.org`.

Backend readiness passed without writes:

```text
https://pm-api.khampha.dpdns.org/health/ready
status=ready, database=up, migrations=current
```

No production task write or login mutation was performed.

## Remaining issues

None.
