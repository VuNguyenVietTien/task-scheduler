# Remaining production feedback

## September 8 local release, pending Vercel

- Implemented: browser-only List filters/columns, completed children retained under active parents, all mutable List columns editable, optional Start date, title-only create forms, multiple inline subtasks with partial-failure retry, strict per-assignee Gantt priority sequencing.
- Local test frontend is running at http://localhost:3000 from dev-0908/web and uses the existing Ubuntu backend. Launcher PID38200, listener PID45716 intentionally retained for user testing. Stop with `taskkill /PID 38200 /T /F`.
- Vercel last confirmed production: fbd1957 (title-only create + optional Start date). Later feature commits are NOT production-live because Vercel reports deployment rate limited, retry in 24 hours. User chose to wait; no Ubuntu frontend/domain was provisioned.
- [ ] After rate-limit reset, deploy latest main and verify Ready. Branch policy now allows main only for task-scheduler (root web) and disables duplicate root project automatic deployments. Older feature branches must pick up this configuration before future pushes.
- [ ] User test latest features on localhost, including Google sign-in, inline subtask batch failure/retry, optional dates, persisted column choices and Gantt order. Local HTTP/backend readiness verified; authenticated end-to-end mutation was not run.
- Reports: LIST-PREFERENCES-0908.md, TASK-CREATE-OPTIONAL-0908.md, INLINE-SUBTASK-0908.md, GANTT-PRIORITY-SEQUENCE-0908.md and MAIN-ONLY-LOCAL-0908.md under plans/reports/.

## Earlier optional browser feedback

Frontend List/Excel editors, descendant-aware Kanban, and shared default status visibility are integrated on `dev`; editor 31/31, Kanban/realtime 6/6, and status/Gantt 11/11 focused tests pass. Release evidence: `plans/reports/herdr-pm-260907-gantt-members-resource/RELEASE-FRONTEND-SURFACES-0908.md`.

Realtime/Excel source `a176c59` is integrated as `2d44757`; integration repair `fc5a730` preserves omitted mutation fields while retaining explicit clears. All 5 focused suites / 39 tests pass. Release evidence: `plans/reports/herdr-pm-260907-gantt-members-resource/RELEASE-REALTIME-0908.md`.

Only optional, non-blocking Chrome feedback remains:

- [ ] Verify Gantt User filtering with linked/unlinked members, descendant context, clear behavior, and saved-history identity.
- [ ] Exercise Excel focus recovery, Tab editing, linked/unlinked assignment set/clear, TSV copy/paste, validation errors, and Save/Discard/reload behavior.
- [ ] Switch en/ja/vi in the real profile and confirm List/Excel labels change without changing selected catalog IDs.
- [ ] Confirm normal/Excel effort updates display immediately, persist after reload, and retain errors for rejected/partial/missing results.
- [ ] Confirm existing task-detail/full-page/create catalog selectors save and reload correctly.
- [ ] Confirm Remove action visibility without deleting a production member. If desired, rename only an identified QA fixture and restore its original name immediately.
