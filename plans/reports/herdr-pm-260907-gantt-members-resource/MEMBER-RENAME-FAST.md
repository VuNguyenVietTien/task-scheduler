# MEMBER-RENAME-FAST

Status: DONE_WITH_CONCERNS

## Delivered

- Added `remove_resource_member(project_id: ID!, member_id: ID!): Boolean!` to the mounted Rust GraphQL API.
  - Uses canonical `project_members.member_id`, so linked and unlinked placeholders use one path.
  - Runs in one transaction after project-write authorization.
  - Calls the existing target guard before deletion, preventing owner/self/privileged-member removal.
  - Deletes the canonical row only; existing DB FKs cascade member capacity/group/leave/classification data and reject deletion when task assignments still reference the member. No migration.
- Added per-row Remove action to the existing `SchedulingConfigPanel` canonical Members table; no duplicate table.
  - Native confirmation, pending lock, inline error/success truth, and toast.
  - Refreshes canonical members, capacity, groups, Redux member/task options, and project details.
- Added `update_project(project_id: ID!, name: String!): String!` to Rust GraphQL.
  - Trims/rejects empty names and uses authoritative project-write authorization in a transaction.
- Added Project Name form above catalogs in existing `?tab=settings`.
  - Prevents duplicate submission, retains draft on failure, shows inline pending/error/success.
  - Refetches project detail and project list; Redux refresh updates the current project/header while Apollo project-list refresh updates sidebar.

## APIs

- GraphQL mutation: `remove_resource_member(project_id, member_id)`.
- GraphQL mutation: `update_project(project_id, name)`.
- Existing reads reused: `resource_members`, `project`, `projects`, capacity/group queries.

## Files

Backend:
- `backend/src/graphql/resolvers/resource_members/mod.rs`
- `backend/src/graphql/resolvers/project.rs`
- `backend/schema.graphql`
- `backend/tests/contract/increment1_graphql.rs`
- `backend/tests/contract/main.rs`

Frontend:
- `web/src/graphql/scheduling.ts`
- `web/src/graphql/queries/project.ts`
- `web/src/components/projects/SchedulingConfigPanel.tsx`
- `web/src/components/projects/MembersView.tsx`
- `web/src/components/projects/ProjectNameSettings.tsx`
- `web/src/components/projects/ProjectDetailView.tsx`
- `web/src/components/projects/__tests__/member-query-recovery.test.tsx`
- `web/src/components/projects/__tests__/project-name-settings.test.tsx`

## Verification

- Focused Jest via verified matching shared dependency junction: 2 suites passed, 12 tests passed. Junction removed afterward.
- Backend source/SDL contract: PASS. Confirms both SDL operations, canonical `member_id` transaction, write gate, owner/privileged target guard before DELETE, and rename authorization/trim validation.
- `git diff --check`: PASS.
- Cargo unavailable on runtime, so Rust contract test was not compiled/executed.
- No DB, production, browser, build, broad typecheck, migration, or deploy run, as requested.

## Git

- Commit: `106271b feat(projects): remove members and rename projects`
- Pushed: `origin/codex/members-rename-0908`

## Risks / unresolved questions

- Rust compilation remains unverified because `cargo` is unavailable; source/SDL contract is the fallback.
- Assigned-member removal intentionally returns the backend DB constraint error rather than silently unassigning tasks, preserving tasks/history and canonical assignment integrity.
