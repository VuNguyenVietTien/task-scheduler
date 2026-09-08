# Remaining production feedback

Excel editing and project member removal/rename implementation are complete. Release verification is tracked in `DEV-RELEASE-FAST.md`; only optional, non-blocking Chrome feedback remains:

- [ ] Verify Gantt User filtering with linked/unlinked members, descendant context, clear behavior, and saved-history identity.
- [ ] Exercise Excel focus recovery, Tab editing, linked/unlinked assignment set/clear, TSV copy/paste, validation errors, and Save/Discard/reload behavior.
- [ ] Switch en/ja/vi in the real profile and confirm List/Excel labels change without changing selected catalog IDs.
- [ ] Confirm normal/Excel effort updates display immediately, persist after reload, and retain errors for rejected/partial/missing results.
- [ ] Confirm existing task-detail/full-page/create catalog selectors save and reload correctly.
- [ ] Confirm Remove action visibility without deleting a production member. If desired, rename only an identified QA fixture and restore its original name immediately.
