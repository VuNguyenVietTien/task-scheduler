# Deployment documentation update — release 20260906T0645

- Task: herdr-260906-plan-deploy (deployment docs)
- Mode: edit only; no network / deploy / SSH / commit / delete
- Files written: `docs/deployment.md`, this report
- Deadline: 6 minutes; report written within deadline

## 1. Inputs read

- `docs/deployment.md` (previous verified state: 2026-09-01, image `task-scheduler-backend:20260901T1235`, rollback assets `:20260901T0900`)
- `backend/Dockerfile` (current BuildKit-secret, bookworm, non-root `app` uid 10001 image — context for the runtime `user=1000:1000` override note)
- Existing reports under `plans/reports/herdr-260906-plan-deploy/reports/` (`docker-build.md`, `vercel-upload.md`) — no conflicts with this entry

## 2. Changes to `docs/deployment.md`

1. `Last verified` bumped to 2026-09-06 (Asia/Ho_Chi_Minh).
2. Live services table updated only where the new release supersedes:
   - Backend image → `task-scheduler-backend:20260906T0645`
   - Backend release → `/home/azuraith/task-scheduler/releases/20260906T0645`
   - Vercel deployment → `task-scheduler-j2d76y4zf-vunguyenviettiens-projects.vercel.app` (aliased `prjmngr.vercel.app`)
3. Added dated section **“Release 20260906T0645 (2026-09-06)”** recording:
   - DB backup `/home/azuraith/task-scheduler/backups/db-before-20260906T0645.sql.gz`
   - 7 forward migrations applied
   - Public health: `ready` / `database: up` / `migrations: current`; GraphQL sanity `__typename: Query`
   - Running container `task-scheduler-backend`, image `:20260906T0645`, restart `unless-stopped`
   - Retained rollback container `task-scheduler-backend-prev-20260906T0645`
   - Runtime override `user=1000:1000` with host-mounted release log/config (host credential permissions require the host uid; image default non-root user unused on this host)
   - Chrome verification checklist: login; Gantt daily 2h; New Plan save r1; recalculate draft + save r2; Excel mode/Clone visible; Timesheet batch save 0.25h; Members capacity/groups/recurrence forms visible
   - Exact rollback commands (stop+rm current, rename retained prev container into service name, start, verify local 8081 and public readiness) plus Vercel alias re-point note
4. **Preserved unchanged**: the pre-existing rollback outline for the 20260901 release, retained-assets list (`:20260901T0900` image + release dir), health-check commands, verified production flow, known non-blocking follow-ups. The new section is additive.

## 3. Consistency and safety checks

- Rollback commands reference only assets named in this task's evidence (retained container `task-scheduler-backend-prev-20260906T0645`); the older image-based rollback outline for 20260901 remains valid and untouched.
- No emails, tokens, env values, or secrets recorded — only container names, image tags, host paths, deployment URLs, and functional checks.
- Runtime override note is consistent with `backend/Dockerfile` (image ships non-root uid 10001; host runs `user=1000:1000` due to host credential file permissions).

## 4. Rollback risk

- Documentation-only change: `git checkout -- docs/deployment.md` restores the previous doc. No runtime state, containers, or remote assets touched.
- Residual: rollback command block assumes the retained prev container keeps the previous release's environment/ports/network; if it is ever removed, fall back to the 20260901 image-based outline (still documented).

## 5. Remaining acceptance

- None for this documentation task; all specified evidence items recorded. (Commands in the doc are documentation, not executed — mode forbids network/SSH/deploy.)
