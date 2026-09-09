# GANTT-GAP-0909

Status: DONE
Date: 2026-09-09 Asia/Bangkok

## Root cause

Production evidence showed task `297720c5-1064-49cd-8e57-3dd276ff3997` explicitly starts 2026-09-03, while same-assignee followers `eb6871ec-efdf-4f9d-89dd-f6bc3e91b48e` and `4b6c94f8-b5a2-4225-ac5a-02b392595889` are undated. Frontend contract trace: `TASK_FIELDS.start_date` -> `transformTaskFromAPI.start_date` -> `Timeline.planLifecycleScheduling.tasks` -> `computeTaskAllocations`.

`computeTaskAllocations` initialized every undated task from `today`, then only moved it forward when the assignee cursor was later. For a historical predecessor ending 2026-09-03 and today 2026-09-09, the cursor lost to the implicit today floor, producing Sep 9 / Sep 10 despite available Sep 4 / Sep 7 capacity.

## Fix

Undated tasks now use the prior same-assignee cursor when one exists; only the first undated task for that assignee defaults to today. Existing explicit-date clamp remains, so lower-priority work cannot backfill before future higher-priority work. Existing capacity, remaining-day sharing, leave, weekend, reservation, eligibility, hierarchy-summary, and saved-plan snapshot behavior remains unchanged. No saved plan rewrite.

Source commit: `7290da7d6fb0a4ba824e5d94fad332c6007d2f98`

## Verification

- Red reproduction before fix: exact three production task IDs yielded follower Sep 9 instead of expected Sep 4; 1 failed, 13 passed.
- Green focused allocation suite: 14/14 passed.
- Green focused allocation + plan lifecycle suites: 29/29 passed.
- `git diff --check`: passed before source commit.
- No database mutation, migration, backend change, push, deploy, or browser mutation.

Tests used the existing `dev-0908/web` dependency runner with target-worktree source resolution and a temporary task-order-store shim because that runner lacks the `redux` peer package. No install performed.

## Localhost checkpoint

- URL: `http://localhost:3000`
- Directory: `C:\Users\TienVNV\Documents\prjmngr\worktrees\dev-0908\web`
- Command: `npm run dev -- -p 3000`
- Launcher PID: `14596`
- Listener PID: `2468`
- Stdout: `C:\Users\TienVNV\AppData\Local\Temp\prjmngr-gantt-gap-0909-next.log`
- Stderr: `C:\Users\TienVNV\AppData\Local\Temp\prjmngr-gantt-gap-0909-next.err.log`
- Final check: listener present; launcher alive.

## Unresolved questions

- None for scheduler fix.
- Checkout has no root `README.md` and no `.claude/rules/development-rules.md`; required `docs/README.md` and requested project docs were read.
