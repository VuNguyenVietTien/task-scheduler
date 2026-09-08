# LIST-MEMBER-FILTER-0908

## Status

DONE

## Commits

- Branch: `codex/list-member-filter-0908`
- Prerequisite modal/member options: `47300152c52c80ac67a0db7c6a2b73c59b28ee8e` (cherry-picked as `5b30588`)
- List wiring: `e2b0eca` (integrated on `dev` as `02261ec`)

## Delivered

- List filter modal receives canonical resource-member options, including unlinked members.
- Selected filters match `assignee_resource_member_id` first.
- Legacy saved user-ID filters resolve through the canonical option's `userId` only when needed.
- Removed the obsolete task/Redux-derived filter-assignee list.
- Added dedicated regression coverage without changing `TaskListView.assignment.test.tsx`.

## Files

- `web/src/components/tasks/TaskListView.tsx`
- `web/src/components/tasks/task-list-member-filter.ts`
- `web/src/components/tasks/__tests__/task-list-member-filter.test.ts`

## Verification

Integrated `dev` at `d352f3e`:

```text
task-list-member-filter.test.ts
task-filter-modal-member-options.test.tsx
kanban-member-options.test.ts
3 suites passed; 7 tests passed; 0 failed
```

Tests ran from `dev-0908/web` with its existing dependencies.

## Unresolved questions

- None.
