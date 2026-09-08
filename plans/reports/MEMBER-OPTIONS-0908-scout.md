---
status: NEEDS_CONTEXT
scope: bounded-read-only-scout
branch: dev
base: 357fdaa
---

# MEMBER-OPTIONS-0908 Scout Report

## Summary

List assignee filter is confirmed wrong. Canonical assignment rows already load in `TaskListView`, including unlinked/no-email members, but filter UI and predicate still use linked account users from Redux/task assignees.

No backend/schema change needed. `RESOURCE_MEMBERS_QUERY(project_id, only_assignable: true)` already returns the required assignment population and stable `resource_member_id`.

## Immediate List Patch

| File | Required change | Proposed owner |
|---|---|---|
| `web/src/components/tasks/TaskListView.tsx` | Pass existing canonical `assigneeOptions` to filter modal; match selected stable resource key against `task.assignee_resource_member_id`, with linked-user fallback for legacy saved filters/tasks | **Ownership conflict:** currently `gm-excel-interaction`; PM must grant this bounded region to member-options or ask gm-excel to patch it |
| `web/src/components/tasks/TaskFilterModal.tsx` | Accept/display canonical `{ key, label }` assignment options instead of linked `TaskAssignee[]`; persist selected stable key in existing string filter field | `member-options-0908` |
| `web/src/components/tasks/__tests__/TaskListView.assignment.test.tsx` | Focused regression: linked + unlinked/no-email options appear; selecting unlinked filters by `assignee_resource_member_id`; linked/legacy user matching remains valid | `member-options-0908`, unless bundled with gm-excel TaskListView patch |

Do **not** edit `TaskExcelGrid.tsx`; it already receives canonical options and remains owned by `gm-excel-interaction`.

## Root Cause Evidence

- `TaskListView.tsx:229-237` loads canonical assignable resource members.
- `TaskListView.tsx:448-464` builds stable resource-key options, including `user_id: null` rows.
- `TaskListView.tsx:612` filter predicate checks only `task.assignee.userId`.
- `TaskListView.tsx:2104-2110` passes legacy `assignees` gathered from tasks + Redux linked members.
- `TaskFilterModal.tsx:334-350` renders/stores only `assignee.userId`.

## Known Adjacent Assignment Surfaces

Not part of immediate List patch; do not expand before List fix:

- `web/src/components/tasks/KanbanBoard.tsx` — filter options/predicate use Redux linked users only; known follow-up assignment-filter defect.
- `web/src/components/tasks/TaskDetailPage.tsx` plus `web/src/app/projects/[id]/tasks/[taskId]/page.tsx` and `web/src/redux/features/taskDetailSlice.ts` — standalone task-detail route loses/does not select unlinked canonical assignment; known follow-up.

Already canonical; no edit:

- `web/src/components/tasks/NewTaskForm.tsx`
- `web/src/components/tasks/TaskDetail.tsx` (List/Kanban/Gantt modal)
- `web/src/components/timeline/Timeline.tsx`
- `web/src/hooks/useProjectSchedulingConfig.ts`
- `web/src/graphql/scheduling.ts`

Legitimately linked-user scoped; exclude from assignment-list fix:

- `web/src/app/projects/[id]/timesheet/page.tsx` — timesheet API targets `user_id`.
- Redux/project member GraphQL and access/ownership/mention selectors — account permissions/actions require linked users.

Dead/unused selector implementations are excluded: `TaskFilterBar.tsx`, `details/TaskDetailsPanel.tsx`, `tabs/DetailsTab.tsx`, backup task-detail files.

## Ownership Decision Needed

Grant `member-options-0908` the bounded List filter regions in `TaskListView.tsx` plus `TaskFilterModal.tsx` and the focused assignment test, **or** keep `TaskListView.tsx` with `gm-excel-interaction` and have that worker make the two wiring/predicate changes while member-options owns modal + test.

## Unresolved Questions

- Who owns the bounded `TaskListView.tsx` filter region now: member-options or gm-excel-interaction?
