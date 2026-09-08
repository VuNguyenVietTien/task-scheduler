# Remaining production feedback

Realtime/Excel source `a176c59` is integrated as `2d44757`; integration repair `fc5a730` preserves omitted mutation fields while retaining explicit clears. All 5 focused suites / 39 tests pass. Release evidence: `plans/reports/herdr-pm-260907-gantt-members-resource/RELEASE-REALTIME-0908.md`.

Only optional, non-blocking Chrome feedback remains:

- [ ] Verify Gantt User filtering with linked/unlinked members, descendant context, clear behavior, and saved-history identity.
- [ ] Exercise Excel focus recovery, Tab editing, linked/unlinked assignment set/clear, TSV copy/paste, validation errors, and Save/Discard/reload behavior.
- [ ] Switch en/ja/vi in the real profile and confirm List/Excel labels change without changing selected catalog IDs.
- [ ] Confirm normal/Excel effort updates display immediately, persist after reload, and retain errors for rejected/partial/missing results.
- [ ] Confirm existing task-detail/full-page/create catalog selectors save and reload correctly.
- [ ] Confirm Remove action visibility without deleting a production member. If desired, rename only an identified QA fixture and restore its original name immediately.
