# VERCEL-NOW

Status: **DONE — exact frontend production deployment READY.**

- Source commit: `81fbbc48174621824192367c02e99b4e9fee274c`
- Candidate archive SHA-256: `0aaeb6a768a0d10cde945a75de6212c225c2c4fd39586382cf1aaad6f18aa843`
- Immutable web archive SHA-256: `5ec88490139f444cc33061b193b6c2dc5edcf8ea41fcc9b14b95991794ee42de`
- Owned staging root: `C:/Users/TienVNV/AppData/Local/Temp/vercel-now-20260907-1919-34608`
- Ready: 2026-09-07 19:25:49 +07
- Deployment ID: `dpl_G3uaGFRjJgXKU9iJbAv1FMSBNP46`
- Deployment URL: https://task-scheduler-1l9ly880g-vunguyenviettiens-projects.vercel.app
- Production alias: https://prjmngr.vercel.app
- Alias inspection: READY; resolves to `dpl_G3uaGFRjJgXKU9iJbAv1FMSBNP46` at 19:26:57 +07.
- Login verification: `https://prjmngr.vercel.app/login` HTTP 307 at 19:26:15 +07.
- Rollback retained: `dpl_D82fpkRkvNPCZxh2k5HzifbA7w1E` (`https://task-scheduler-j2d76y4zf-vunguyenviettiens-projects.vercel.app`).

First attempt: `dpl_4sq9mp6eBBZcuiHSGLSon3wAbdC9` rejected before build: `The specified Root Directory "web" does not exist.` It submitted the owned `web/` directory while the project Root Directory is `web`. Reversible staging-only correction: submitted the owned parent containing immutable `web/` plus copied Vercel link metadata; project settings and product source unchanged.

Checks: candidate archive hash matched; deployment source generated from exact Git commit; Vercel project metadata existed only in owned staging; system CA verification enabled; retry CLI completed; deployment and alias inspect READY; login response received. No Vercel process remains. Backend owner separately reported production ready/up/current with all 16 migrations.

Scope notes: no source, lock, dependency, Vercel environment/project-setting, DB, Ubuntu, merge, or browser changes. The later `f9212535` artifact arrived after this retry completed; no duplicate deploy started per instruction. This confirms frontend deployment/readiness only, not full authenticated Chrome acceptance.

Remaining: PM/user Chrome acceptance; backend cutover validation remains backend-owner scope.

Unresolved questions: None.
