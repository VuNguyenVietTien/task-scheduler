# GANTT-ASSIGNEE-SYNC-0908

## Status
READY

## Root cause
- List already saves canonical `assignee_resource_member_id` plus compatible nullable `assignee_id` and upserts the mutation result into Redux.
- Gantt modal still used legacy linked-user `projectMembers`, keyed options by `user_id`, and saved only `assignee_id`; unlinked/name-only members could not display or save.
- Gantt task rows and allocation bars read account assignee labels, so canonical unlinked assignments had no visible member name.

## Fix
- `TaskDetail` now queries assignable `resource_members` for the task project, keys dropdown options by `resource_member_id`, displays `display_name`, and supports members without email or user ID.
- Modal select/unset uses the existing dual-field assignment mutation path and publishes only the normalized authoritative mutation result through Redux `upsertTask`.
- Gantt rows and day bars resolve canonical resource IDs through scheduling resource members and show the member display name.
- Existing shared task fragment/mutation response and recursive Redux upsert remain authoritative; no backend change required.

## Verification
Passed:
- `gantt-assignee-modal.test.tsx`: 2/2 — unlinked selection and canonical unset.
- `TaskListView.assignment.test.tsx`: 11/11 — List canonical assignment, immediate Redux update, hierarchy preservation.
- `independent-wiring.test.tsx`: live unlinked resource assignment/API normalizer/capacity case passed; file has one unrelated pre-existing reorder mock failure.

Baseline limitations:
- Jest default command has duplicate config files and missing configured `jest-junit`/`ts-jest`; tests run with `jest.config.js --reporters=default`.
- Repository-wide `tsc --noEmit` remains red on existing legacy files/types; no new error reported for changed Timeline code. Existing `TaskDetail` `AuthContext.User` export error predates this change.
- No backend files changed, so no backend contract test added.
- No deploy or production mutation performed.

## Files
- `web/src/components/tasks/TaskDetail.tsx`
- `web/src/components/timeline/Timeline.tsx`
- `web/src/components/tasks/__tests__/gantt-assignee-modal.test.tsx`
- `plans/260908-1429-gantt-assignee-sync/plan.md`

## Unresolved questions
None.
