# DEV-RELEASE-FAST

Status: **DONE_WITH_CONCERNS**

## Git / integration

- Worktree `C:/Users/TienVNV/Documents/prjmngr/worktrees/dev-0908`, branch `dev`; started `341e6ca88802d3937477b2f7ea8230c2683abca6`.
- Remote production `main` started `8810de3c12da097e019523604bd5c58b111d98f9` and was an ancestor of dev. Every main update used a fresh short-path worktree and `--ff-only`; no force push/rebase/history loss. One initial long TEMP worktree hit Windows path length, was removed, then safely retried.
- Excel exact producer `4faa28887fcf5f9f4adf0b33128ccb315cad47a7` cherry-picked as `d6c25d799c95f7a2226fd0cd62dda4f76f4612ff`.
- Member/rename exact producer `106271bf5ab323d328140aa2ddfb3028780ecb09` cherry-picked conflict-free as `3ba8f7f0227c389779a80c3e8adff94d226d70a9`.
- `remaining.md` now contains only optional Chrome feedback; commit `e53cc69cdf7356cc953ee01efb47b626a4efa7f2`.
- Remote Cargo contract exposed one stale write-guard count. Minimal owning correction retained—not weakened—six guards and explicitly included `remove_resource_member`; commit `db31fcb9919b5bb8a98abb97992aeb6557bc7ebf`.
- Final remote `dev` and `main` both exactly `db31fcb9919b5bb8a98abb97992aeb6557bc7ebf`; tree `762fadb3dbbc747ba12b1410bab4047982b3498f`.
- Final scoped diff/check passed: 15 member/backend/web/report files; no secrets, lockfile, dependency, migration, or install changes.

## Verification

- Excel producer report unavailable; user-authorized fresh Herdr evidence accepted: `TaskExcelGrid` 16/16 and `TaskListView.assignment` 7/7 PASS. Earlier 0/7 was duplicate Jest config/reporter harness failure. No duplicate rerun.
- `MEMBER-RENAME-FAST.md`: focused Jest 12/12 PASS, source/SDL contract PASS, diff check PASS. Cherry-pick had no conflict, so frontend tests were not duplicated.
- Ubuntu exact-source Cargo gate: first compile ran 29/30 and found stale contract metadata above; one allowed repaired rerun passed 30/30. Locked offline release build PASS.
- Final web production build PASS: compiled and generated 11/11 static pages. Temporary shared `node_modules` junction removed; no install/lock change.
- No production member was removed. No browser mutation test run.

## Deployments

### Excel module

- Main `d6c25d799c95f7a2226fd0cd62dda4f76f4612ff`.
- Vercel `dpl_AcnBMrvuij7qYehHyNSiGbVsYGeB`, `https://task-scheduler-fkjwje8f9-vunguyenviettiens-projects.vercel.app`, READY and aliased. Backend unchanged and remained `ready/up/current`.

### Member/remove/rename module

- Exact-main backend archive SHA-256 `e18e29d54daec46f104665348263efe6a2797df9b718c4f682539f863a0efd7d`; backend tree `8d107369854b7840e6e39953e51ff7765a1f3b1e`.
- Ubuntu release `/home/azuraith/task-scheduler/releases/20260908T0352-db31fcb9`.
- Image `task-scheduler-backend:20260908T0352-db31fcb9`; image ID `sha256:16d18aa511596f43b06257bc4278f6e4735305f535a8937e320745fd52f5240f`; binary SHA-256 `d62715c32e04e239154727c0ba080a1e1d69d3e4bb80609e2e6ad1f2d99706e0`.
- Pre-cutover backup `/home/azuraith/task-scheduler/releases/20260908T0352-db31fcb9/backups/production-before-db31fcb9.sql.gz`, SHA-256 `1396517478c87a0d38bd50514ecbe1d33279129c951374d9024934a4d42518cb`.
- New container `902f912198be16590c44c6368994ffe37719767925d18fd585042ba18fc0e4e4`; prior container retained stopped as `task-scheduler-backend-prev-20260908T0352-db31fcb9`. Runtime env/network/user/restart matched. No schema migration or DB restore.
- Local/public backend health: `ready/up/current`.
- Exact-main Vercel web tree `5e6cbc8d83c59ba02bfffdfe8c9615ed1b1eba24`; archive SHA-256 `60a45f390feb1eea5559a372dbcbc8cc2ca48ed972e2c3299dd3c01366924ccb`.
- Deployed staging parent containing `web/` and `.vercel/project.json`, never `--cwd web`, command-local `NODE_OPTIONS=--use-system-ca`.
- Vercel `dpl_BUjcLhGobbkedf2hgGewE6dBCxof`, `https://task-scheduler-1k18st7b6-vunguyenviettiens-projects.vercel.app`, READY. Alias `https://prjmngr.vercel.app` resolves to exact ID; direct/alias login HTTP 200 after redirects.

## Concerns

- React `act(...)` warnings remain non-blocking in Excel producer tests.
- Next build is configured to skip type and lint validation; no clean typecheck claimed.
- Authenticated Chrome feedback remains in `remaining.md`; destructive member removal intentionally untested.
- Root `README.md` required by AGENTS/CLAUDE is absent; deployment/component docs were read instead.

Unresolved questions: none.
