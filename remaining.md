# Remaining production feedback

## September 8 release status

- Implemented: browser-only List filters/columns, completed children retained under active parents, all mutable List columns editable, optional Start date, title-only create forms, multiple inline subtasks with partial-failure retry, strict per-assignee Gantt priority sequencing.
- Local test frontend is running at http://localhost:3000 from dev-0908/web and uses the existing Ubuntu backend. Launcher PID38200, listener PID45716 intentionally retained for user testing. Stop with `taskkill /PID 38200 /T /F`.
- Latest successful frontend deployment: 0bf3393 (includes dated zero-effort Gantt and inline append/realtime). Vercel7dcd255 returned rate limited24h again; invalid-plan recovery968fe95 and subsequent clone follow-up remain local/main until next accepted deployment. No manual retry loop.
- [x] Rate limit cleared; production Ready confirmed. Main-only deployment policy remains enabled; duplicate root project automatic deploy disabled.
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

## Latest backend feedback
- CORS fixed and live: localhost:3000 and prjmngr.vercel.app accepted. Chrome dashboard loads real data.
- Member hard removal fixed and LIVE on Ubuntu image task-scheduler-backend:20260908T0952-53011ef. Assigned tasks become unassigned atomically; task hierarchy and timesheet history retained. Local/public health verified. Report plans/reports/MEMBER-REMOVE-0908.md.
- User may now retry Remove. No production deletion was performed by PM for testing.

## Burndown local delivery
- Implemented saved-plan revision selector and task-count planned vs actual curves. Planned completion uses saved endDate; actual completion uses canonical actual_end_date only. Focused initial tests 8/8; baseline repair tests 7/7.
- Chrome verified r1/r2 selector and legacy allocation-independent parsing. Existing CANON saved revisions contain only one excluded rejected/archived task; 156 current executable tasks are outside those revisions, so empty comparison is correct. Save a plan including current tasks to exercise populated chart; no production plan was created by PM.
- Delivered on localhost and production e165c22. Reports PROJECT-BURNDOWN-0908.md and BURNDOWN-BASELINE-0908.md.

## Gantt and member follow-up
- Delivered on localhost and main e43556a: descendant effort totals in List/Excel and Gantt, sparse WBS parent bars, continuous Master phase spans, select-on-click/edit-on-double-click Excel cells, status/priority dropdowns and single-cell range paste. Excel focused tests44pass; Gantt61pass plus4targeted lifecycle cases.
- Canonical member options now cover List filters, Kanban and standalone task detail, including members without linked accounts. Member tests7pass and integrated filter tests7pass. Reports GANTT-PARENT-SUMMARY-0908.md, EXCEL-INTERACTION-0908.md, MEMBER-OPTIONS-0908.md, LIST-MEMBER-FILTER-0908.md.
- Delivered83be7c1: newest-plan default, explicit no-plan, clear delete, safe legacy hours parsing, simplified capacity colors, rejected/archive phantom allocations removed.39focused+22selected tests passed; existing unrelated R5 reorder assertion still fails on baseline. Follow-up570e1b5 renders assigned zero-effort tasks at explicit start date without resource hours;6focused tests passed, plus original resource-cell test1pass. Chrome recovered: Kanban renders descendants, Master phantom Unclassified Sep8 absent, old unassigned Sep8 allocation now0h; valid zero-effort phase spans shown.

## Current List and plan cleanup
- Inline append/realtime0bf3393:47focused tests pass. Canonical create responses update Redux and flat Apollo rows; drafts append below descendants. Exact three new MST-02-04 children changed priority only from0 to38/39/40 after scoped backup. Chrome confirmed six older children first, then these three. Report LIST-APPEND-0908.md.
- User-requested two Chrome E2E plans r1/r2 deleted with scoped backup; remaining project plans0 and task count183 unchanged. Chrome selector now only No plan, no invalid-hours error. Recovery968fe95 adds failed-plan deletion access, friendly error and empty-refetch clear;18focused tests pass. Report GANTT-INVALID-PLAN-0908.md.
- Clone multi-parent dialog/callback integrated6094b2e;30focused tests passed. Chrome verified simultaneous two-parent selection and correct preview without creating data. Grouping integrated255a38c: children sorted by project Progress display order in Normal/Excel, same-group priority preserved;79combined focused tests passed. Chrome verified formerly interleaved MST-02-05 children now grouped. Backend exact clone-title preservation0ce6e93 is LIVE on Ubuntu20260908T1306-0ce6e937;1focused unit passed, immutable build and public/local readiness passed. Existing task names unchanged. Vercel frontend remains quota-blocked.


